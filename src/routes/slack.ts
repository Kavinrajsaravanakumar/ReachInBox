import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { slackIntegrations } from "../db/schema.js";
import { env, slackOAuthConfigured } from "../config.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { signOauthState, verifyOauthState } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";

export const slackRouter = Router();

function slackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID!,
    scope: env.SLACK_SCOPES,
    redirect_uri: env.SLACK_CALLBACK_URL,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

slackRouter.get("/oauth/authorize", requireAuth, (req, res) => {
  if (!slackOAuthConfigured()) {
    res.status(503).json({
      error: "Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
    });
    return;
  }
  const state = signOauthState({ purpose: "slack", userId: req.user!.id });
  res.redirect(slackAuthorizeUrl(state));
});

slackRouter.get("/oauth/callback", async (req, res) => {
  if (!slackOAuthConfigured()) {
    res.status(503).json({ error: "Slack OAuth is not configured." });
    return;
  }
  const { code, state, error } = req.query;
  if (error) {
    res.status(400).json({ error: String(error) });
    return;
  }
  if (typeof code !== "string" || typeof state !== "string") {
    res.status(400).json({ error: "Missing code or state" });
    return;
  }

  let userId: string;
  try {
    const payload = verifyOauthState<{ purpose: string; userId: string }>(state);
    if (payload.purpose !== "slack" || !payload.userId) {
      throw new Error("bad state");
    }
    userId = payload.userId;
  } catch {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }

  try {
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
    const tokenJson = await tokenRes.json() as {
      ok?: boolean;
      error?: string;
      access_token?: string;
      incoming_webhook?: { url?: string; channel_id?: string };
      team?: { name?: string };
    };

    if (!tokenJson.ok) {
      res.status(401).json({ error: tokenJson.error ?? "Slack token exchange failed" });
      return;
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
    res.redirect(redirect.toString());
  } catch (err) {
    logger.error({ err }, "Slack OAuth callback failed");
    res.status(500).json({ error: "Slack OAuth failed" });
  }
});
