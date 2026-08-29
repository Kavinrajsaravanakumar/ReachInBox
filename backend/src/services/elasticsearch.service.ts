import { esClient } from "../lib/elasticsearch.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { EmailRow } from "../db/schema/index.js";

export async function ensureEmailIndex(): Promise<void> {
  const index = env.ELASTICSEARCH_INDEX;
  const exists = await esClient.indices.exists({ index });
  if (exists) return;
  await esClient.indices.create({
    index,
    mappings: {
      properties: {
        userId: { type: "keyword" },
        senderId: { type: "keyword" },
        recipientEmail: { type: "text", fields: { raw: { type: "keyword" } } },
        subject: { type: "text" },
        body: { type: "text" },
        status: { type: "keyword" },
        scheduledAt: { type: "date" },
        sentAt: { type: "date" },
        createdAt: { type: "date" },
        previewUrl: { type: "keyword", index: false },
        error: { type: "text" },
      },
    },
  });
  logger.info({ index }, "Elasticsearch index created");
}

export async function indexEmail(row: EmailRow): Promise<void> {
  await esClient.index({
    index: env.ELASTICSEARCH_INDEX,
    id: row.id,
    document: {
      userId: row.userId,
      senderId: row.senderId,
      recipientEmail: row.recipientEmail,
      subject: row.subject,
      body: row.body,
      status: row.status,
      scheduledAt: row.scheduledAt.toISOString(),
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      previewUrl: row.previewUrl,
      error: row.error,
    },
    refresh: false,
  });
}

export async function searchEmails(opts: {
  userId: string;
  query: string;
  status?: string;
  from: number;
  size: number;
}): Promise<{ ids: string[]; total: number }> {
  const filters: object[] = [{ term: { userId: opts.userId } }];
  if (opts.status) {
    filters.push({ term: { status: opts.status } });
  }

  const result = await esClient.search({
    index: env.ELASTICSEARCH_INDEX,
    from: opts.from,
    size: opts.size,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: opts.query,
              fields: ["subject", "body", "recipientEmail"],
              fuzziness: "AUTO",
            },
          },
        ],
        filter: filters,
      },
    },
  });

  const hits = result.hits.hits;
  const total = typeof result.hits.total === "number"
    ? result.hits.total
    : result.hits.total?.value ?? 0;

  return {
    ids: hits.map((h) => String(h._id)),
    total,
  };
}
