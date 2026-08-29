import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { emails, type EmailRow } from "../db/schema.js";
import { searchEmails } from "../lib/elasticsearch.js";

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
    const { ids, total } = await searchEmails({
      userId: opts.userId,
      query: opts.search.trim(),
      status: opts.status,
      from: offset,
      size: limit,
    });
    if (ids.length === 0) {
      return { items: [], total, page, limit };
    }
    const rows = await db.select().from(emails).where(
      and(eq(emails.userId, opts.userId), inArray(emails.id, ids)),
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.map((id) => byId.get(id)).filter((r): r is EmailRow => Boolean(r));
    return { items, total, page, limit };
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
