# ReachInBox — Comprehensive Technical Documentation & Architecture Guide

A production-grade, distributed email scheduling system featuring Google OAuth, BullMQ delayed job queues, Redis atomic Lua rate limiting, full-text Elasticsearch indexing, and Slack rate-limit alert notifications.

---

## 1. Project Overview

### Plain Language Summary
ReachInBox is an asynchronous, distributed email scheduling platform. It allows users and applications to schedule individual or bulk recipient emails for delivery at a specified future timestamp (or immediately) while enforcing strict per-sender or global hourly sending limits.

### Problem Solved
Traditional email scheduling systems often rely on cron jobs (`node-cron`, `agenda`) or periodic database polling intervals (`setInterval`), which suffer from critical failure modes:
1. **Polling Stampedes & DB Spikes:** Querying `WHERE scheduled_at <= NOW()` at fixed intervals creates high database contention and misses exact delivery targets under load.
2. **Lack of Horizontal Scaling:** Running cron loops across multiple API nodes results in duplicate email sends unless expensive row locking is implemented.
3. **Uncontrolled Bursts:** When a large batch of scheduled emails becomes ready simultaneously, without fine-grained rate limiting, it can ruin sender IP reputation or trigger provider throttling.

ReachInBox solves this by combining **PostgreSQL** for persistent state, **BullMQ + Redis** for exact millisecond-accurate delayed job queues, **Atomic Redis Lua Scripts** for multi-worker hourly rate limiting, and a **dedicated Worker process** separate from the HTTP API.

---

## 2. Architecture

### System Components & Interactions

```
+-----------------------------------------------------------------------------------+
|                                 NEXT.JS FRONTEND                                  |
|                 (App Router, React, TailwindCSS - Port 3001)                      |
+------------------------------------------+----------------------------------------+
                                           | HTTP / REST (JWT Auth)
                                           v
+-----------------------------------------------------------------------------------+
|                                EXPRESS API SERVER                                 |
|                         (src/app.ts, src/server.ts - Port 3000)                   |
+---------------+--------------------------+------------------------+---------------+
                |                          |                        |
                v                          v                        v
     +--------------------+      +-------------------+    +-------------------+
     |     POSTGRESQL     |      |       REDIS       |    |   ELASTICSEARCH   |
     | (Drizzle ORM State)|      | (BullMQ & Limits) |    |  (Full-text Index)|
     +---------+----------+      +---------+---------+    +---------+---------+
               ^                           ^                        ^
               |                           |                        |
               +---------------------------+------------------------+
                                           |
+------------------------------------------+----------------------------------------+
|                                BULLMQ WORKER PROCESS                              |
|                           (src/worker.ts, src/workers/)                           |
|                                                                                   |
|  * Consumes "email-send" Queue          * Enforces Atomic Hourly Rate Limits      |
|  * Sends via Nodemailer (Ethereal)      * Posts Slack Alerts on Hourly Cap Breach |
|  * Updates Postgres & Indexes ES        * Reschedules Over-Cap Jobs to Next Hour  |
+-----------------------------------------------------------------------------------+
```

1. **Express API Server (`src/server.ts` / `src/app.ts`):** Handles authentication, sender creation, email scheduling validation, DB persistence, BullMQ job enqueuing, Elasticsearch indexing, and Slack webhook registration. Mounts the read-only Bull Board dashboard at `/admin/queues`.
2. **BullMQ Worker Process (`src/worker.ts` / `src/workers/email.worker.ts`):** A standalone background process that listens to the `email-send` queue. It evaluates rate limits atomically before sending, dispatches emails via Nodemailer (Ethereal SMTP), updates database status (`sent` / `failed`), re-indexes Elasticsearch, and notifies Slack when rate limits are breached.
3. **PostgreSQL Database:** Ground truth for users, senders, scheduled/sent/failed emails, and Slack integrations.
4. **Redis:** Manages BullMQ job state queues, atomic Lua rate-limit counters (`ratelimit:{senderId}:{window}`), and Slack notification deduplication flags (`slackNotified:{senderId}:{window}`).
5. **Elasticsearch:** Maintains a full-text search index (`emails`) for instantly querying subjects, bodies, and recipient emails across scheduled, sent, and failed records.
6. **Slack Integration:** Delivers real-time alert notifications when a sender hits their hourly limit. Supports both incoming webhooks and Slack OAuth bot tokens (`chat.postMessage`).
7. **Google OAuth:** Secure user authentication producing signed JWT tokens for API authorization.

