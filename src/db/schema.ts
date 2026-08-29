import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  googleIdIdx: uniqueIndex("users_google_id_idx").on(t.googleId),
}));

export const senders = pgTable("senders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  /** Optional per-sender hourly cap. Null → env MAX_EMAILS_PER_HOUR_PER_SENDER → MAX_EMAILS_PER_HOUR. */
  maxEmailsPerHour: integer("max_emails_per_hour"),
});

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

export const slackIntegrations = pgTable("slack_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  webhookUrl: text("webhook_url"),
  accessToken: text("access_token"),
  teamName: text("team_name"),
  channelId: text("channel_id"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: uniqueIndex("slack_integrations_user_id_idx").on(t.userId),
}));

export type User = typeof users.$inferSelect;
export type Sender = typeof senders.$inferSelect;
export type EmailRow = typeof emails.$inferSelect;
export type SlackIntegration = typeof slackIntegrations.$inferSelect;
