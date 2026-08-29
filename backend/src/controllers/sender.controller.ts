import type { Request, Response } from "express";
import { createSender } from "../services/sender.service.js";

export async function createSenderHandler(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const displayName =
    typeof req.body?.displayName === "string"
      ? req.body.displayName.trim()
      : typeof req.body?.display_name === "string"
        ? req.body.display_name.trim()
        : "";
  const maxEmailsPerHour = req.body?.maxEmailsPerHour ?? req.body?.max_emails_per_hour;

  const row = await createSender({
    userId: req.user!.id,
    email,
    displayName,
    maxEmailsPerHour: typeof maxEmailsPerHour === "number" ? maxEmailsPerHour : null,
  });

  res.status(201).json(row);
}
