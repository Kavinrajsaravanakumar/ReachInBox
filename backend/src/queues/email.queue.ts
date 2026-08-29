import { Queue } from "bullmq";
import { bullConnection, EMAIL_QUEUE_NAME, type EmailJobData } from "./queue.connection.js";
import { logger } from "../utils/logger.js";

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function enqueueEmailJob(opts: {
  emailId: string;
  userId: string;
  senderId: string;
  scheduledAt: Date;
}): Promise<"added" | "exists"> {
  const delay = Math.max(0, opts.scheduledAt.getTime() - Date.now());
  const data: EmailJobData = {
    emailId: opts.emailId,
    userId: opts.userId,
    senderId: opts.senderId,
  };

  const existing = await emailQueue.getJob(opts.emailId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "completed" && state !== "failed" && state !== "unknown") {
      return "exists";
    }
    try {
      await existing.remove();
    } catch {
      return "exists";
    }
  }

  try {
    await emailQueue.add("send", data, {
      jobId: opts.emailId,
      delay,
    });
    return "added";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already (exists|in the queue)/i.test(msg) || /JobId/i.test(msg)) {
      logger.debug({ emailId: opts.emailId }, "job already queued (idempotent no-op)");
      return "exists";
    }
    throw err;
  }
}
