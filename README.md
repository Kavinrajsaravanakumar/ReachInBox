# ReachInBox — Full-Stack Email Job Scheduler

A production-grade email scheduler and dashboard built for the ReachInBox hiring assignment. Accepts scheduling requests via API, delays and throttles sends through BullMQ + Redis (no cron), tracks everything in Postgres, indexes sent/scheduled mail into Elasticsearch, and notifies a connected Slack workspace the moment a sender's hourly limit is hit.

---

## 1. 🚀 Setup & Execution Instructions

### Prerequisites
- Node.js (LTS)
- Docker Desktop (for Postgres, Redis, Elasticsearch)
- A Google Cloud OAuth client (for Google Sign-In)
- A Slack app (for rate-limit notifications)

### Backend setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Configure environment variables
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
# then fill in GOOGLE_CLIENT_ID/SECRET and SLACK_CLIENT_ID/SECRET

# 3. Start PostgreSQL, Redis, and Elasticsearch containers
docker compose up -d

# 4. Install dependencies and run database migrations
npm install
npm run migrate

# 5. Start the Express API server (port 3000)
npm run dev

# 6. In a SECOND terminal window (inside backend/), start the BullMQ worker
npm run worker
```

**Key backend endpoints**
| Purpose | URL |
|---|---|
| API base | `http://localhost:3000/api` |
| Health check | `http://localhost:3000/health` |
| Bull Board (live queue dashboard) | `http://localhost:3000/admin/queues` |
| Local dev login (no Google needed) | `POST http://localhost:3000/api/auth/dev` |

### Frontend setup

```bash
# 1. In a new terminal window, navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the Next.js development server (port 3001)
npm run dev
```

Open **http://localhost:3001** in your browser.

---

## 2. 🏛️ Architecture

### Decoupled root structure
```
ReachInBox/
  backend/     — Express API, BullMQ worker, Postgres, Redis, Elasticsearch, Slack/Google OAuth
  frontend/    — Next.js dashboard (TypeScript + Tailwind)
```
Clean separation between backend services and the Next.js frontend UI — each is independently installable, runnable, and deployable.

### 3-layer backend architecture (routes → controllers → services)
- **Routes** — define endpoints and HTTP methods only.
- **Controllers** — parse/validate requests, call services, shape responses.
- **Services** — hold the actual business logic (scheduling, rate limiting, Slack notifications, etc.), independent of Express.

This keeps request handling, validation, and business logic decoupled and independently testable.

### BullMQ delayed queue processing
- One BullMQ delayed job is created per recipient email, not per campaign.
- **Deterministic job IDs** (`jobId = email.id`) make every enqueue idempotent — re-running a schedule request or restarting the server can never create a duplicate job for the same email row.
- The worker runs as a **separate process** from the API, with a configurable concurrency (`WORKER_CONCURRENCY`), so scheduling requests return instantly and never block on actual sending.
- No cron in any form — all timing is handled by BullMQ's native delayed-job mechanism.

### Atomic hourly rate limiting (Redis + Lua scripting)
- Rate-limit keys: `ratelimit:{senderId}:{yyyy-MM-dd-HH}`.
- A custom Lua script performs an atomic check-and-increment against this counter, so concurrent workers/instances can never race past the configured limit — the check and the increment happen as one indivisible Redis operation.
- Limits are configurable via `MAX_EMAILS_PER_HOUR` (global) or a per-sender override, with no hardcoded values.
- When a sender is at its limit, the job is **not dropped or failed** — it's moved to the next hour window (`job.moveToDelayed(...)`) and retains its original `jobId`, so it's neither lost nor duplicated.
- **Minimum delay between sends**: `MIN_SEND_DELAY_MS` (default 2000ms), enforced via BullMQ's `limiter: { max: 1, duration: MIN_SEND_DELAY_MS }`, to mimic real provider throttling.

