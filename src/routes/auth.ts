import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { env, googleOAuthConfigured } from "../config.js";
import { signOauthState, signUserToken, verifyOauthState } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";

export const authRouter = Router();

function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Start Google OAuth (JSON). Also accepted as GET /api/auth/google. */
authRouter.post("/google", (_req, res) => {
  if (!googleOAuthConfigured()) {
    res.status(503).json({
      error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use POST /api/auth/dev when DEV_AUTH_ENABLED=true.",
    });
    return;
  }
  const state = signOauthState({ purpose: "google" });
  res.json({ url: googleAuthUrl(state) });
});

authRouter.get("/google", (req, res) => {
  if (!googleOAuthConfigured()) {
    res.status(503).json({ error: "Google OAuth is not configured." });
    return;
  }
  const state = signOauthState({ purpose: "google" });
  res.redirect(googleAuthUrl(state));
});

authRouter.get("/google/callback", async (req, res) => {
  if (!googleOAuthConfigured()) {
    res.status(503).json({ error: "Google OAuth is not configured." });
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
  try {
    verifyOauthState(state);
  } catch {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenJson.access_token) {
      logger.error({ tokenJson }, "Google token exchange failed");
      res.status(401).json({ error: tokenJson.error ?? "Google token exchange failed", details: tokenJson });
      return;
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = await profileRes.json() as {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.id || !profile.email) {
      res.status(401).json({ error: "Google profile missing id/email" });
      return;
    }

    const existing = await db.select().from(users).where(eq(users.googleId, profile.id)).limit(1);
    let user = existing[0];
    if (!user) {
      const inserted = await db.insert(users).values({
        googleId: profile.id,
        email: profile.email,
        name: profile.name ?? profile.email,
        avatarUrl: profile.picture ?? null,
      }).returning();
      user = inserted[0];
    } else {
      const updated = await db.update(users).set({
        email: profile.email,
        name: profile.name ?? user.name,
        avatarUrl: profile.picture ?? user.avatarUrl,
      }).where(eq(users.id, user.id)).returning();
      user = updated[0] ?? user;
    }

    if (!user) {
      res.status(500).json({ error: "Failed to upsert user" });
      return;
    }

    const jwtToken = signUserToken(user.id, user.email);
    const redirect = new URL(env.OAUTH_SUCCESS_REDIRECT);
    redirect.searchParams.set("token", jwtToken);
    res.redirect(redirect.toString());
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    res.status(500).json({ error: "Google OAuth failed" });
  }
});

/** Local-only JWT mint. Disabled unless DEV_AUTH_ENABLED=true. */
authRouter.post("/dev", async (req, res) => {
  if (!env.DEV_AUTH_ENABLED) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const email = typeof req.body?.email === "string" ? req.body.email : "dev@localhost";
  const name = typeof req.body?.name === "string" ? req.body.name : "Dev User";
  const googleId = `dev:${email.toLowerCase()}`;

  const existing = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  let user = existing[0];
  if (!user) {
    const inserted = await db.insert(users).values({
      googleId,
      email,
      name,
      avatarUrl: null,
    }).returning();
    user = inserted[0];
  }
  if (!user) {
    res.status(500).json({ error: "Failed to create dev user" });
    return;
  }
  const token = signUserToken(user.id, user.email);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});
