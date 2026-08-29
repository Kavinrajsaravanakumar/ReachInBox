"use client";

import type { User } from "@/types";

export function UserProfile({ user }: { user: User | null }) {
  const initial = (user?.name ?? "U").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-xl p-2 bg-canvas/60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-nav text-sm font-semibold text-brand">
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
    </div>
  );
}
