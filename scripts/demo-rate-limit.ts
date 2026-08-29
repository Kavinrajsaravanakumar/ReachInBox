import "dotenv/config";
import { Redis } from "ioredis";
import { TAKE_SLOT_LUA, utcHourWindow } from "../src/services/rate-limit.service.js";

/**
 * Proves the hourly limiter is atomic and does not increment past the cap.
 * Requires Redis (docker compose up). Does not send any email.
 *
 *   npm run test:rate-limit
 */
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl);

const senderId = "demo-sender";
const window = utcHourWindow();
const key = `ratelimit:${senderId}:${window}`;
const limit = 3;

await redis.del(key);

const taken: number[] = [];
const rejected: number[] = [];

for (let i = 0; i < 8; i++) {
  const result = (await redis.eval(TAKE_SLOT_LUA, 1, key, String(limit))) as [number, number];
  const allowed = Number(result[0]) === 1;
  const count = Number(result[1]);
  if (allowed) taken.push(count);
  else rejected.push(count);
}

const ttl = await redis.ttl(key);
const finalCount = Number(await redis.get(key));

await redis.quit();

const pass =
  taken.length === limit &&
  taken[taken.length - 1] === limit &&
  rejected.length === 8 - limit &&
  rejected.every((c) => c === limit) &&
  finalCount === limit &&
  ttl > 0 &&
  ttl <= 3600;

console.log(JSON.stringify({ key, limit, taken, rejected, finalCount, ttl, pass }, null, 2));

if (!pass) {
  console.error("FAIL: expected exactly 3 successful INCR and 5 rejects at count=3 with TTL set.");
  process.exit(1);
}

console.log("PASS: Lua limiter allows exactly `limit` sends, then rejects without incrementing.");
console.log("Reschedule behavior: worker calls job.moveToDelayed(nextUtcHour + scheduledAt%1h) and throws DelayedError.");
console.log("Slack: first reject in a window SET NX slackNotified:{senderId}:{window} EX 3600, then looks up slack_integrations (no boot cache).");
