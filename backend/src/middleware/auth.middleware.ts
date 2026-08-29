import type { NextFunction, Request, Response } from "express";
import { verifyUserToken } from "../utils/jwt.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Missing Authorization Bearer token" });
    return;
  }
  try {
    const payload = verifyUserToken(token);
    req.user = { id: payload.sub, email: payload.email, name: payload.name, avatarUrl: payload.avatarUrl };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (token) {
    try {
      const payload = verifyUserToken(token);
      req.user = { id: payload.sub, email: payload.email, name: payload.name, avatarUrl: payload.avatarUrl };
    } catch {
      /* ignore */
    }
  }
  next();
}
