import type { Request, Response } from "express";
import {
  getGoogleAuthUrl,
  getUserProfile,
  handleGoogleCallback,
  loginDevUser,
} from "../services/auth.service.js";
import { BadRequestError, UnauthorizedError } from "../utils/errors.js";

export async function googleAuthRedirect(req: Request, res: Response): Promise<void> {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

export async function googleCallbackHandler(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;

  if (!code || !state) {
    throw new BadRequestError("Missing code or state");
  }

  const redirectUrl = await handleGoogleCallback(code, state);
  res.redirect(redirectUrl);
}

export async function devLoginHandler(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "dev@example.com";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "Dev User";

  const result = await loginDevUser(email, name);
  res.json(result);
}

export async function getCurrentUserHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError("Unauthorized");
  }

  const user = await getUserProfile(req.user.id);
  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  });
}
