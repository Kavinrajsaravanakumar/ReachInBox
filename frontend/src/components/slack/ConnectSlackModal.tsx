"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { apiDelete, apiGet, apiPost, API_URL } from "@/lib/api";
import { setSlackConnected } from "@/lib/auth";
import type { SlackIntegrationResponse } from "@/types";

export function ConnectSlackModal({
  open,
  onClose,
  connected,
  onStatusChange,
}: {
  open: boolean;
  onClose: () => void;
  connected: boolean;
  onStatusChange: (status: boolean) => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"oauth" | "webhook">("oauth");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<SlackIntegrationResponse | null>(null);

  useEffect(() => {
    if (open) {
      void fetchStatus();
    }
  }, [open]);

  async function fetchStatus() {
    try {
      const res = await apiGet<SlackIntegrationResponse>("/api/slack/integration");
      setIntegration(res);
      if (res.connected) {
        onStatusChange(true);
        setSlackConnected(true);
      }
    } catch {
      /* ignore */
    }
  }

  async function handleOAuthConnect() {
    window.location.href = "/slack/connect";
  }

  async function handleWebhookSave(e: React.FormEvent) {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    setLoading(true);
    try {
      await apiPost("/api/slack/webhook", { webhookUrl: webhookUrl.trim() });
      toast.success("Slack Webhook connected successfully!");
      onStatusChange(true);
      setSlackConnected(true);
      await fetchStatus();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save webhook");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await apiDelete("/api/slack/integration");
      toast.success("Slack disconnected");
      onStatusChange(false);
      setSlackConnected(false);
      setIntegration(null);
      setWebhookUrl("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={connected ? "Slack Integration" : "Connect Slack Workspace"}
      className="max-w-md"
    >
      {connected ? (
        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2.5 text-emerald-800 font-semibold text-sm">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Connected to Slack
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              {integration?.teamName ? `Workspace: ${integration.teamName}` : "Custom Incoming Webhook configured."}
            </p>
            {integration?.webhookUrl && (
              <p className="mt-1 font-mono text-[11px] text-emerald-600 truncate max-w-full">
                {integration.webhookUrl}
              </p>
            )}
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Rate limit notifications and alerts will automatically be posted to this Slack channel when caps are hit.
          </p>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Disconnect
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={handleOAuthConnect}>
                Reconnect OAuth
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-1 border border-line">
            <button
              type="button"
              onClick={() => setMode("oauth")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "oauth" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Default OAuth (One-Click)
            </button>
            <button
              type="button"
              onClick={() => setMode("webhook")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "webhook" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Custom Webhook URL
            </button>
          </div>

          {mode === "oauth" ? (
            <div className="space-y-4">
              <p className="text-xs text-muted leading-relaxed">
                Connect your Slack workspace directly with OAuth to automatically receive alerts whenever your hourly email sending limits are reached.
              </p>
              <Button className="w-full justify-center gap-2" onClick={handleOAuthConnect}>
                Authorize with Slack
              </Button>
            </div>
          ) : (
            <form onSubmit={handleWebhookSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Slack Incoming Webhook URL
                </label>
                <Input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                />
                <span className="block mt-1 text-[11px] text-muted">
                  Create a Webhook from Slack App Settings &gt; Incoming Webhooks.
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={loading || !webhookUrl.trim()}>
                  {loading ? "Connecting..." : "Save & Connect"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