---

### Email Lifecycle (API Request to Delivery)

```
[Client POST /api/emails/schedule]
             │
             ▼
[Insert row into Postgres `emails` (status='scheduled')]
             │
             ▼
[Index document into Elasticsearch `emails` index]
             │
             ▼
[Enqueue BullMQ job: queue='email-send', jobId=email.id, delay=(scheduledAt - now)]
             │
             ▼  (Time passes until `scheduledAt`)
[Worker picks up job `send`]
             │
             ├─► Check: Is row status still 'scheduled'? (If not -> skip)
             ├─► Evaluate Rate Limit via Redis Lua Script (`ratelimit:{senderId}:{window}`)
             │      │
             │      ├─► [ALLOWED] -> Send via Nodemailer -> Update Postgres (status='sent', previewUrl)
             │      │                                     -> Re-index Elasticsearch document
             │      │
             │      └─► [REJECTED (Limit Exceeded)]
             │             │
             │             ├─► Set Slack dedupe key (`slackNotified:{senderId}:{window}` EX 3600 NX)
             │             │   If won -> Query `slack_integrations` -> Post Slack Alert
             │             │
             │             └─► Reschedule job: `job.moveToDelayed(nextUtcHourStart + (scheduledAt % 1h))`
             │                 Throw `DelayedError` (job stays in queue for next hour window)
```

---

### Worker Separation Rationale
The worker process (`src/worker.ts`) is completely decoupled from the API process (`src/server.ts`) for three reasons:
1. **Non-blocking API Performance:** Network I/O (SMTP sending, Slack webhooks) and rate-limit retries never block HTTP request threads.
2. **Independent Horizontal Scaling:** Worker concurrency (`WORKER_CONCURRENCY`) can be adjusted independently of the API HTTP instance count.
3. **Restart Safety:** Restarting or re-deploying the API server does not interrupt in-flight SMTP transfers or drop delayed jobs managed in Redis.

---

### Redis Key Formats & Rate Limiting Mechanics

- **Hourly Rate Limit Key:** `ratelimit:{senderId}:{yyyy-MM-dd-HH}`
  - *Window Format:* UTC hour timestamp (e.g. `2026-08-31-09`).
  - *Rationale:* Automatically scopes limits to strict 1-hour UTC windows. Expire TTL (3600s / 7200s) is set atomically on first increment (`INCR == 1`).
- **Slack Deduplication Key:** `slackNotified:{senderId}:{window}`
  - *Value:* `"1"`, set via `SET NX EX 3600`.
  - *Rationale:* Ensures that when a sender bursts over their hourly limit, only the **first** throttled job triggers a Slack notification for that hour. Subsequent throttled jobs in the same window pass silently.

---

### Idempotency & Boot-Time Reconciliation

- **Idempotent Enqueuing (`jobId = email.id`):** Every BullMQ job uses the database row UUID as its `jobId`. BullMQ rejects duplicate job IDs, making re-enqueuing idempotent.
- **Worker Execution Guard:** Before sending, the worker reads the PostgreSQL row. If the row status is no longer `scheduled` (e.g. cancelled or already processed), the job exits cleanly without sending.
- **Boot-Time Reconciliation (`reconcileScheduledJobs()`):** On startup of both API and Worker processes, the system queries PostgreSQL for all rows with `status = 'scheduled'`. For each row, `enqueueEmailJob()` verifies if a live BullMQ job exists in Redis. If missing (e.g. after a Redis cache flush), it re-enqueues the job at its original `scheduledAt` offset.

---

## 3. Full API Reference

Authentication Header: `Authorization: Bearer <jwt_token>` (for JWT-protected routes).

