import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { emails, senders } from "../db/schema.js";
import { enqueueEmailJob } from "../queues/email.queue.js";
import { indexEmail } from "../lib/elasticsearch.js";
import { logger } from "../lib/logger.js";

export async function scheduleEmails(opts: {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenEmailsMs: number;
  maxEmailsPerHour?: number;
}): Promise<{ ids: string[]; count: number }> {
  const unique = [...new Set(opts.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) {
    throw Object.assign(new Error("At least one recipient is required"), { status: 400 });
  }

  const [sender] = await db
    .select()
    .from(senders)
    .where(and(eq(senders.id, opts.senderId), eq(senders.userId, opts.userId)))
    .limit(1);

  if (!sender) {
    throw Object.assign(new Error("Sender not found"), { status: 404 });
  }

  if (opts.maxEmailsPerHour != null && opts.maxEmailsPerHour > 0) {
    await db
      .update(senders)
      .set({ maxEmailsPerHour: opts.maxEmailsPerHour })
      .where(eq(senders.id, sender.id));
  }

  const insertedIds: string[] = [];

  for (let i = 0; i < unique.length; i++) {
    const scheduledAt = new Date(opts.startTime.getTime() + i * opts.delayBetweenEmailsMs);
    const [row] = await db
      .insert(emails)
      .values({
        userId: opts.userId,
        senderId: sender.id,
        recipientEmail: unique[i]!,
        subject: opts.subject,
        body: opts.body,
        scheduledAt,
        status: "scheduled",
      })
      .returning();

    if (!row) continue;
    insertedIds.push(row.id);

    try {
      await indexEmail(row);
    } catch (err) {
      logger.warn({ err, emailId: row.id }, "ES index on schedule failed (non-fatal)");
    }

    await enqueueEmailJob({
      emailId: row.id,
      userId: opts.userId,
      senderId: sender.id,
      scheduledAt,
    });
  }

  return { ids: insertedIds, count: insertedIds.length };
}
