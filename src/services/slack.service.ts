import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { slackIntegrations } from "../db/schema.js";
import { logger } from "../lib/logger.js";

export async function notifySenderHourlyLimit(opts: {
  userId: string;
  senderLabel: string;
  limit: number;
  nextWindowStart: Date;
}): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(slackIntegrations)
      .where(eq(slackIntegrations.userId, opts.userId))
      .limit(1);

    if (!row) return;

    const text =
      `⚠️ ${opts.senderLabel} hit its hourly limit of ${opts.limit} — ` +
      `remaining emails rescheduled to ${opts.nextWindowStart.toISOString()}`;

    if (row.webhookUrl) {
      const res = await fetch(row.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, "Slack webhook returned non-OK");
      }
      return;
    }

    if (row.accessToken && row.channelId) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          authorization: `Bearer ${row.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ channel: row.channelId, text }),
      });
      const body = await res.json() as { ok?: boolean; error?: string };
      if (!body.ok) {
        logger.warn({ error: body.error }, "Slack chat.postMessage failed");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Slack notification skipped (never fatal)");
  }
}
