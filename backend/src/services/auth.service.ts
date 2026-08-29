import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, type User } from "../db/schema/index.js";
import { env, googleOAuthConfigured } from "../config/env.js";
import { signOauthState, signUserToken, verifyOauthState, verifyUserToken } from "../utils/jwt.js";
import { AppError, UnauthorizedError, ServiceUnavailableError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function getGoogleAuthUrl(): string {
  if (!googleOAuthConfigured()) {
    throw new ServiceUnavailableError("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use dev auth.");
  }
  const state = signOauthState({ purpose: "google" });
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

export async function handleGoogleCallback(code: string, state: string): Promise<string> {
  if (!googleOAuthConfigured()) {
    throw new ServiceUnavailableError("Google OAuth is not configured.");
  }

  try {
    verifyOauthState(state);
  } catch {
    throw new AppError("Invalid OAuth state", 400);
  }

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
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenJson.access_token) {
    logger.error({ tokenJson }, "Google token exchange failed");
    throw new UnauthorizedError(tokenJson.error ?? "Google token exchange failed");
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = (await profileRes.json()) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!profile.id || !profile.email) {
    throw new UnauthorizedError("Google profile missing id/email");
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
    throw new AppError("Failed to upsert user", 500);
  }

  const jwtToken = signUserToken(user.id, user.email, user.name, user.avatarUrl);
  const redirect = new URL(env.OAUTH_SUCCESS_REDIRECT);
  redirect.searchParams.set("token", jwtToken);
  return redirect.toString();
}

export async function loginDevUser(email: string, name: string): Promise<{ token: string; user: { id: string; email: string; name: string; avatarUrl: string | null } }> {
  if (!env.DEV_AUTH_ENABLED) {
    throw new AppError("Not found", 404);
  }
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
    throw new AppError("Failed to create dev user", 500);
  }
  const token = signUserToken(user.id, user.email, user.name, user.avatarUrl);
  return { token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } };
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}
