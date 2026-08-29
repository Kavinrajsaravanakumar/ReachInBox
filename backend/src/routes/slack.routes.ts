import { Router } from "express";
import {
  deleteSlackIntegrationHandler,
  getSlackIntegrationHandler,
  saveSlackWebhookHandler,
  slackAuthorizeRedirect,
  slackCallbackHandler,
} from "../controllers/slack.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const slackRouter = Router();

slackRouter.get("/oauth/authorize", requireAuth, (req, res, next) => {
  Promise.resolve(slackAuthorizeRedirect(req, res)).catch(next);
});

slackRouter.get("/oauth/callback", (req, res, next) => {
  Promise.resolve(slackCallbackHandler(req, res)).catch(next);
});

slackRouter.get("/integration", requireAuth, (req, res, next) => {
  Promise.resolve(getSlackIntegrationHandler(req, res)).catch(next);
});

slackRouter.post("/webhook", requireAuth, (req, res, next) => {
  Promise.resolve(saveSlackWebhookHandler(req, res)).catch(next);
});

slackRouter.delete("/integration", requireAuth, (req, res, next) => {
  Promise.resolve(deleteSlackIntegrationHandler(req, res)).catch(next);
});
