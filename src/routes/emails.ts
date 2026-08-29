import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../lib/auth-middleware.js";
import { scheduleEmails } from "../services/scheduler.service.js";
import { listEmails } from "../services/search.service.js";

export const emailsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function parseRecipients(raw: unknown, file?: Express.Multer.File): string[] {
  if (file) {
    return file.buffer
      .toString("utf8")
      .split(/\r?\n/)
      .flatMap((line) => line.split(/[,;]/))
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
  }
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* CSV / comma list */
    }
    return raw.split(/[,;\s]+/).filter(Boolean);
  }
  return [];
}

emailsRouter.post("/schedule", requireAuth, upload.single("recipientsFile"), async (req, res) => {
  try {
    const senderId = String(req.body?.senderId ?? "");
    const subject = String(req.body?.subject ?? "");
    const body = String(req.body?.body ?? "");
    const startRaw = req.body?.startTime;
    const delayRaw = req.body?.delayBetweenEmailsMs;
    const maxRaw = req.body?.maxEmailsPerHour;
    const recipients = parseRecipients(req.body?.recipients, req.file);

    if (!senderId || !subject || !startRaw) {
      res.status(400).json({ error: "senderId, subject, startTime, and recipients are required" });
      return;
    }

    const startTime = new Date(String(startRaw));
    if (Number.isNaN(startTime.getTime())) {
      res.status(400).json({ error: "startTime must be an ISO datetime" });
      return;
    }

    const delayBetweenEmailsMs = delayRaw === undefined || delayRaw === ""
      ? 0
      : Number(delayRaw);
    if (!Number.isFinite(delayBetweenEmailsMs) || delayBetweenEmailsMs < 0) {
      res.status(400).json({ error: "delayBetweenEmailsMs must be >= 0" });
      return;
    }

    const maxEmailsPerHour = maxRaw === undefined || maxRaw === ""
      ? undefined
      : Number(maxRaw);

    const result = await scheduleEmails({
      userId: req.user!.id,
      senderId,
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmailsMs,
      maxEmailsPerHour: Number.isFinite(maxEmailsPerHour) ? maxEmailsPerHour : undefined,
    });

    res.status(201).json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : "Failed to schedule" });
  }
});

emailsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusRaw === "scheduled" || statusRaw === "sent" || statusRaw === "failed"
      ? statusRaw
      : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const result = await listEmails({
      userId: req.user!.id,
      status,
      search,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "List failed" });
  }
});
