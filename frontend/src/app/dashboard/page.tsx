"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ScheduledTable } from "@/components/emails/ScheduledTable";
import { SentTable } from "@/components/emails/SentTable";
import { EmptyList, ListSkeleton } from "@/components/emails/ListStates";
import { Button } from "@/components/ui/Button";
import { apiGet } from "@/lib/api";
import { getToken, setSlackConnected } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import type { EmailListResponse, EmailRow } from "@/types";

const PAGE_SIZE = 9;

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [search, setSearch] = useState("");

  const [scheduledPage, setScheduledPage] = useState(1);
  const [sentPage, setSentPage] = useState(1);

  const [scheduled, setScheduled] = useState<EmailRow[]>([]);
  const [sent, setSent] = useState<EmailRow[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentPage = tab === "scheduled" ? scheduledPage : sentPage;
  const currentTotal = tab === "scheduled" ? scheduledTotal : sentTotal;
  const totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));

  const load = useCallback(async (q: string, sPage: number, snPage: number) => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const qs = q.trim() ? `&search=${encodeURIComponent(q.trim())}` : "";

      const [schedRes, sentRes, failedRes] = await Promise.all([
        apiGet<EmailListResponse>(`/api/emails?status=scheduled&limit=${PAGE_SIZE}&page=${sPage}${qs}`),
        apiGet<EmailListResponse>(`/api/emails?status=sent&limit=${PAGE_SIZE}&page=${snPage}${qs}`),
        apiGet<EmailListResponse>(`/api/emails?status=failed&limit=${PAGE_SIZE}&page=${snPage}${qs}`),
      ]);

      setScheduled(schedRes.items);
      setScheduledTotal(schedRes.total);

      // Combine sent and failed for display
      const combinedSent = [...sentRes.items, ...failedRes.items];
      setSent(combinedSent);
      setSentTotal(sentRes.total + failedRes.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load emails");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(search, scheduledPage, sentPage);
    }, search ? 280 : 0);

    const interval = setInterval(() => {
      void load(search, scheduledPage, sentPage);
    }, 3500);

    return () => {
      window.clearTimeout(t);
      clearInterval(interval);
    };
  }, [search, scheduledPage, sentPage, load]);

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

  function handleTabChange(t: "scheduled" | "sent") {
    setTab(t);
  }

  function openRow(row: EmailRow) {
    sessionStorage.setItem("rib_email", JSON.stringify(row));
    router.push(`/dashboard/emails/${row.id}`);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    if (tab === "scheduled") setScheduledPage(newPage);
    else setSentPage(newPage);
  }

  const rows = tab === "scheduled" ? scheduled : sent;
  const startCount = (currentPage - 1) * PAGE_SIZE + (rows.length > 0 ? 1 : 0);
  const endCount = Math.min(currentPage * PAGE_SIZE, currentTotal);

  return (
    <AppShell
      tab={tab}
      onTab={handleTabChange}
      counts={{ scheduled: scheduledTotal, sent: sentTotal }}
      search={search}
      onSearch={(v) => {
        setSearch(v);
        setScheduledPage(1);
        setSentPage(1);
      }}
      onRefresh={() => void load(search, scheduledPage, sentPage)}
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

      {/* Pagination Controls */}
      <div
        style={{ display: !loading && currentTotal >= 9 ? "flex" : "none" }}
        className="mt-4 flex items-center justify-between border-t border-line px-2 pt-4"
      >
        <div className="text-xs text-muted">
          Showing <span className="font-semibold text-ink">{startCount}</span> to{" "}
          <span className="font-semibold text-ink">{endCount}</span> of{" "}
          <span className="font-semibold text-ink">{currentTotal}</span> emails
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            Page <span className="font-semibold text-ink">{currentPage}</span> of{" "}
            <span className="font-semibold text-ink">{totalPages}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="h-8 px-2.5 text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="h-8 px-2.5 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
