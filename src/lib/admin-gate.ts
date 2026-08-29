import type { RequestHandler } from "express";
import { env } from "../config.js";

export const adminGate: RequestHandler = (req, res, next) => {
  if (!env.ADMIN_TOKEN) {
    next();
    return;
  }
  const header = req.headers["x-admin-token"];
  const q = typeof req.query.token === "string" ? req.query.token : undefined;
  const provided = (typeof header === "string" ? header : undefined) ?? q;
  if (provided !== env.ADMIN_TOKEN) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }
  next();
};
