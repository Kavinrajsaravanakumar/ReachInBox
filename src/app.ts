import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queues/connection.js";
import { adminGate } from "./lib/admin-gate.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { sendersRouter } from "./routes/senders.js";
import { emailsRouter } from "./routes/emails.js";
import { slackRouter } from "./routes/slack.js";

export function createApp(): express.Express {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/senders", sendersRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/slack", slackRouter);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue, { readOnlyMode: true })],
    serverAdapter,
  });
  app.use("/admin/queues", adminGate, serverAdapter.getRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: message });
  });

  return app;
}
