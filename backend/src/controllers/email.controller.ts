import type { Request, Response } from "express";
import { getEmailById, listEmails, scheduleEmails } from "../services/email.service.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

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

export async function scheduleEmailsHandler(req: Request, res: Response): Promise<void> {
  const senderId = String(req.body?.senderId ?? "");
  const subject = String(req.body?.subject ?? "");
  const body = String(req.body?.body ?? "");
  const startRaw = req.body?.startTime;
  const delayRaw = req.body?.delayBetweenEmailsMs;
  const maxRaw = req.body?.maxEmailsPerHour;
  const recipients = parseRecipients(req.body?.recipients, req.file);

  if (!senderId || !subject || !startRaw) {
    throw new BadRequestError("senderId, subject, startTime, and recipients are required");
  }

  const startTime = new Date(String(startRaw));
  if (Number.isNaN(startTime.getTime())) {
    throw new BadRequestError("startTime must be an ISO datetime");
  }

  const delayBetweenEmailsMs = delayRaw === undefined || delayRaw === "" ? 0 : Number(delayRaw);
  if (!Number.isFinite(delayBetweenEmailsMs) || delayBetweenEmailsMs < 0) {
    throw new BadRequestError("delayBetweenEmailsMs must be >= 0");
  }

  const maxEmailsPerHour = maxRaw === undefined || maxRaw === "" ? undefined : Number(maxRaw);

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
}

export async function listEmailsHandler(req: Request, res: Response): Promise<void> {
  const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
  const status =
    statusRaw === "scheduled" || statusRaw === "sent" || statusRaw === "failed"
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
}

export async function getEmailByIdHandler(req: Request, res: Response): Promise<void> {
  const emailId = String(req.params.id);
  const email = await getEmailById(emailId, req.user!.id);
  if (!email) {
    throw new NotFoundError("Email not found");
  }
  res.json(email);
}
