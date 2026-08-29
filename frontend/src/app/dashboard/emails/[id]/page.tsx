"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import type { EmailRow } from "@/types";
import { formatSentAt } from "@/lib/format";

export default function EmailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<EmailRow | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const raw = sessionStorage.getItem("rib_email");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as EmailRow;
        if (parsed.id === id) setRow(parsed);
      } catch {
        setRow(null);
      }
    }
  }, [id, router]);

  if (!row) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted">Email not found in this session.</p>
        <button className="text-brand" onClick={() => router.push("/dashboard")}>
          Back to inbox
        </button>
      </main>
    );
  }

  const letter = (row.recipientEmail[0] ?? "A").toUpperCase();
  const when = formatSentAt(row.sentAt) || formatSentAt(row.scheduledAt);

  return (
    <main className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => router.push("/dashboard")}>
          <span className="text-xl">←</span>
          <span className="truncate text-[17px] font-medium">{row.subject}</span>
        </button>
        <div className="flex items-center gap-3 text-muted">
          <span>☆</span>
          <span>🗑</span>
          <span>↗</span>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">{letter}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {row.recipientEmail} <span className="font-normal text-muted">&lt;{row.recipientEmail}&gt;</span>
            </p>
            <p className="text-sm text-muted">to me ▾</p>
          </div>
          <p className="text-sm text-muted">{when}</p>
        </div>
        <div className="whitespace-pre-wrap text-[15px] leading-7 text-ink">{row.body}</div>
        {row.error ? (
          <p className="mt-4 rounded-lg bg-failed-bg px-3 py-2 text-sm text-failed-text">{row.error}</p>
        ) : null}
        {row.previewUrl ? (
          <a className="mt-6 inline-block text-sm text-brand" href={row.previewUrl} target="_blank" rel="noreferrer">
            Open Ethereal preview
          </a>
        ) : null}
      </article>
    </main>
  );
}
