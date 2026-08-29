import { logger } from "./utils/logger.js";
import { ensureEmailIndex } from "./services/elasticsearch.service.js";
import { reconcileScheduledJobs } from "./services/reconcile.service.js";
import { startEmailWorker } from "./workers/email.worker.js";
import { env } from "./config/env.js";

try {
  await ensureEmailIndex();
} catch (err) {
  logger.warn({ err }, "Elasticsearch not ready — indexing will retry on each send");
}

await reconcileScheduledJobs();

const worker = startEmailWorker();
logger.info(
  { concurrency: env.WORKER_CONCURRENCY, minSendDelayMs: env.MIN_SEND_DELAY_MS },
  "email worker started",
);

async function shutdown(): Promise<void> {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
