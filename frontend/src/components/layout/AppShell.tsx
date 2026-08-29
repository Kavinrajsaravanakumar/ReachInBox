"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { API_URL } from "@/lib/api";
import { clearSession, getUser, isSlackConnected } from "@/lib/auth";
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

type Tab = "scheduled" | "sent";

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
  const [menu, setMenu] = useState(false);
  const [slack, setSlack] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getUser());
    setSlack(isSlackConnected());
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function logout() {
    clearSession();
    toast.success("Logged out");
    router.push("/login");
  }

  const initial = (user?.name ?? "U").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-white">
      <header className="grid grid-cols-[260px_1fr_auto] items-center gap-4 border-b border-line px-5 py-3">
        <div className="font-sans text-[22px] font-extrabold tracking-tight text-ink">ONE</div>
        <div className="flex items-center justify-center">
          <label className="relative w-full max-w-xl">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-full bg-field py-2.5 pl-11 pr-4 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/25"
            />
          </label>
        </div>
        <div className="flex items-center gap-3 text-muted">
          <button type="button" className="p-1" aria-label="Filter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </button>
          <button type="button" className="p-1" aria-label="Refresh" onClick={onRefresh}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12a9 9 0 1 1-2.3-6M21 4v6h-6" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-57px)]">
        <aside className="w-[260px] shrink-0 border-r border-line px-4 py-5">
          <div className="relative mb-4" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-canvas"
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand-nav text-sm font-semibold text-brand">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{user?.name ?? "Account"}</span>
                <span className="block truncate text-xs text-muted">{user?.email}</span>
              </span>
              <span className="text-muted">▾</span>
            </button>
            {menu ? (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-white p-2 shadow-pop">
                <p className="px-2 py-1 text-xs text-muted">
                  Slack: {slack ? "connected" : "disconnected"}
                </p>
                <a
                  href="/slack/connect"
                  className="block rounded-md px-2 py-2 text-sm hover:bg-field"
                  onClick={() => toast.success("Redirecting to Slack…")}
                >
                  Connect Slack
                </a>
                <a
                  href={`${API_URL}/admin/queues`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md px-2 py-2 text-sm hover:bg-field"
                >
                  Live queue dashboard
                </a>
                <button type="button" className="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-field" onClick={logout}>
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          <Button variant="outline" className="mb-6 w-full" onClick={() => router.push("/compose")}>
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
        </aside>

        <main className="min-w-0 flex-1 px-2 py-2">{children}</main>
      </div>
    </div>
  );
}
