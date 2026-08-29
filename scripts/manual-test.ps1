# Requires API on :3000, Redis, Postgres, worker running. See scripts/manual-test.md
$ErrorActionPreference = "Stop"

$auth = Invoke-RestMethod -Method POST http://localhost:3000/api/auth/dev `
  -ContentType application/json `
  -Body '{"email":"qa@localhost","name":"QA"}'
$token = $auth.token
$headers = @{ Authorization = "Bearer $token" }

$sender = Invoke-RestMethod -Method POST http://localhost:3000/api/senders `
  -Headers $headers -ContentType application/json `
  -Body '{"email":"qa@example.com","displayName":"QA Sender","maxEmailsPerHour":2}'

$start = (Get-Date).ToUniversalTime().ToString("o")
$body = @{
  senderId = $sender.id
  subject = "Hello"
  body = "ReachInbox test body searchable"
  recipients = @("a@example.com","b@example.com","c@example.com","d@example.com","e@example.com")
  startTime = $start
  delayBetweenEmailsMs = 0
  maxEmailsPerHour = 2
} | ConvertTo-Json

$schedule = Invoke-RestMethod -Method POST http://localhost:3000/api/emails/schedule `
  -Headers $headers -ContentType application/json -Body $body

Write-Host "Scheduled $($schedule.count) emails. Watch the worker: 2 sends then reschedule."
Write-Host "Next: Ctrl+C the worker, npm run worker, then GET /api/emails — no duplicates."
$schedule | ConvertTo-Json
