import { getMailer, previewUrlFor } from "../lib/smtp.js";
import type { Sender } from "../db/schema/index.js";

export async function sendViaEthereal(opts: {
  sender: Sender;
  to: string;
  subject: string;
  body: string;
}): Promise<{ previewUrl: string | null }> {
  const mailer = await getMailer();
  const info = await mailer.sendMail({
    from: `"${opts.sender.displayName}" <${opts.sender.email}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
  });
  return { previewUrl: previewUrlFor(info) };
}
