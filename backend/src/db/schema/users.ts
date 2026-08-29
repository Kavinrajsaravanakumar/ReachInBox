import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
