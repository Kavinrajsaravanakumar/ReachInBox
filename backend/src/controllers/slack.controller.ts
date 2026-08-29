import type { Request, Response } from "express";
import {
  deleteSlackIntegration,
  getSlackAuthorizeUrl,
  getSlackIntegration,
  handleSlackOAuthCallback,
  saveSlackWebhook,
} from "../services/slack.service.js";
import { BadRequestError } from "../utils/errors.js";

export async function slackAuthorizeRedirect(req: Request, res: Response): Promise<void> {
  const url = getSlackAuthorizeUrl(req.user!.id);
  res.redirect(url);
}

export async function slackCallbackHandler(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;
  if (error) {
    throw new BadRequestError(String(error));
  }
  if (typeof code !== "string" || typeof state !== "string") {
    throw new BadRequestError("Missing code or state");
  }

  const redirectUrl = await handleSlackOAuthCallback(code, state);
  res.redirect(redirectUrl);
}

export async function getSlackIntegrationHandler(req: Request, res: Response): Promise<void> {
  const integration = await getSlackIntegration(req.user!.id);
  if (!integration) {
    res.json({ connected: false });
    return;
  }

  res.json({
    connected: Boolean(integration.webhookUrl || integration.accessToken),
    teamName: integration.teamName,
    channelId: integration.channelId,
    webhookUrl: integration.webhookUrl,
    connectedAt: integration.connectedAt,
  });
}

export async function saveSlackWebhookHandler(req: Request, res: Response): Promise<void> {
  const webhookUrl = typeof req.body?.webhookUrl === "string" ? req.body.webhookUrl.trim() : "";
  const result = await saveSlackWebhook(req.user!.id, webhookUrl);
  res.json({ connected: true, webhookUrl: result.webhookUrl });
}

export async function deleteSlackIntegrationHandler(req: Request, res: Response): Promise<void> {
  await deleteSlackIntegration(req.user!.id);
  res.json({ connected: false });
}
