"use client";

import { Badge } from "@/components/ui/Badge";
import type { EmailStatus } from "@/types";

export function StatusBadge({
  status,
  scheduledAt,
}: {
  status: EmailStatus;
  scheduledAt?: string;
}) {
  if (status === "scheduled") {
    const label = scheduledAt
      ? new Date(scheduledAt).toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        })
      : "Scheduled";
    return (
      <Badge
        tone="scheduled"
        icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        }
      >
        {label}
      </Badge>
    );
  }
  if (status === "failed") {
    return <Badge tone="failed">Failed</Badge>;
  }
  return <Badge tone="sent">Sent</Badge>;
}
