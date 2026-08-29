import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Env ${name} must be a non-negative number`);
  }
  return n;
}

export const env = {
  PORT: int("PORT", 3000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:3000",
  JWT_SECRET: required("JWT_SECRET", "change-me-to-a-long-random-string"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  DEV_AUTH_ENABLED: process.env.DEV_AUTH_ENABLED === "true",
  ADMIN_TOKEN: optional("ADMIN_TOKEN"),
  DATABASE_URL: required(
    "DATABASE_URL",
    "postgres://reachinbox:reachinbox@localhost:5432/reachinbox",
  ),
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  ELASTICSEARCH_INDEX: process.env.ELASTICSEARCH_INDEX ?? "emails",
  WORKER_CONCURRENCY: Math.max(1, int("WORKER_CONCURRENCY", 5)),
  /** Default 2000ms — see README. */
  MIN_SEND_DELAY_MS: Math.max(1, int("MIN_SEND_DELAY_MS", 2000)),
  MAX_EMAILS_PER_HOUR: Math.max(1, int("MAX_EMAILS_PER_HOUR", 30)),
  MAX_EMAILS_PER_HOUR_PER_SENDER: optional("MAX_EMAILS_PER_HOUR_PER_SENDER")
    ? Math.max(1, int("MAX_EMAILS_PER_HOUR_PER_SENDER", 30))
    : undefined,
  GOOGLE_CLIENT_ID: optional("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: optional("GOOGLE_CLIENT_SECRET"),
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3000/api/auth/google/callback",
  SLACK_CLIENT_ID: optional("SLACK_CLIENT_ID"),
  SLACK_CLIENT_SECRET: optional("SLACK_CLIENT_SECRET"),
  SLACK_CALLBACK_URL:
    process.env.SLACK_CALLBACK_URL ?? "http://localhost:3000/api/slack/oauth/callback",
  SLACK_SCOPES: process.env.SLACK_SCOPES ?? "incoming-webhook,chat:write",
  OAUTH_SUCCESS_REDIRECT: process.env.OAUTH_SUCCESS_REDIRECT ?? "http://localhost:3001/auth/callback",
};

export function googleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function slackOAuthConfigured(): boolean {
  return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
}
