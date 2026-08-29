"use client";

import type { SlackIntegrationResponse } from "@/types";

export function SlackStatusPopover({
  integration,
  onDisconnect,
  onReconnect,
}: {
  integration: SlackIntegrationResponse | null;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  if (!integration?.connected) return null;

  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-lg text-sm space-y-3">
      <div className="flex items-center gap-2 text-emerald-600 font-medium">
        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        Connected to Slack
      </div>
      {integration.teamName && (
        <div className="text-xs text-muted">
          Workspace: <span className="font-semibold text-ink">{integration.teamName}</span>
        </div>
      )}
      <div className="flex gap-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={onReconnect}
          className="text-xs text-brand hover:underline font-medium"
        >
          Reconnect
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          className="text-xs text-red-600 hover:underline font-medium"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
