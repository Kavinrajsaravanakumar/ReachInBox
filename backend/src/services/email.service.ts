import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { emails, senders, type EmailRow } from "../db/schema/index.js";
import { enqueueEmailJob } from "../queues/email.queue.js";
import { indexEmail, searchEmails } from "./elasticsearch.service.js";
import { logger } from "../utils/logger.js";
import { AppError, BadRequestError, NotFoundError } from "../utils/errors.js";

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
    throw new BadRequestError("At least one recipient is required");
  }

  const [sender] = await db
    .select()
    .from(senders)
    .where(and(eq(senders.id, opts.senderId), eq(senders.userId, opts.userId)))
    .limit(1);

  if (!sender) {
    throw new NotFoundError("Sender not found");
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

export async function listEmails(opts: {
  userId: string;
  status?: "scheduled" | "sent" | "failed";
  search?: string;
  page: number;
  limit: number;
}): Promise<{ items: EmailRow[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, opts.page);
  const limit = Math.min(100, Math.max(1, opts.limit));
  const offset = (page - 1) * limit;

  if (opts.search && opts.search.trim().length > 0) {
    const term = opts.search.trim();
    try {
      const { ids, total } = await searchEmails({
        userId: opts.userId,
        query: term,
        status: opts.status,
        from: offset,
        size: limit,
      });
      if (ids.length > 0) {
        const rows = await db.select().from(emails).where(
          and(eq(emails.userId, opts.userId), inArray(emails.id, ids)),
        );
        const byId = new Map(rows.map((r) => [r.id, r]));
        const items = ids.map((id) => byId.get(id)).filter((r): r is EmailRow => Boolean(r));
        return { items, total, page, limit };
      }
    } catch (err) {
      logger.warn({ err }, "Elasticsearch search failed, falling back to database search");
    }

    // Database ILIKE fallback search
    const pattern = `%${term}%`;
    const searchConditions = [
      eq(emails.userId, opts.userId),
      sql`(${emails.subject} ILIKE ${pattern} OR ${emails.body} ILIKE ${pattern} OR ${emails.recipientEmail} ILIKE ${pattern})`,
    ];
    if (opts.status) {
      searchConditions.push(eq(emails.status, opts.status));
    }
    const whereClause = and(...searchConditions);
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emails)
      .where(whereClause);
    const count = countRows[0]?.count ?? 0;
    const items = await db
      .select()
      .from(emails)
      .where(whereClause)
      .orderBy(desc(emails.scheduledAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  }

  const conditions = [eq(emails.userId, opts.userId)];
  if (opts.status) {
    conditions.push(eq(emails.status, opts.status));
  }

  const where = and(...conditions);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emails)
    .where(where);
  const count = countRows[0]?.count ?? 0;

  const items = await db
    .select()
    .from(emails)
    .where(where)
    .orderBy(desc(emails.scheduledAt))
    .limit(limit)
    .offset(offset);

  return { items, total: count ?? 0, page, limit };
}

export async function getEmailById(id: string, userId: string): Promise<EmailRow | null> {
  const [row] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.userId, userId)))
    .limit(1);
  return row ?? null;
}
