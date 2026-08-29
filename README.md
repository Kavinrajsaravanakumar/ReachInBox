# ReachInbox email job scheduler (backend)

TypeScript / Express API plus a **separate** BullMQ worker. Scheduling is **only** BullMQ delayed jobs — no cron, no `node-cron`, no `agenda`, no `setInterval` polling.

## Defaults (documented)

| Setting | Default | Why |
|---|---|---|
| `MIN_SEND_DELAY_MS` | **2000** | BullMQ `limiter: { max: 1, duration: 2000 }` — at most one send every 2s **per worker process**, so a burst of ready jobs cannot stampede Ethereal. |
| `WORKER_CONCURRENCY` | **5** | Caps in-flight SMTP work; combined with the 2s limiter, throughput is naturally ~30/min/process even before the hourly Redis cap. |
| `MAX_EMAILS_PER_HOUR` | **30** | Global hourly cap when a sender has no override. Low enough that a 5-email demo can prove throttle + reschedule. |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | unset | Optional env-wide per-sender cap. |
| `DEV_AUTH_ENABLED` | `true` in `.env.example` | Local JWT via `POST /api/auth/dev`. **Disable in production.** |
| Rate-limit window | UTC `yyyy-MM-dd-HH` | Shared across all worker instances. |
| Job attempts | **1** | A successful Ethereal send must not be retried. Failures mark the row `failed`. |

**Hourly limit precedence:** `senders.max_emails_per_hour` (set at register time or via `maxEmailsPerHour` on `POST /api/emails/schedule`) → env `MAX_EMAILS_PER_HOUR_PER_SENDER` → env `MAX_EMAILS_PER_HOUR`.

## How scheduling works

1. `POST /api/emails/schedule` inserts **one Postgres row per recipient** with `status = 'scheduled'` and `scheduled_at = startTime + index * delayBetweenEmailsMs`.
2. Each row is also upserted into the Elasticsearch `emails` index (searchable while still scheduled).
3. One BullMQ job is added per row with **`jobId` = row UUID** and `delay` = milliseconds until `scheduled_at`. Duplicate `jobId`s are a no-op.
4. The worker process (`npm run worker`) is the only thing that sends mail (Nodemailer → Ethereal). Preview URLs are stored on the row.

Jobs already waiting/delayed in Redis survive API or worker restarts: BullMQ persists them (Redis AOF is on in Compose). They fire at the original scheduled time.

### Boot reconciliation (zero loss if Redis was flushed)

On **API and worker boot**, rows with `status = 'scheduled'` are scanned. Missing BullMQ jobs are re-enqueued with the same UUID `jobId`. If the job already exists (`waiting` / `delayed` / `active`), add is skipped. Completed/failed leftover jobs for still-scheduled rows are removed then re-added.

### Idempotency

- Enqueue: `jobId = emails.id`.
- Worker: if the row is no longer `scheduled`, the handler returns without sending.

## Hourly rate limit (multi-worker safe)

Redis key: `ratelimit:{senderId}:{yyyy-MM-dd-HH}`.

A **Lua script** runs atomically:

- If `GET` count `>=` limit → return reject **without** `INCR`.
- Else `INCR`; if the new value is `1`, `EXPIRE 3600` (TTL only when the key is created).

Workers never race on expire-vs-incr. If the job is over the cap it is **not** failed or dropped: `job.moveToDelayed(nextUtcHourStart + (scheduled_at % 1 hour))` then `DelayedError`. The `% 1 hour` offset keeps relative order from the original stagger.

The **first** reject in a window does `SET slackNotified:{senderId}:{window} EX 3600 NX`. Only the winner notifies Slack. The notifier **always SELECTs `slack_integrations` at event time** (no boot-time cache), so connecting Slack later works immediately. Missing integration → silent skip.

## Google & Slack OAuth

- Google: `POST /api/auth/google` returns `{ url }`; `GET /api/auth/google` redirects; `GET /api/auth/google/callback` upserts `users` and redirects to `OAUTH_SUCCESS_REDIRECT?token=JWT`.
- Slack: `GET /api/slack/oauth/authorize` (JWT required) → Slack; `GET /api/slack/oauth/callback` stores `webhook_url` and/or `access_token` (+ `channel_id`) keyed by `user_id`.
- If client IDs are empty, those routes return **503** and the rest of the API still runs.

## Run

```bash
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev            # API :3000
npm run worker         # separate terminal
```

- Health: http://localhost:3000/health
- Bull Board (read-only): http://localhost:3000/admin/queues  
  If `ADMIN_TOKEN` is set, pass `X-Admin-Token` or `?token=`.
- Elasticsearch on Windows/Docker: if the container exits, raise Docker memory or run `wsl -d docker-desktop sysctl -w vm.max_map_count=262144`.

### Load (1000+ same-time jobs)

Do **not** send 1000 real messages in a demo. Concurrency + 2s limiter + hourly Redis cap spread work across hour windows. Prove the limiter with a **5-email** batch and `maxEmailsPerHour: 2` (see `scripts/manual-test.md`) or:

```bash
npm run test:rate-limit
```

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | no | |
| POST | `/api/auth/google` | no | `{ url }` |
| GET | `/api/auth/google` | no | redirect |
| GET | `/api/auth/google/callback` | no | |
| POST | `/api/auth/dev` | no | only if `DEV_AUTH_ENABLED=true` |
| POST | `/api/senders` | JWT | `{ email, displayName, maxEmailsPerHour? }` |
| POST | `/api/emails/schedule` | JWT | JSON recipients **or** multipart `recipientsFile` CSV |
| GET | `/api/emails` | JWT | `status`, `search` (ES + hydrate), `page`, `limit` |
| GET | `/api/slack/oauth/authorize` | JWT | |
| GET | `/api/slack/oauth/callback` | no (state JWT) | |
| GET | `/admin/queues` | optional admin token | |

Schedule body: `{ senderId, subject, body, recipients: string[], startTime, delayBetweenEmailsMs, maxEmailsPerHour }`.

Auth header: `Authorization: Bearer <jwt>`.

## Layout

```
src/routes  services  workers  db  queues  lib
drizzle/    SQL migrations (Drizzle)
scripts/    demo-rate-limit.ts, manual-test.ps1, manual-test.md
postman/
```
