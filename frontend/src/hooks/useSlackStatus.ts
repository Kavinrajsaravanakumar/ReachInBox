"use client";

import { useState, useCallback, useEffect } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { setSlackConnected, isSlackConnected } from "@/lib/auth";
import type { SlackIntegrationResponse } from "@/types";

export function useSlackStatus() {
  const [connected, setConnected] = useState(false);
  const [integration, setIntegration] = useState<SlackIntegrationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<SlackIntegrationResponse>("/api/slack/integration");
      setConnected(res.connected);
      setIntegration(res);
      setSlackConnected(res.connected);
      return res;
    } catch {
      const cached = isSlackConnected();
      setConnected(cached);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const connectWebhook = useCallback(async (webhookUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<{ connected: boolean; webhookUrl: string }>("/api/slack/webhook", {
        webhookUrl,
      });
      setConnected(true);
      setSlackConnected(true);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect webhook";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiDelete<{ connected: boolean }>("/api/slack/integration");
      setConnected(false);
      setIntegration(null);
      setSlackConnected(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to disconnect";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return {
    connected,
    integration,
    loading,
    error,
    fetchStatus,
    connectWebhook,
    disconnect,
  };
}
