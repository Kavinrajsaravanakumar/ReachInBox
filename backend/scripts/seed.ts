import "dotenv/config";
import { db } from "../src/db/index.js";
import { users, senders, emails } from "../src/db/schema/index.js";
import { logger } from "../src/utils/logger.js";

async function seed() {
  logger.info("Seeding database...");

  // Seed dev user if not exists
  let [user] = await db.insert(users).values({
    googleId: "dev:user@example.com",
    email: "user@example.com",
    name: "Demo User",
  }).onConflictDoNothing().returning();

  if (!user) {
    const existing = await db.select().from(users).limit(1);
    user = existing[0]!;
  }

  // Seed default sender
  const [sender] = await db.insert(senders).values({
    userId: user.id,
    email: "sender@example.com",
    displayName: "Support Team",
    maxEmailsPerHour: 30,
  }).returning();

  logger.info({ userId: user.id, senderId: sender?.id }, "Seed completed successfully");
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
