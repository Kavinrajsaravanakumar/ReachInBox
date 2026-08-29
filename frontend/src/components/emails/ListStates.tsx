"use client";

export function ListSkeleton() {
  return (
    <div className="animate-pulse space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-5">
          <div className="h-4 w-36 rounded bg-field" />
          <div className="h-6 w-28 rounded-full bg-scheduled-bg/70" />
          <div className="h-4 flex-1 rounded bg-field" />
        </div>
      ))}
    </div>
  );
}

export function EmptyList({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-mint text-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 7 9-7" />
        </svg>
      </div>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>
    </div>
  );
}
