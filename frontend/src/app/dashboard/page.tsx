"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ScheduledTable } from "@/components/emails/ScheduledTable";
import { SentTable } from "@/components/emails/SentTable";
import { EmptyList, ListSkeleton } from "@/components/emails/ListStates";
import { apiGet } from "@/lib/api";
import { getToken, setSlackConnected } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import type { EmailListResponse, EmailRow } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [search, setSearch] = useState("");
  const [scheduled, setScheduled] = useState<EmailRow[]>([]);
  const [sent, setSent] = useState<EmailRow[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const qs = q.trim() ? `&search=${encodeURIComponent(q.trim())}` : "";
      const [sched, sentRes, failedRes] = await Promise.all([
        apiGet<EmailListResponse>(`/api/emails?status=scheduled&limit=50${qs}`),
        apiGet<EmailListResponse>(`/api/emails?status=sent&limit=50${qs}`),
        apiGet<EmailListResponse>(`/api/emails?status=failed&limit=50${qs}`),
      ]);
      setScheduled(sched.items);
      setScheduledTotal(sched.total);
      setSent([...sentRes.items, ...failedRes.items]);
      setSentTotal(sentRes.total + failedRes.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load emails");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(search), search ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [search, load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackErr = params.get("slack_error");
    const slack = params.get("slack");
    if (slackErr) {
      toast.error(slackErr);
      router.replace("/dashboard");
    }
    if (slack === "connected") {
      setSlackConnected(true);
      toast.success("Slack connected");
      router.replace("/dashboard");
    }
  }, [router, toast]);

  function openRow(row: EmailRow) {
    sessionStorage.setItem("rib_email", JSON.stringify(row));
    router.push(`/dashboard/emails/${row.id}`);
  }

  const rows = tab === "scheduled" ? scheduled : sent;

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      counts={{ scheduled: scheduledTotal, sent: sentTotal }}
      search={search}
      onSearch={setSearch}
      onRefresh={() => void load(search)}
    >
      {loading ? <ListSkeleton /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyList
          title={tab === "scheduled" ? "No scheduled emails" : "No sent emails"}
          hint={
            tab === "scheduled"
              ? "Compose a message and pick Send Later to fill this list."
              : "Sent and failed messages will show up here."
          }
        />
      ) : null}
      {!loading && tab === "scheduled" && rows.length > 0 ? (
        <ScheduledTable rows={scheduled} onRowClick={openRow} />
      ) : null}
      {!loading && tab === "sent" && rows.length > 0 ? (
        <SentTable rows={sent} onRowClick={openRow} />
      ) : null}
    </AppShell>
  );
}
