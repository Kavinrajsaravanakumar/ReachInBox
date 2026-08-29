import { Redis } from "ioredis";
import { env } from "../config.js";

/** Dedicated Redis for rate-limit Lua / flags. BullMQ uses a separate connection. */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});
