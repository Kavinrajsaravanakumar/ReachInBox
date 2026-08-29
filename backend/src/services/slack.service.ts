import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { slackIntegrations, type SlackIntegration } from "../db/schema/index.js";
import { env, slackOAuthConfigured } from "../config/env.js";
import { signOauthState, verifyOauthState } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import { AppError, BadRequestError, ServiceUnavailableError, UnauthorizedError } from "../utils/errors.js";
import { sendSlackChatMessage, sendSlackWebhook } from "../lib/slack.js";

export function getSlackAuthorizeUrl(userId: string): string {
  if (!slackOAuthConfigured()) {
    throw new ServiceUnavailableError("Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.");
  }
  const state = signOauthState({ purpose: "slack", userId });
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID!,
    scope: env.SLACK_SCOPES,
    redirect_uri: env.SLACK_CALLBACK_URL,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function handleSlackOAuthCallback(code: string, state: string): Promise<string> {
  if (!slackOAuthConfigured()) {
    throw new ServiceUnavailableError("Slack OAuth is not configured.");
  }

  let userId: string;
  try {
    const payload = verifyOauthState<{ purpose: string; userId: string }>(state);
    if (payload.purpose !== "slack" || !payload.userId) {
      throw new Error("bad state");
    }
    userId = payload.userId;
  } catch {
    throw new BadRequestError("Invalid OAuth state");
  }

  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID!,
      client_secret: env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: env.SLACK_CALLBACK_URL,
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    incoming_webhook?: { url?: string; channel_id?: string };
    team?: { name?: string };
  };

  if (!tokenJson.ok) {
    throw new UnauthorizedError(tokenJson.error ?? "Slack token exchange failed");
  }

  const webhookUrl = tokenJson.incoming_webhook?.url ?? null;
  const channelId = tokenJson.incoming_webhook?.channel_id ?? null;
  const accessToken = tokenJson.access_token ?? null;
  const teamName = tokenJson.team?.name ?? null;

  const existing = await db
    .select()
    .from(slackIntegrations)
    .where(eq(slackIntegrations.userId, userId))
    .limit(1);

  if (existing[0]) {
    await db.update(slackIntegrations).set({
      webhookUrl,
      accessToken,
      teamName,
      channelId,
      connectedAt: new Date(),
    }).where(eq(slackIntegrations.userId, userId));
  } else {
    await db.insert(slackIntegrations).values({
      userId,
      webhookUrl,
      accessToken,
      teamName,
      channelId,
    });
  }

  const redirect = new URL(env.OAUTH_SUCCESS_REDIRECT);
  redirect.searchParams.set("slack", "connected");
  return redirect.toString();
}

export async function getSlackIntegration(userId: string): Promise<SlackIntegration | null> {
  const [row] = await db
    .select()
    .from(slackIntegrations)
    .where(eq(slackIntegrations.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function saveSlackWebhook(userId: string, webhookUrl: string): Promise<SlackIntegration> {
  if (!webhookUrl || !webhookUrl.startsWith("http")) {
    throw new BadRequestError("Valid Slack webhook URL is required");
  }

  const existing = await db
    .select()
    .from(slackIntegrations)
    .where(eq(slackIntegrations.userId, userId))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(slackIntegrations)
      .set({
        webhookUrl,
        connectedAt: new Date(),
      })
      .where(eq(slackIntegrations.userId, userId))
      .returning();
    return updated!;
  } else {
    const [inserted] = await db.insert(slackIntegrations).values({
      userId,
      webhookUrl,
      teamName: "Custom Webhook",
    }).returning();
    return inserted!;
  }
}

export async function deleteSlackIntegration(userId: string): Promise<boolean> {
  await db.delete(slackIntegrations).where(eq(slackIntegrations.userId, userId));
  return true;
}

export async function notifySenderHourlyLimit(opts: {
  userId: string;
  senderLabel: string;
  limit: number;
  nextWindowStart: Date;
}): Promise<void> {
  try {
    const row = await getSlackIntegration(opts.userId);
    if (!row) return;

    const text =
      `⚠️ ${opts.senderLabel} hit its hourly limit of ${opts.limit} — ` +
      `remaining emails rescheduled to ${opts.nextWindowStart.toISOString()}`;

    if (row.webhookUrl) {
      await sendSlackWebhook(row.webhookUrl, text);
      return;
    }

    if (row.accessToken && row.channelId) {
      await sendSlackChatMessage(row.accessToken, row.channelId, text);
    }
  } catch (err) {
    logger.warn({ err }, "Slack notification skipped (never fatal)");
  }
}
