import { Router } from "express";
import { db } from "../db/client.js";
import { senders } from "../db/schema.js";
import { requireAuth } from "../lib/auth-middleware.js";

export const sendersRouter = Router();

sendersRouter.post("/", requireAuth, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const displayName = typeof req.body?.displayName === "string"
    ? req.body.displayName.trim()
    : typeof req.body?.display_name === "string"
      ? req.body.display_name.trim()
      : "";
  const maxEmailsPerHour = req.body?.maxEmailsPerHour ?? req.body?.max_emails_per_hour;

  if (!email || !displayName) {
    res.status(400).json({ error: "email and displayName are required" });
    return;
  }

  const [row] = await db.insert(senders).values({
    userId: req.user!.id,
    email,
    displayName,
    maxEmailsPerHour: typeof maxEmailsPerHour === "number" ? maxEmailsPerHour : null,
  }).returning();

  res.status(201).json(row);
});
