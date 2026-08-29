"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pixelify_Sans } from "next/font/google";
import { useToast } from "@/components/ui/Toast";
import { clearSession, getUser, isSlackConnected } from "@/lib/auth";
import { Sidebar, type Tab } from "@/components/layout/Sidebar";
import { ConnectSlackModal } from "@/components/slack/ConnectSlackModal";
import type { User } from "@/types";

const pixelifySans = Pixelify_Sans({ subsets: ["latin"] });

export function AppShell({
  tab,
  onTab,
  counts,
  search,
  onSearch,
  onRefresh,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: { scheduled: number; sent: number };
  search: string;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [slack, setSlack] = useState(false);
  const [slackModal, setSlackModal] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setSlack(isSlackConnected());
  }, []);

  function logout() {
    clearSession();
    toast.success("Logged out");
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="grid grid-cols-[260px_1fr_auto] items-center gap-4 border-b border-line px-5 py-3 shrink-0">
        <div className={`${pixelifySans.className} text-2xl font-bold tracking-tight text-ink`}>
          REACHINBOX
        </div>
        <div className="flex items-center justify-center">
          <label className="relative w-full max-w-xl">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search emails..."
              className="w-full rounded-full bg-field py-2.5 pl-11 pr-4 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/25"
            />
          </label>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <button
            type="button"
            className="p-2.5 rounded-lg hover:bg-canvas text-ink transition-colors"
            aria-label="Filter"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </button>
          <button
            type="button"
            className="p-2.5 rounded-lg hover:bg-canvas text-ink transition-colors"
            aria-label="Refresh"
            onClick={onRefresh}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12a9 9 0 1 1-2.3-6M21 4v6h-6" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          user={user}
          tab={tab}
          onTab={onTab}
          counts={counts}
          slackConnected={slack}
          onOpenSlackModal={() => setSlackModal(true)}
          onLogout={logout}
        />

        <main className="min-w-0 flex-1 px-4 py-4 overflow-y-auto">{children}</main>
      </div>

      <ConnectSlackModal
        open={slackModal}
        onClose={() => setSlackModal(false)}
        connected={slack}
        onStatusChange={(val) => setSlack(val)}
      />
    </div>
  );
}
