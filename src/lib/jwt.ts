import jwt from "jsonwebtoken";
import { env } from "../config.js";

export type JwtPayload = {
  sub: string;
  email: string;
};

export function signUserToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email } satisfies JwtPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyUserToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null || typeof decoded.sub !== "string") {
    throw new Error("Invalid token");
  }
  return {
    sub: decoded.sub,
    email: typeof decoded.email === "string" ? decoded.email : "",
  };
}

export function signOauthState(data: Record<string, string>): string {
  return jwt.sign(data, env.JWT_SECRET, { expiresIn: "10m" });
}

export function verifyOauthState<T extends Record<string, string>>(token: string): T {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid OAuth state");
  }
  return decoded as T;
}