### Summary Table

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | System health check |
| POST | `/api/auth/google` | Public | Get Google OAuth authorization URL |
| GET | `/api/auth/google` | Public | Redirect directly to Google OAuth |
| GET | `/api/auth/google/callback` | Public | Handle Google OAuth callback & issue JWT |
| POST | `/api/auth/dev` | Public (Dev) | Dev mode instant JWT login |
| GET | `/api/auth/me` | JWT | Get current authenticated user profile |
| POST | `/api/senders` | JWT | Register a new sender email identity |
| POST | `/api/emails/schedule` | JWT | Schedule single/bulk emails (JSON or CSV) |
| GET | `/api/emails` | JWT | List scheduled/sent/failed emails (search & paginate) |
| GET | `/api/emails/:id` | JWT | Get detailed email record by ID |
| GET | `/api/slack/oauth/authorize` | JWT | Initiate Slack OAuth flow |
| GET | `/api/slack/oauth/callback` | Public (State) | Handle Slack OAuth redirect & store tokens |
| GET | `/api/slack/integration` | JWT | Fetch active Slack integration status |
| POST | `/api/slack/webhook` | JWT | Connect custom Slack Webhook URL |
| DELETE | `/api/slack/integration` | JWT | Disconnect Slack integration |
| GET | `/admin/queues` | Admin Token | Bull Board UI dashboard |

---

### Detailed Endpoint Specifications

#### 1. System Health
- **GET `/health`**
  - **Auth:** Public
  - **Response (200 OK):**
    ```json
    {
      "ok": true,
      "service": "reachinbox-email-scheduler"
    }
    ```

#### 2. Authentication Routes
- **POST `/api/auth/google`**
  - **Auth:** Public
  - **Response (200 OK):** `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }`
  - **Error (503 Service Unavailable):** `{ "error": "Google OAuth is not configured on server" }`

- **GET `/api/auth/google`**
  - **Auth:** Public
  - **Behavior:** 302 Redirect to Google OAuth authorization page.

- **GET `/api/auth/google/callback?code=...&state=...`**
  - **Auth:** Public
  - **Behavior:** Exchanges code for tokens, upserts `users` record, signs JWT, and 302 redirects to `OAUTH_SUCCESS_REDIRECT?token=<jwt>`.

