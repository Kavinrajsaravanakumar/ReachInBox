import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { emails } from "../db/schema.js";
import { enqueueEmailJob } from "../queues/email.queue.js";
import { logger } from "./logger.js";

/**
 * Re-enqueue Postgres rows still `scheduled` that have no live BullMQ job.
 * Uses the row UUID as jobId so a concurrent add is a no-op.
 */
export async function reconcileScheduledJobs(): Promise<{ scanned: number; enqueued: number }> {
  const rows = await db.select().from(emails).where(eq(emails.status, "scheduled"));
  let enqueued = 0;
  for (const row of rows) {
    const result = await enqueueEmailJob({
      emailId: row.id,
      userId: row.userId,
      senderId: row.senderId,
      scheduledAt: row.scheduledAt,
    });
    if (result === "added") enqueued += 1;
  }
  logger.info({ scanned: rows.length, enqueued }, "boot reconciliation complete");
  return { scanned: rows.length, enqueued };
}
