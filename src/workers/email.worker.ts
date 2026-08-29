import { DelayedError, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { emails, senders } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { indexEmail } from "../lib/elasticsearch.js";
import { sendViaEthereal } from "../services/email.service.js";
import { EMAIL_QUEUE_NAME, createBullConnection, type EmailJobData } from "../queues/connection.js";
import {
  claimSlackNotify,
  delayedTimestampForNextWindow,
  nextUtcHourStart,
  resolveHourlyLimit,
  tryTakeSendSlot,
} from "../services/rate-limit.service.js";
import { notifySenderHourlyLimit } from "../services/slack.service.js";

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job, token) => {
      const emailId = job.data.emailId ?? job.id;
      if (!emailId) return;

      const [row] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
      if (!row) {
        logger.warn({ emailId }, "job for missing email row");
        return;
      }
      if (row.status !== "scheduled") {
        logger.info({ emailId, status: row.status }, "skip already processed email");
        return;
      }

      const [sender] = await db.select().from(senders).where(eq(senders.id, row.senderId)).limit(1);
      if (!sender) {
        await markFailed(row.id, "Sender no longer exists");
        return;
      }

      const limit = resolveHourlyLimit(sender);
      const slot = await tryTakeSendSlot(sender.id, limit);

      if (!slot.allowed) {
        const nextWindow = nextUtcHourStart();
        if (await claimSlackNotify(sender.id, slot.window)) {
          const label = `${sender.displayName} <${sender.email}>`;
          await notifySenderHourlyLimit({
            userId: row.userId,
            senderLabel: label,
            limit,
            nextWindowStart: nextWindow,
          });
        }
        const when = delayedTimestampForNextWindow(row.scheduledAt);
        await job.moveToDelayed(when, token);
        throw new DelayedError();
      }

      try {
        const { previewUrl } = await sendViaEthereal({
          sender,
          to: row.recipientEmail,
          subject: row.subject,
          body: row.body,
        });
        const sentAt = new Date();
        const [updated] = await db
          .update(emails)
          .set({ status: "sent", sentAt, previewUrl, error: null })
          .where(eq(emails.id, row.id))
          .returning();
        if (updated) {
          try {
            await indexEmail(updated);
          } catch (err) {
            logger.warn({ err, emailId }, "ES index after send failed");
          }
        }
        logger.info({ emailId, previewUrl }, "email sent");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markFailed(row.id, message);
      }
    },
    {
      connection: createBullConnection(),
      concurrency: env.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: env.MIN_SEND_DELAY_MS,
      },
    },
  );

  worker.on("error", (err) => logger.error({ err }, "worker error"));
  worker.on("failed", (job, err) => {
    if (err instanceof DelayedError || err?.message === "DelayedError") return;
    logger.warn({ jobId: job?.id, err }, "job failed");
  });

  return worker;
}

async function markFailed(emailId: string, error: string): Promise<void> {
  const [updated] = await db
    .update(emails)
    .set({ status: "failed", error })
    .where(eq(emails.id, emailId))
    .returning();
  if (updated) {
    try {
      await indexEmail(updated);
    } catch (err) {
      logger.warn({ err, emailId }, "ES index after fail failed");
    }
  }
}
