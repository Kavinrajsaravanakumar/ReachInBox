import { Router } from "express";
import { createSenderHandler } from "../controllers/sender.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const sendersRouter = Router();

sendersRouter.post("/", requireAuth, (req, res, next) => {
  Promise.resolve(createSenderHandler(req, res)).catch(next);
});