- **POST `/api/auth/dev`**
  - **Auth:** Public (requires `DEV_AUTH_ENABLED=true` in env)
  - **Request Body:**
    ```json
    {
      "email": "dev@example.com",
      "name": "Dev User"
    }
    ```
  - **Response (200 OK):**
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "c1f7a08b-1e24-4f4d-b98a-1a2b3c4d5e6f",
        "email": "dev@example.com",
        "name": "Dev User",
        "avatarUrl": null
      }
    }
    ```

- **GET `/api/auth/me`**
  - **Auth:** JWT
  - **Response (200 OK):**
    ```json
    {
      "id": "c1f7a08b-1e24-4f4d-b98a-1a2b3c4d5e6f",
      "email": "dev@example.com",
      "name": "Dev User",
      "avatarUrl": null
    }
    ```

#### 3. Sender Routes
- **POST `/api/senders`**
  - **Auth:** JWT
  - **Request Body:**
    ```json
    {
      "email": "outreach@company.com",
      "displayName": "Sales Outreach",
      "maxEmailsPerHour": 50
    }
    ```
  - **Response (201 Created):**
    ```json
    {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d5e6f",
      "userId": "c1f7a08b-1e24-4f4d-b98a-1a2b3c4d5e6f",
      "email": "outreach@company.com",
      "displayName": "Sales Outreach",
      "maxEmailsPerHour": 50
    }
    ```

#### 4. Email Scheduling Routes
- **POST `/api/emails/schedule`**
  - **Auth:** JWT
  - **Content-Type:** `application/json` OR `multipart/form-data` (with `recipientsFile` CSV)
  - **Request Body (JSON):**
    ```json
    {
      "senderId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d5e6f",
      "subject": "Product Update",
      "body": "Hello {{name}}, check out our latest feature!",
      "recipients": ["alice@example.com", "bob@example.com"],
      "startTime": "2026-08-31T10:00:00.000Z",
      "delayBetweenEmailsMs": 2000,
      "maxEmailsPerHour": 30
    }
    ```
  - **Response (201 Created):**
    ```json
    {
      "ids": ["e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c", "f2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d"],
      "count": 2
    }
    ```

- **GET `/api/emails?status=scheduled&search=john&page=1&limit=20`**
  - **Auth:** JWT
  - **Query Params:** `status` (`scheduled` \| `sent` \| `failed`), `search` (full-text search query), `page` (default 1), `limit` (default 20).
  - **Response (200 OK):**
    ```json
    {
      "items": [
        {
          "id": "e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
          "userId": "c1f7a08b-1e24-4f4d-b98a-1a2b3c4d5e6f",
          "senderId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d5e6f",
          "recipientEmail": "alice@example.com",
          "subject": "Product Update",
          "body": "Hello Alice...",
          "scheduledAt": "2026-08-31T10:00:00.000Z",
          "status": "scheduled",
          "sentAt": null,
          "previewUrl": null,
          "error": null,
          "createdAt": "2026-08-31T09:00:00.000Z"
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 20
    }
    ```

- **GET `/api/emails/:id`**
  - **Auth:** JWT
  - **Response (200 OK):** Returns single `EmailRow` object.

#### 5. Slack Integration Routes
- **GET `/api/slack/oauth/authorize`**
  - **Auth:** JWT
  - **Behavior:** 302 Redirect to Slack OAuth authorization page.

- **GET `/api/slack/oauth/callback?code=...&state=...`**
  - **Auth:** Public (validates state JWT)
  - **Behavior:** Exchanges code, saves bot token/webhook to `slack_integrations`, 302 redirects to `OAUTH_SUCCESS_REDIRECT?slack=connected`.

- **GET `/api/slack/integration`**
  - **Auth:** JWT
  - **Response (200 OK):**
    ```json
    {
      "connected": true,
      "teamName": "Acme Corp",
      "channelId": "C12345678",
      "webhookUrl": "https://hooks.slack.com/services/...",
      "connectedAt": "2026-08-31T08:00:00.000Z"
    }
    ```

- **POST `/api/slack/webhook`**
  - **Auth:** JWT
  - **Request Body:** `{ "webhookUrl": "https://hooks.slack.com/services/..." }`
  - **Response (200 OK):** `{ "connected": true, "webhookUrl": "..." }`

- **DELETE `/api/slack/integration`**
  - **Auth:** JWT
  - **Response (200 OK):** `{ "connected": false }`

---

## 4. Database Schema

Defined in `src/db/schema/` using Drizzle ORM for PostgreSQL.

```
+--------------------+            +--------------------+            +--------------------+
|       users        |            |      senders       |            |       emails       |
+--------------------+            +--------------------+            +--------------------+
| id (PK)            |<──┐        | id (PK)            |<──┐        | id (PK)            |
| google_id (UNIQUE) |   ├───────<| user_id (FK)       |   └───────<| sender_id (FK)     |
| email              |   │        | email              |            | user_id (FK) ──────┼──┐
| name               |   │        | display_name       |            | recipient_email    |  │
| avatar_url         |   │        | max_emails_per_hour|            | subject            |  │
| created_at         |   │        +--------------------+            | body               |  │
+--------------------+   │                                          | scheduled_at       |  │
                         │        +--------------------+            | status             |  │
                         │        | slack_integrations |            | sent_at            |  │
                         │        +--------------------+            | preview_url        |  │
                         │        | id (PK)            |            | error              |  │
                         └───────<| user_id (FK, UNIQUE)            | created_at         |  │
                                  | webhook_url        |            +--------------------+  │
                                  | access_token       |                                    │
                                  | team_name          |                                    │
                                  | channel_id         |                                    │
                                  | connected_at       |                                    │
                                  +--------------------+                                    │
                                             ^                                              │
                                             └──────────────────────────────────────────────┘
```

### Table Definitions

#### 1. `users` (`src/db/schema/users.ts`)
- `id` (`uuid`, Primary Key, `defaultRandom()`)
- `google_id` (`text`, NOT NULL, Unique Index `users_google_id_idx`)
- `email` (`text`, NOT NULL)
- `name` (`text`, NOT NULL)
- `avatar_url` (`text`, Nullable)
- `created_at` (`timestamp with time zone`, NOT NULL, `defaultNow()`)

#### 2. `senders` (`src/db/schema/senders.ts`)
- `id` (`uuid`, Primary Key, `defaultRandom()`)
- `user_id` (`uuid`, NOT NULL, Foreign Key ➔ `users.id` `ON DELETE CASCADE`)
- `email` (`text`, NOT NULL)
- `display_name` (`text`, NOT NULL)
- `max_emails_per_hour` (`integer`, Nullable — per-sender hourly cap override)

#### 3. `emails` (`src/db/schema/emails.ts`)
- `id` (`uuid`, Primary Key, `defaultRandom()`)
- `user_id` (`uuid`, NOT NULL, Foreign Key ➔ `users.id` `ON DELETE CASCADE`)
- `sender_id` (`uuid`, NOT NULL, Foreign Key ➔ `senders.id` `ON DELETE RESTRICT`)
- `recipient_email` (`text`, NOT NULL)
- `subject` (`text`, NOT NULL)
- `body` (`text`, NOT NULL)
- `scheduled_at` (`timestamp with time zone`, NOT NULL)
- `status` (`text`, NOT NULL — `"scheduled"` \| `"sent"` \| `"failed"`)
- `sent_at` (`timestamp with time zone`, Nullable)
- `preview_url` (`text`, Nullable)
- `error` (`text`, Nullable)
- `createdAt` (`timestamp with time zone`, NOT NULL, `defaultNow()`)

#### 4. `slack_integrations` (`src/db/schema/slackIntegrations.ts`)
- `id` (`uuid`, Primary Key, `defaultRandom()`)
- `user_id` (`uuid`, NOT NULL, Unique Index `slack_integrations_user_id_idx`, Foreign Key ➔ `users.id` `ON DELETE CASCADE`)
- `webhook_url` (`text`, Nullable)
- `access_token` (`text`, Nullable)
- `team_name` (`text`, Nullable)
- `channel_id` (`text`, Nullable)
- `connected_at` (`timestamp with time zone`, NOT NULL, `defaultNow()`)

---

## 5. Queue & Worker Behavior

### Configuration Values
- **Queue Name:** `"email-send"` (`EMAIL_QUEUE_NAME` in `src/config/constants.ts` & `src/queues/queue.connection.ts`).
- **Job Name:** `"send"`.
- **Job Data Payload:**
  ```typescript
  export type EmailJobData = {
    emailId: string;
    userId: string;
    senderId: string;
  };
  ```
- **Worker Concurrency:** Set via `env.WORKER_CONCURRENCY` (Default `5`).
- **Worker Rate Limiter:** Set via `env.MIN_SEND_DELAY_MS` (Default `2000`ms — max 1 send per 2000ms per worker instance).
- **Default Job Options:**
  ```typescript
  defaultJobOptions: {
    attempts: 1, // Failures are marked 'failed' in Postgres, never retried blindly
    removeOnComplete: 1000,
    removeOnFail: 5000,
  }
  ```

---

### Step-by-Step Hourly Rate Limiting Logic

1. **Limit Precedence Resolution:**
   `resolveHourlyLimit(sender)` evaluates limits in strict precedence order:
   - `sender.maxEmailsPerHour` (if explicitly set on sender record)
   - `env.MAX_EMAILS_PER_HOUR_PER_SENDER` (if set in env)
   - `env.MAX_EMAILS_PER_HOUR` (default fallback, `30`).

2. **Atomic Lua Evaluation (`TAKE_SLOT_LUA`):**
   ```lua
   local current = tonumber(redis.call('GET', KEYS[1]) or '0')
   if current >= tonumber(ARGV[1]) then
     return {0, current}
   end
   local n = redis.call('INCR', KEYS[1])
   if n == 1 then
     redis.call('EXPIRE', KEYS[1], 3600)
   end
   return {1, n}
   ```
   - Key evaluated: `ratelimit:{senderId}:{yyyy-MM-dd-HH}`.
   - If count `>=` resolved limit, returns `{0, count}` **without** incrementing.
   - If count `<` limit, increments counter and sets TTL (`3600`s) if `n == 1`.

3. **Rescheduling on Limit Hit:**
   - When `allowed === false`, the worker calculates `nextWindow = nextUtcHourStart()`.
   - The job is **not** marked failed or dropped.
   - Reschedule offset calculated via `delayedTimestampForNextWindow(scheduledAt)`:
     `nextUtcHourStart + (scheduledAt.getTime() % 3600000)` (preserves relative stagger from original schedule).
   - Worker calls `await job.moveToDelayed(when, token)` and throws `new DelayedError()`.

4. **Slack Alert Notification:**
   - On limit hit, worker calls `claimSlackNotify(senderId, window)` which runs `SET slackNotified:{senderId}:{window} 1 EX 3600 NX`.
   - If the operation returns `OK` (first job throttled in this hour), the winner triggers `notifySenderHourlyLimit()`.
   - Queries `slack_integrations` from PostgreSQL dynamically at event time (no stale boot cache).
   - Posts alert message: `⚠️ <Sender Label> hit its hourly limit of <limit> — remaining emails rescheduled to <ISO Date>`.
   - Delivered via Webhook (`sendSlackWebhook`) or Chat API (`sendSlackChatMessage`).

---

## 6. Frontend Structure

Built with Next.js 14 (App Router), React, TypeScript, and TailwindCSS.

### App Router Pages (`frontend/src/app/`)

- `src/app/layout.tsx`: Root HTML layout wrapping `ToastProvider`.
- `src/app/page.tsx`: Index page; checks JWT token and redirects to `/dashboard` if logged in, otherwise `/login`.
- `src/app/login/page.tsx`: Login page featuring Google OAuth button and Dev Login input.
- `src/app/auth/callback/page.tsx`: Handles Google OAuth redirect callback, extracts `token` query param, stores session, and redirects to `/dashboard`.
- `src/app/dashboard/page.tsx`: Main application dashboard. Renders tabbed view (`Scheduled` vs `Sent`), search bar, email list tables, and pagination controls. Includes silent background polling (every 3.5s) to auto-update email states without flickering.
- `src/app/compose/page.tsx`: Full-page view wrapper for `ComposeModal`.
- `src/app/dashboard/emails/[id]/page.tsx`: Single email detail page displaying email headers, full body, error logs, and the **Open Ethereal preview** button.
- `src/app/slack/connect/route.ts`: Server-side API route (`force-dynamic`); extracts `rib_token` cookie, passes Bearer auth header to backend `/api/slack/oauth/authorize`, and redirects browser to Slack.

---

### Reusable Components (`frontend/src/components/`)

#### UI Primitives (`components/ui/`)
- `Badge.tsx`: Styled inline status pill badge.
- `Button.tsx`: Reusable button supporting `primary`, `google`, `outline`, `ghost`, and `pill` variants, plus `sm`, `md`, `lg` sizes.
- `Input.tsx`: Form text input primitive with label and error state support.
- `Modal.tsx`: Accessible dialog modal component with optional title header.
- `Pagination.tsx`: Pagination controls component.
- `Table.tsx`: Generic typed table component supporting custom column renderers and row click handlers.
- `Tabs.tsx`: Tab selection bar for switching navigation contexts.
- `Textarea.tsx`: Styled multiline text input component.
- `Toast.tsx`: Global toast notification provider and hook (`useToast`).

#### Layout Components (`components/layout/`)
- `AppShell.tsx`: Primary application layout shell composing top header (with custom `Pixelify_Sans` logo), search bar, `Sidebar`, and `ConnectSlackModal`.
- `LogoutButton.tsx`: Standalone red destructive action logout button.
- `Sidebar.tsx`: Left navigation sidebar featuring user profile, Compose button, Scheduled/Sent tabs, Slack button, Queue Dashboard link, and Logout.
- `UserProfile.tsx`: User avatar and profile display component.

#### Email Components (`components/emails/`)
- `ComposeModal.tsx`: Rich email composer modal supporting single/bulk recipients, CSV file parsing (PapaParse), subject, body editor, delay settings, and immediate/delayed delivery picker.
- `EtherealLinkButton.tsx`: Styled preview button linking directly to external Ethereal webmail.
- `ListStates.tsx`: Empty list and skeleton loading placeholder states (`EmptyList`, `ListSkeleton`).
- `ScheduledTable.tsx`: Table view rendering scheduled email rows with recipient, status badge, subject snippet, and schedule date.
- `SentTable.tsx`: Table view rendering sent and failed email rows.
- `StatusBadge.tsx`: Color-coded status badge (`scheduled` = mint/green, `sent` = blue/brand, `failed` = red).

#### Slack Components (`components/slack/`)
- `ConnectSlackButton.tsx`: Sidebar button displaying live Slack connection status indicator.
- `ConnectSlackModal.tsx`: Dialog modal offering two connect options: standard Slack OAuth redirect or custom Slack Webhook URL input.
- `SlackStatusPopover.tsx`: Popover displaying connected Slack team name and channel details.

---

### State Management & Utilities (`frontend/src/lib/` & `frontend/src/hooks/`)

- `src/lib/api.ts`: Typed fetch wrapper (`apiGet`, `apiPost`, `apiDelete`) injecting `Authorization: Bearer <token>` and enforcing `cache: "no-store"`.
- `src/lib/auth.ts`: Token and session persistence (`rib_token` and `rib_user` in `localStorage` and `document.cookie`).
- `src/lib/format.ts`: Date and email display formatting utilities (`formatSentAt`, `displayNameFromEmail`).
- `src/hooks/useAuth.ts`: Custom hook managing authentication lifecycle.
- `src/hooks/useEmails.ts`: Custom hook handling email list fetching and state.
- `src/hooks/usePagination.ts`: Reusable pagination state hook.
- `src/hooks/useSlackStatus.ts`: Custom hook managing live Slack integration connection state.

---

## 7. Environment Variables Reference

### Backend Environment Variables (`backend/src/config/env.ts`)

| Variable | Default Value | Required | Purpose |
|---|---|---|---|
| `PORT` | `3000` | No | HTTP server port |
| `NODE_ENV` | `"development"` | No | Execution environment (`development` \| `production`) |
| `LOG_LEVEL` | `"info"` | No | Pino logger verbosity level |
| `API_BASE_URL` | `"http://localhost:3000"` | No | Public base URL of backend API |
| `JWT_SECRET` | `"change-me-..."` | **Yes** | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | `"7d"` | No | JWT token expiration duration |
| `DEV_AUTH_ENABLED` | `false` | No | Enable `POST /api/auth/dev` bypass (`true` in dev) |
| `ADMIN_TOKEN` | `undefined` | No | Optional secret token gating Bull Board `/admin/queues` |
| `DATABASE_URL` | `"postgres://..."` | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | `"redis://localhost:6379"` | No | Redis connection string for BullMQ & rate limits |
| `ELASTICSEARCH_URL` | `"http://localhost:9200"` | No | Elasticsearch service URL |
| `ELASTICSEARCH_INDEX` | `"emails"` | No | Elasticsearch index name |
| `WORKER_CONCURRENCY` | `5` | No | BullMQ worker concurrent job execution limit |
| `MIN_SEND_DELAY_MS` | `2000` | No | Minimum delay between SMTP sends per worker instance |
| `MAX_EMAILS_PER_HOUR` | `30` | No | Global hourly rate limit per sender default cap |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `undefined` | No | Optional environment-wide per-sender cap override |
| `GOOGLE_CLIENT_ID` | `undefined` | No | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | `undefined` | No | Google OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | `"http://localhost:3000/..."` | No | Google OAuth redirect URI |
| `SLACK_CLIENT_ID` | `undefined` | No | Slack App Client ID |
| `SLACK_CLIENT_SECRET` | `undefined` | No | Slack App Client Secret |
| `SLACK_CALLBACK_URL` | `"http://localhost:3000/..."` | No | Slack OAuth redirect URI |
| `SLACK_SCOPES` | `"incoming-webhook,chat:write"`| No | Requested Slack OAuth permission scopes |
| `OAUTH_SUCCESS_REDIRECT` | `"http://localhost:3001/..."` | No | Frontend URL for post-OAuth redirect |

---

### Frontend Environment Variables (`frontend/src/config/constants.ts`)

| Variable | Default Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `"http://localhost:3000"` | Base URL of backend API accessed by client |
| `NEXT_PUBLIC_APP_URL` | `"http://localhost:3001"` | Base URL of Next.js frontend application |

---

## 8. Setup & Run Instructions

### Local Development Setup

#### 1. Prerequisites
- Node.js v18+ and `npm`
- Docker Desktop (with Docker Compose)

#### 2. Backend Execution
```bash
cd backend
copy .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev
```
In a second terminal window (inside `backend/`):
```bash
npm run worker
```

#### 3. Frontend Execution
```bash
cd frontend
npm install
npm run dev
```
Access the application at **[http://localhost:3001](http://localhost:3001)**.

---

### Production Deployment Topology

```
+---------------------------+              +---------------------------+
|          VERCEL           |              |       RAILWAY / FLY       |
|    (Next.js Frontend)     |              |     (Express API Node)    |
+-------------+-------------+              +-------------+-------------+
              |                                          |
              v                                          v
+---------------------------+              +---------------------------+
|    MANAGED POSTGRESQL     |              |    RAILWAY / DOCKER       |
|  (Neon / Supabase / AWS)  |              |    (BullMQ Worker Node)   |
+---------------------------+              +-------------+-------------+
                                                         |
                                                         v
                                           +---------------------------+
                                           |       MANAGED REDIS       |
                                           |  (Upstash / Redis Cloud)  |
                                           +---------------------------+
```

1. **Frontend (Vercel):** Deploy `frontend/` as a Next.js application with `NEXT_PUBLIC_API_URL` set to the API domain.
2. **Express API Server (Railway / Render / AWS ECS):** Deploy `backend/` as a web service running `npm start` (`src/server.ts`).
3. **BullMQ Worker (Railway / Render Background Worker):** Deploy `backend/` as a background worker process running `npm run worker` (`src/worker.ts`).
4. **Data Layer:**
   - **PostgreSQL:** Managed PostgreSQL instance (Neon, Supabase, or AWS RDS).
   - **Redis:** Managed Redis cluster with persistence enabled (Upstash or Redis Cloud).
   - **Elasticsearch / OpenSearch:** Elastic Cloud, Bonsai, or AWS OpenSearch Service.

---

## 9. Known Limitations & Trade-offs

1. **SMTP Transport (Ethereal Sandbox):**
   - *Current Implementation:* Uses Nodemailer with Ethereal test accounts created dynamically on boot (`createTestAccount()`).
   - *Trade-off:* Ethereal emails are not delivered to real inboxes, but return valid webmail preview URLs (`previewUrl`). For production, replace `src/lib/smtp.ts` with AWS SES, SendGrid, or Postmark SMTP configuration.
2. **Elasticsearch Docker Memory Requirements on Windows:**
   - *Constraint:* Running Elasticsearch 8 in Docker on Windows requires raising WSL2 virtual memory limits (`sysctl -w vm.max_map_count=262144`). If unconfigured, the ES container exits on startup.
   - *Fallback:* The search service gracefully falls back to PostgreSQL `ILIKE` queries if Elasticsearch is unreachable.
3. **Worker Delay Granularity:**
   - *Implementation:* `MIN_SEND_DELAY_MS` (default 2000ms) enforces throttling per worker process.
   - *Trade-off:* High concurrency with multiple worker instances scales throughput horizontally, while individual worker instances limit send bursts to protect Nodemailer/Ethereal sockets.
4. **Slack Notification Deduplication Window:**
   - *Implementation:* Slack alert deduplication key `slackNotified:{senderId}:{window}` uses a 1-hour TTL (`EX 3600`).
   - *Behavior:* If a sender remains throttled across multiple consecutive hours, exactly 1 alert is sent per hour window.

---

## 10. Testing & Verification

The codebase includes targeted verification scripts in `scripts/`:

### 1. Atomic Rate Limit Verification Script
- **Script:** `backend/scripts/test-rate-limit.ts`
- **Command:** `npm run test:rate-limit` (inside `backend/`)
- **What it verifies:**
  - Evaluates the atomic Lua rate-limiting script against Redis.
  - Verifies that exactly `limit` sends are allowed (`INCR`), and subsequent requests in the window are rejected without incrementing the counter.
  - Verifies key TTL creation (`EXPIRE 3600`) and Slack deduplication flag setting (`SET NX`).

### 2. Elasticsearch Backfill Script
- **Script:** `backend/scripts/backfill-elasticsearch.ts`
- **Command:** `npm run backfill:es` (inside `backend/`)
- **What it verifies:**
  - Ensures the `emails` index exists in Elasticsearch with correct mappings.
  - Queries all email records from PostgreSQL and indexes/re-indexes them into Elasticsearch in bulk.

### 3. Database Seed Script
- **Script:** `backend/scripts/seed.ts`
- **Command:** `npm run seed` (inside `backend/`)
- **What it verifies:**
  - Populates PostgreSQL with test user, sender, and initial email records for manual testing.
