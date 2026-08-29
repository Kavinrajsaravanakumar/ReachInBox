-- Custom SQL migration file, generated for ReachInbox scheduler

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "google_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "avatar_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_idx" ON "users" ("google_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "senders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "max_emails_per_hour" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sender_id" uuid NOT NULL REFERENCES "senders"("id") ON DELETE RESTRICT,
  "recipient_email" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "scheduled_at" timestamptz NOT NULL,
  "status" text NOT NULL,
  "sent_at" timestamptz,
  "preview_url" text,
  "error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "emails_status_check" CHECK ("status" IN ('scheduled', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emails_user_status_idx" ON "emails" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emails_scheduled_status_idx" ON "emails" ("status", "scheduled_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slack_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "webhook_url" text,
  "access_token" text,
  "team_name" text,
  "channel_id" text,
  "connected_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "slack_integrations_user_id_idx" ON "slack_integrations" ("user_id");
