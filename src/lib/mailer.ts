import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "./logger.js";

let transporter: Transporter | null = null;
let etherealUser: string | null = null;

export async function getMailer(): Promise<Transporter> {
  if (transporter) return transporter;
  const account = await nodemailer.createTestAccount();
  etherealUser = account.user;
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
  logger.info({ user: account.user }, "Ethereal test SMTP account created");
  return transporter;
}

export function previewUrlFor(info: nodemailer.SentMessageInfo): string | null {
  const url = nodemailer.getTestMessageUrl(info);
  return typeof url === "string" ? url : null;
}

export function etherealAccountUser(): string | null {
  return etherealUser;
}