### Slack notification deduplication
- Alert key: `slackNotified:{senderId}:{window}`, with a 1-hour Redis TTL.
- Guarantees at most **one** Slack alert per sender per rate-limit breach, even though many individual emails may be throttled in the same window.
- If no Slack integration exists for the user, the notification step is silently skipped — no crash, no failed job. If they connect Slack later, the very next rate-limit hit notifies them with no redeploy required.

### Boot-time reconciliation
- `reconcileScheduledJobs()` runs on every API/worker boot: it scans Postgres for rows with `status = 'scheduled'` that have no live BullMQ job, and re-enqueues only those (using the same deterministic `jobId`, so it's a safe no-op if the job already exists).
- This is what guarantees the system survives a full restart with zero lost or duplicated emails — Redis-resident jobs resume automatically, and this reconciliation step is the safety net for the edge case where Redis itself lost data.

### Elasticsearch full-text search
- Every sent/scheduled email is indexed into Elasticsearch with recipient, subject, body, status, and timestamps.
- Search is exposed via a `search` query param on the emails listing endpoint, using a multi-match query across subject/body/recipient fields.
- Indexing failures are caught and logged without blocking the actual email send — Elasticsearch availability is treated as non-critical to the core scheduling path.

---

## 3. ✨ Feature Implementation Summary

1. **Google OAuth & local dev auth**
   Real Google Sign-In via OAuth 2.0, plus a `POST /api/auth/dev` shortcut (gated behind `DEV_AUTH_ENABLED=true`) for fast local testing without going through Google each time.

2. **Email scheduler & CSV bulk upload**
   Compose a subject/body once, target a single recipient, a manually entered list, or a bulk `.csv` upload of leads. Supports both "send immediately" and "schedule for a specific time" — the start time is resolved at submission time, not frozen when the compose form was first opened, so a delayed submission never silently backdates the schedule.

3. **Real-time dashboard & pagination**
   Tabbed Scheduled/Sent views with periodic refresh, dynamic pagination sized to fill the available screen height, and page position preserved when navigating in and out of an email's detail view.

4. **Slack alert integration**
   Real OAuth "Connect Slack" flow (with a custom-webhook fallback option), live connection status shown directly on the button, and reconnect/disconnect controls. Rate-limit breaches trigger an actual, verifiable Slack message — not a log line — formatted as:
   ```
   ⚠️ Hourly rate limit reached
   Sender: sales@yourcompany.com
   Hourly limit: 10 emails
   Action: Remaining emails have been rescheduled
   Next send window: 4:00 PM
   ```

5. **Ethereal preview link**
   Every successfully sent email stores its Ethereal preview URL; the Sent Emails table surfaces an "Open Ethereal" button per row so the actual delivered content can be inspected directly.

---

## 4. ⚙️ Configuration Reference (.env)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string (BullMQ + rate limiting) |
| `ELASTICSEARCH_URL`, `ELASTICSEARCH_INDEX` | Search backend |
| `WORKER_CONCURRENCY` | Parallel job processing count |
| `MIN_SEND_DELAY_MS` | Minimum delay between individual sends |
| `MAX_EMAILS_PER_HOUR` | Global/per-sender hourly rate limit |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_CALLBACK_URL` / `SLACK_SCOPES` | Slack OAuth |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Session token signing |
| `DEV_AUTH_ENABLED` | Enables `/api/auth/dev` for local testing |

---

## 5. Known trade-offs

- Elasticsearch is treated as a non-critical dependency: if it's unreachable, emails still send and schedule normally, and indexing simply retries/logs rather than failing the request. This keeps the core scheduling path resilient to a secondary service being down.
- The demo does not send 1000+ real emails through Ethereal; rate-limiting and reschedule behavior at that scale is validated with a smaller batch and the same code path (`scripts/test-rate-limit.ts`).

---

## 6. 📤 Pushing Code to GitHub

```bash
# 1. Check current git status
git status

# 2. Stage all changed files
git add .

# 3. Commit changes with a descriptive message
git commit -m "refactor: backend and frontend modular architecture with updated README docs"

# 4. Push to your remote repository
git push origin main
```
