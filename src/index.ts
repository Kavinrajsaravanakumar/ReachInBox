import { env } from "./config.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { ensureEmailIndex } from "./lib/elasticsearch.js";
import { reconcileScheduledJobs } from "./lib/reconcile.js";

const app = createApp();

try {
  await ensureEmailIndex();
} catch (err) {
  logger.warn({ err }, "Elasticsearch not ready — search will fail until it is up");
}

try {
  await reconcileScheduledJobs();
} catch (err) {
  logger.warn({ err }, "API boot reconciliation skipped (Redis/Postgres not ready?)");
}

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API listening");
});

async function shutdown(): Promise<void> {
  server.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
