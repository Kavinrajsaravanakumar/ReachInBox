# Manual test plan (Windows PowerShell)

Requires Docker Desktop, Node 20+, and two terminals.

## 0. Boot infrastructure

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run migrate
```

## 1. Start API + worker

Terminal A:

```powershell
npm run dev
```

Terminal B:

```powershell
npm run worker
```

Confirm `GET http://localhost:3000/health` returns `{ ok: true }`.
Queue UI: http://localhost:3000/admin/queues

## 2. Auth (local, no Google)

```powershell
$auth = Invoke-RestMethod -Method POST http://localhost:3000/api/auth/dev `
  -ContentType application/json `
  -Body '{"email":"qa@localhost","name":"QA"}'
$token = $auth.token
$headers = @{ Authorization = "Bearer $token" }
```

## 3. Register a sender (low hourly cap so rate-limit is easy to hit)

```powershell
$sender = Invoke-RestMethod -Method POST http://localhost:3000/api/senders `
  -Headers $headers -ContentType application/json `
  -Body '{"email":"qa@example.com","displayName":"QA Sender","maxEmailsPerHour":2}'
$senderId = $sender.id
```

## 4. Schedule several emails for "now" (small batch — do not send 1000)

```powershell
$start = (Get-Date).ToUniversalTime().ToString("o")
$schedule = Invoke-RestMethod -Method POST http://localhost:3000/api/emails/schedule `
  -Headers $headers -ContentType application/json `
  -Body (@{
    senderId = $senderId
    subject = "Hello"
    body = "ReachInbox test body searchable"
    recipients = @("a@example.com","b@example.com","c@example.com","d@example.com","e@example.com")
    startTime = $start
    delayBetweenEmailsMs = 0
    maxEmailsPerHour = 2
  } | ConvertTo-Json)
$schedule
```

Expect 5 UUIDs. Watch Terminal B: two sends succeed (Ethereal preview URLs), remaining jobs `moveToDelayed` into the next UTC hour. First throttle in the window may attempt Slack (silently skipped if Slack is not connected).

```powershell
Invoke-RestMethod "http://localhost:3000/api/emails?status=sent" -Headers $headers
Invoke-RestMethod "http://localhost:3000/api/emails?search=ReachInbox" -Headers $headers
```

## 5. Restart survival (no duplicates, no lost jobs)

While delayed/waiting jobs remain (or schedule another 3 with `maxEmailsPerHour` high enough to send slowly):

```powershell
# In Terminal B: Ctrl+C to stop the worker, then:
npm run worker
```

Jobs still in Redis resume automatically at their original `scheduled_at`.
Boot reconciliation re-enqueues only `status=scheduled` rows whose BullMQ `jobId` (row UUID) is missing — add is a no-op if the job already exists.

Confirm no duplicate sends:

```powershell
Invoke-RestMethod "http://localhost:3000/api/emails?limit=50" -Headers $headers
```

Each recipient should have a single row; `sent` rows stay `sent`; remaining stay `scheduled` until their delayed job fires. Redis rate-limit keys `ratelimit:{senderId}:{yyyy-MM-dd-HH}` persist across worker restarts (AOF enabled in docker-compose).

## 6. Slack notification (optional)

Create a Slack app, add redirect `http://localhost:3000/api/slack/oauth/callback`, set `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`, restart API, then open (while authenticated):

`http://localhost:3000/api/slack/oauth/authorize` with `Authorization: Bearer` is a GET redirect — easiest in a browser after putting the JWT in a tool, or:

```powershell
# Copy the Location after:
Invoke-WebRequest -Method GET http://localhost:3000/api/slack/oauth/authorize -Headers $headers -MaximumRedirection 0
```

Repeat step 4 with `maxEmailsPerHour: 1`. The first throttle in that hour window posts:
`⚠️ {sender} hit its hourly limit of {N} — remaining emails rescheduled to {nextWindowStart}`

A Redis flag `slackNotified:{senderId}:{window}` (TTL 1h) prevents a notification per remaining email.

## 7. Isolated limiter proof (no SMTP)

```powershell
npm run test:rate-limit
```

Must print `PASS`.
