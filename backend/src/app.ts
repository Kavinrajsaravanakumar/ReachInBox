import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queues/email.queue.js";
import { adminGate } from "./middleware/admin.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { sendersRouter } from "./routes/sender.routes.js";
import { emailsRouter } from "./routes/email.routes.js";
import { slackRouter } from "./routes/slack.routes.js";

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

  app.use(errorHandler);

  return app;
}
