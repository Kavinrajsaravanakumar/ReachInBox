import { Router } from "express";
import {
  devLoginHandler,
  getCurrentUserHandler,
  googleAuthRedirect,
  googleCallbackHandler,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.get("/google", (req, res, next) => {
  Promise.resolve(googleAuthRedirect(req, res)).catch(next);
});

authRouter.get("/google/callback", (req, res, next) => {
  Promise.resolve(googleCallbackHandler(req, res)).catch(next);
});

authRouter.post("/dev", (req, res, next) => {
  Promise.resolve(devLoginHandler(req, res)).catch(next);
});

authRouter.get("/me", requireAuth, (req, res, next) => {
  Promise.resolve(getCurrentUserHandler(req, res)).catch(next);
});
