import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { emails } from "../db/schema/index.js";
import { indexEmail } from "../services/elasticsearch.service.js";
import { logger } from "../utils/logger.js";

export async function markEmailFailed(emailId: string, error: string): Promise<void> {
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
