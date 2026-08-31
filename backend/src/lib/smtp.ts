import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { logger } from "../utils/logger.js";

let transporter: Transporter | null = null;
let etherealUser: string | null = null;

export async function getMailer(): Promise<Transporter> {
  if (transporter) return transporter;
  const account = await nodemailer.createTestAccount();
  etherealUser = account.user;

  const options: SMTPTransport.Options = {
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  };

  transporter = nodemailer.createTransport(options);
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