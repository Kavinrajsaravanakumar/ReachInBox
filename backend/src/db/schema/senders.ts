import { pgTable, uuid, text, integer } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const senders = pgTable("senders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  /** Optional per-sender hourly cap. Null → env MAX_EMAILS_PER_HOUR_PER_SENDER → MAX_EMAILS_PER_HOUR. */
  maxEmailsPerHour: integer("max_emails_per_hour"),
});

export type Sender = typeof senders.$inferSelect;
export type NewSender = typeof senders.$inferInsert;
