import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users.js";

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

export type SlackIntegration = typeof slackIntegrations.$inferSelect;
export type NewSlackIntegration = typeof slackIntegrations.$inferInsert;
