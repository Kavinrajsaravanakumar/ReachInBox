import { db } from "../src/db/index.js";
import { emails } from "../src/db/schema/index.js";
import { ensureEmailIndex, indexEmail } from "../src/services/elasticsearch.service.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  logger.info("Starting Elasticsearch email backfill...");
  await ensureEmailIndex();

  const allEmails = await db.select().from(emails);
  logger.info({ count: allEmails.length }, "Fetched emails from PostgreSQL");

  let indexedCount = 0;
  for (const email of allEmails) {
    try {
      await indexEmail(email);
      indexedCount++;
    } catch (err) {
      logger.error({ err, emailId: email.id }, "Failed to index email in ES");
    }
  }

  logger.info({ indexedCount, total: allEmails.length }, "Elasticsearch backfill complete!");
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, "Backfill script failed");
  process.exit(1);
});
