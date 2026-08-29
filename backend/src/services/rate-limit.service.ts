import { redis } from "../lib/redis.js";
import { env } from "../config/env.js";
import type { Sender } from "../db/schema/index.js";

/**
 * Atomic take-or-reject. Does not increment when already at/over the limit.
 *
 * KEYS[1] = ratelimit:{senderId}:{yyyy-MM-dd-HH}
 * ARGV[1] = limit
 *
 * Returns [1, newCount] if a slot was taken, [0, current] if at capacity.
 * EXPIRE 3600 is set only when the key is first created (INCR == 1).
 */
const TAKE_SLOT_LUA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= tonumber(ARGV[1]) then
  return {0, current}
end
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], 3600)
end
return {1, n}
`;

export function utcHourWindow(at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  const h = String(at.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d}-${h}`;
}

export function nextUtcHourStart(at: Date = new Date()): Date {
  const next = new Date(Date.UTC(
    at.getUTCFullYear(),
    at.getUTCMonth(),
    at.getUTCDate(),
    at.getUTCHours() + 1,
    0,
    0,
    0,
  ));
  return next;
}

export function rateLimitKey(senderId: string, window: string): string {
  return `ratelimit:${senderId}:${window}`;
}

export function slackNotifiedKey(senderId: string, window: string): string {
  return `slackNotified:${senderId}:${window}`;
}

export function resolveHourlyLimit(sender: Sender): number {
  if (sender.maxEmailsPerHour != null && sender.maxEmailsPerHour > 0) {
    return sender.maxEmailsPerHour;
  }
  if (env.MAX_EMAILS_PER_HOUR_PER_SENDER != null) {
    return env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  }
  return env.MAX_EMAILS_PER_HOUR;
}

export async function tryTakeSendSlot(
  senderId: string,
  limit: number,
  at: Date = new Date(),
): Promise<{ allowed: boolean; count: number; window: string }> {
  const window = utcHourWindow(at);
  const key = rateLimitKey(senderId, window);
  const result = await redis.eval(TAKE_SLOT_LUA, 1, key, String(limit)) as [number, number];
  const allowed = Number(result[0]) === 1;
  const count = Number(result[1]);
  return { allowed, count, window };
}

/** SET NX flag so only the first throttle in a window notifies Slack. */
export async function claimSlackNotify(senderId: string, window: string): Promise<boolean> {
  const ok = await redis.set(slackNotifiedKey(senderId, window), "1", "EX", 3600, "NX");
  return ok === "OK";
}

/**
 * Preserve relative order when bumping to the next hour:
 * nextWindowStart + (scheduledAt ms-of-hour).
 */
export function delayedTimestampForNextWindow(scheduledAt: Date, now = new Date()): number {
  const next = nextUtcHourStart(now).getTime();
  const offsetInHour = scheduledAt.getTime() % 3_600_000;
  return next + offsetInHour;
}

export { TAKE_SLOT_LUA };
