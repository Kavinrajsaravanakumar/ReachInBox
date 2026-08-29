import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { senders, type Sender } from "../db/schema/index.js";
import { BadRequestError } from "../utils/errors.js";

export async function createSender(opts: {
  userId: string;
  email: string;
  displayName: string;
  maxEmailsPerHour?: number | null;
}): Promise<Sender> {
  const email = opts.email.trim();
  const displayName = opts.displayName.trim();

  if (!email || !displayName) {
    throw new BadRequestError("email and displayName are required");
  }

  const [row] = await db.insert(senders).values({
    userId: opts.userId,
    email,
    displayName,
    maxEmailsPerHour: typeof opts.maxEmailsPerHour === "number" ? opts.maxEmailsPerHour : null,
  }).returning();

  if (!row) {
    throw new Error("Failed to create sender");
  }

  return row;
}

export async function getSenderById(id: string): Promise<Sender | null> {
  const [row] = await db.select().from(senders).where(eq(senders.id, id)).limit(1);
  return row ?? null;
}
