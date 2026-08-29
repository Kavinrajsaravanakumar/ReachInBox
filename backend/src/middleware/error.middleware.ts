import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  const status = typeof err?.status === "number" ? err.status : 500;
  const message = err instanceof Error ? err.message : "Internal server error";

  logger.error({ err }, "Unhandled request error");
  res.status(status).json({ error: message });
};
