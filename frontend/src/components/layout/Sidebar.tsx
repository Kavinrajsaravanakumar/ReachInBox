"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { UserProfile } from "@/components/layout/UserProfile";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { ConnectSlackButton } from "@/components/slack/ConnectSlackButton";
import { API_BASE_URL } from "@/config/constants";
import type { User } from "@/types";

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 11.5L21 4l-6.5 16-3-6.5L3 11.5z" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1.5" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="3.5" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

export type Tab = "scheduled" | "sent";

export function Sidebar({
  user,
  tab,
  onTab,
  counts,
  slackConnected,
  onOpenSlackModal,
  onLogout,
}: {
  user: User | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: { scheduled: number; sent: number };
  slackConnected: boolean;
  onOpenSlackModal: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();

  return (
    <aside className="w-[260px] shrink-0 border-r border-line px-4 py-5 flex flex-col justify-between">
      <div className="space-y-4">
        {/* User Profile display without dropdown */}
        <UserProfile user={user} />

        <Button variant="outline" className="w-full" onClick={() => router.push("/compose")}>
          + Compose
        </Button>

        <Tabs
          value={tab}
          onChange={onTab}
          items={[
            { id: "scheduled", label: "Scheduled", icon: <ClockIcon />, count: counts.scheduled },
            { id: "sent", label: "Sent", icon: <PlaneIcon />, count: counts.sent },
          ]}
        />

        {/* Additional Nav buttons under Sent */}
        <div className="pt-3 border-t border-line space-y-1.5">
          <ConnectSlackButton connected={slackConnected} onClick={onOpenSlackModal} />

          <a
            href={`${API_BASE_URL}/admin/queues`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas transition-colors"
          >
            <span className="text-muted"><QueueIcon /></span>
            <span className="truncate">Queue Dashboard</span>
          </a>
        </div>
      </div>

      {/* Logout button at bottom-left of sidebar */}
      <div className="pt-4 border-t border-line">
        <LogoutButton onLogout={onLogout} />
      </div>
    </aside>
  );
}
