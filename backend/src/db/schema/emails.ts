import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { senders } from "./senders.js";

export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => senders.id, { onDelete: "restrict" }),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  previewUrl: text("preview_url"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailRow = typeof emails.$inferSelect;
export type NewEmailRow = typeof emails.$inferInsert;
