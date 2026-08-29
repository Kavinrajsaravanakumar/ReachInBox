import { logger } from "../utils/logger.js";

export async function sendSlackWebhook(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Slack webhook returned non-OK");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Failed to send Slack webhook");
    return false;
  }
}

export async function sendSlackChatMessage(
  accessToken: string,
  channelId: string,
  text: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel: channelId, text }),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!body.ok) {
      logger.warn({ error: body.error }, "Slack chat.postMessage failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Slack chat.postMessage error");
    return false;
  }
}
