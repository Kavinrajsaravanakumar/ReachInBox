"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiPost } from "@/lib/api";
import { getSenderId, getUser, setSenderId } from "@/lib/auth";
import { isValidEmail } from "@/lib/format";
import type { ScheduleRequest, ScheduleResponse, Sender } from "@/types";

type Props = {
  open?: boolean;
  onClose?: () => void;
  asPage?: boolean;
  onScheduled?: () => void;
};

function tomorrowAt(hours: number, minutes = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ComposeModal({ open = true, onClose, asPage = false, onScheduled }: Props) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const user = getUser();

  const [fromEmail, setFromEmail] = useState(user?.email ?? "");
  const [toInput, setToInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delaySec, setDelaySec] = useState("0");
  const [hourly, setHourly] = useState("0");
  const [scheduleMode, setScheduleMode] = useState<"immediate" | "later">("immediate");
  const [customStartTime, setCustomStartTime] = useState(() => toDatetimeLocal(new Date()));
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const detected = recipients.length;

  const chips = useMemo(() => {
    const shown = recipients.slice(0, 3);
    const extra = recipients.length - shown.length;
    return { shown, extra };
  }, [recipients]);

  function addEmails(list: string[]) {
    const next = new Set(recipients);
    for (const raw of list) {
      const e = raw.trim().toLowerCase();
      if (isValidEmail(e)) next.add(e);
    }
    setRecipients(Array.from(next));
  }

  function onCsv(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const found: string[] = [];
        for (const row of result.data) {
          for (const value of Object.values(row)) {
            if (typeof value === "string" && value.includes("@")) found.push(value);
          }
        }
        if (found.length === 0) {
          Papa.parse<string[]>(file, {
            header: false,
            skipEmptyLines: true,
            complete: (plain) => {
              const emails = plain.data.flat().filter((c) => typeof c === "string" && c.includes("@"));
              addEmails(emails);
            },
          });
          return;
        }
        addEmails(found);
      },
    });
  }

  function close() {
    if (asPage) router.push("/dashboard");
    else onClose?.();
  }

  async function ensureSender(): Promise<string> {
    const existing = getSenderId();
    if (existing) return existing;
    const email = fromEmail.trim() || user?.email || "sender@localhost";
    const sender = await apiPost<Sender>("/api/senders", {
      email,
      displayName: user?.name ?? email,
    });
    setSenderId(sender.id);
    return sender.id;
  }

  async function submit() {
    const all = [...recipients];
    if (toInput.includes("@")) addEmails([toInput]);
    const recips = toInput.includes("@")
      ? Array.from(new Set([...all, toInput.trim().toLowerCase()].filter(isValidEmail)))
      : all;

    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (recips.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }

    let resolvedStartTime: Date;
    if (scheduleMode === "immediate") {
      resolvedStartTime = new Date(); // computed dynamically at submission time
    } else {
      if (!customStartTime) {
        toast.error("Please pick a valid future date and time to schedule");
        return;
      }
      resolvedStartTime = new Date(customStartTime);
    }

    // Client-side guard: ensure resolved start time is not in the past
    if (scheduleMode === "later" && resolvedStartTime.getTime() < Date.now() - 60000) {
      toast.error("The selected start time is in the past. Please update it to a future time or select 'Start immediately'.");
      return;
    }

    setSubmitting(true);
    try {
      const senderId = await ensureSender();
      const delayBetweenEmailsMs = Math.max(0, Number(delaySec || 0) * 1000);
      const maxEmailsPerHour = Number(hourly);
      const bodyPayload: ScheduleRequest = {
        senderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: recips,
        startTime: resolvedStartTime.toISOString(),
        delayBetweenEmailsMs,
        maxEmailsPerHour: Number.isFinite(maxEmailsPerHour) && maxEmailsPerHour > 0 ? maxEmailsPerHour : undefined,
      };
      const result = await apiPost<ScheduleResponse>("/api/emails/schedule", bodyPayload);
      toast.success(`Scheduled ${result.count} email${result.count === 1 ? "" : "s"}`);
      onScheduled?.();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open && !asPage) return null;

  const form = (
    <div className="flex min-h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <button type="button" onClick={close} className="flex items-center gap-3 text-[17px] text-ink">
          <span className="text-xl">←</span>
          Compose New Email
        </button>
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer text-brand">
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf,.png,.jpg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAttachmentName(f.name);
              }}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12.5V17a5 5 0 0 1-10 0V7a3 3 0 1 1 6 0v9.5a1.5 1.5 0 0 1-3 0V8" />
            </svg>
            {attachmentName ? (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                1
              </span>
            ) : null}
          </label>
          <button
            type="button"
            className={`p-1.5 rounded-full transition-colors ${
              scheduleMode === "later"
                ? "bg-brand/10 text-brand ring-1 ring-brand/35"
                : "text-brand hover:bg-canvas"
            }`}
            onClick={() => setScheduleOpen(true)}
            aria-label="Schedule"
            title={scheduleMode === "later" ? `Scheduled for: ${customStartTime}` : "Schedule for later"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </button>
          <Button variant="pill" onClick={() => void submit()} disabled={submitting}>
            {scheduleMode === "immediate" ? "Send" : "Schedule"}
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-8 py-6">
        <Row label="From">
          <div className="inline-flex items-center gap-2 rounded-full bg-field px-3 py-1.5 text-sm text-ink">
            {fromEmail || user?.email || "sender@localhost"}
            <span className="text-muted">▾</span>
          </div>
          <input
            className="sr-only"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            aria-label="From email"
          />
        </Row>

        <Row
          label="To"
          extra={
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-brand"
              onClick={() => fileRef.current?.click()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 20h16" />
              </svg>
              Upload List
            </button>
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCsv(f);
            }}
          />
          <div className="flex min-h-[36px] flex-1 flex-wrap items-center gap-2">
            {chips.shown.map((e) => (
              <span key={e} className="rounded-full border border-brand px-3 py-1 text-sm text-ink">
                {e}
              </span>
            ))}
            {chips.extra > 0 ? (
              <span className="rounded-full border border-brand px-3 py-1 text-sm text-brand">+{chips.extra}</span>
            ) : null}
            <input
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addEmails([toInput]);
                  setToInput("");
                }
              }}
              onBlur={() => {
                if (toInput.includes("@")) {
                  addEmails([toInput]);
                  setToInput("");
                }
              }}
              placeholder={recipients.length ? "" : "recipient@example.com"}
              className="min-w-[180px] flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
          </div>
        </Row>
        {detected > 0 ? (
          <p className="mb-3 pl-[88px] text-sm text-brand">
            {detected} email address{detected === 1 ? "" : "es"} detected
          </p>
        ) : null}

        <Row label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full border-b border-line bg-transparent py-1 text-[15px] outline-none placeholder:text-muted"
          />
        </Row>

        <div className="mb-6 flex flex-wrap items-center gap-8 pl-[88px] text-sm text-muted-2">
          <label className="flex items-center gap-3">
            Delay between 2 emails
            <input
              value={delaySec}
              onChange={(e) => setDelaySec(e.target.value)}
              className="h-9 w-14 rounded-md border border-line bg-white text-center text-ink outline-none focus:ring-2 focus:ring-brand/30"
              inputMode="numeric"
            />
          </label>
          <label className="flex items-center gap-3">
            Hourly Limit
            <input
              value={hourly}
              onChange={(e) => setHourly(e.target.value)}
              className="h-9 w-14 rounded-md border border-line bg-white text-center text-ink outline-none focus:ring-2 focus:ring-brand/30"
              inputMode="numeric"
            />
          </label>
          {/* Assumption: unlabeled Figma "00" fields are seconds for delay and emails/hour for the cap. Delay is converted to ms for POST /api/emails/schedule. */}
        </div>

        <div className="relative rounded-2xl bg-editor px-4 pb-16 pt-14">
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-muted-2 shadow-sm">
            <Tool>↶</Tool>
            <Tool>↷</Tool>
            <Tool>Tt</Tool>
            <span className="mx-1 h-4 w-px bg-line" />
            <Tool className="font-bold">B</Tool>
            <Tool className="italic">I</Tool>
            <Tool className="underline">U</Tool>
            <Tool>☰</Tool>
            <Tool>1.</Tool>
            <Tool>•</Tool>
            <Tool>“</Tool>
            <Tool>🔗</Tool>
            <Tool>S</Tool>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="min-h-[280px] w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          {attachmentName ? (
            <div className="absolute bottom-4 left-4 h-16 w-24 overflow-hidden rounded-md bg-field text-[10px] text-muted-2">
              <div className="flex h-full items-end p-1">{attachmentName}</div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)}>
        <h3 className="mb-4 text-lg font-semibold">Schedule Delivery</h3>
        
        <div className="space-y-3 mb-4">
          <label className="flex items-center gap-3 rounded-lg border border-line p-3 cursor-pointer hover:bg-field">
            <input
              type="radio"
              name="scheduleType"
              checked={scheduleMode === "immediate"}
              onChange={() => setScheduleMode("immediate")}
              className="text-brand focus:ring-brand"
            />
            <div>
              <span className="block text-sm font-semibold text-ink">Start immediately</span>
              <span className="block text-xs text-muted">Send as soon as worker processes the batch (timestamp calculated on submission)</span>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-line p-3 cursor-pointer hover:bg-field">
            <input
              type="radio"
              name="scheduleType"
              checked={scheduleMode === "later"}
              onChange={() => {
                setScheduleMode("later");
                if (!customStartTime) setCustomStartTime(toDatetimeLocal(new Date()));
              }}
              className="mt-0.5 text-brand focus:ring-brand"
            />
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink">Schedule for later</span>
              <span className="block text-xs text-muted mb-2">Pick an explicit date and time in the future</span>
              
              {scheduleMode === "later" ? (
                <div className="mt-2 space-y-3">
                  <label className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2">
                    <span className="text-xs text-muted-2">Date & Time:</span>
                    <input
                      type="datetime-local"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      className="bg-transparent text-xs text-ink outline-none"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-1.5 text-xs text-ink">
                    {[
                      { label: "Current Time", date: new Date() },
                      { label: "In 15 Mins", date: new Date(Date.now() + 15 * 60000) },
                      { label: "In 1 Hour", date: new Date(Date.now() + 60 * 60000) },
                      { label: "Tomorrow 9 AM", date: tomorrowAt(9) },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        className="rounded-md border border-line bg-white px-2 py-1.5 text-left hover:bg-field text-xs truncate"
                        onClick={() => setCustomStartTime(toDatetimeLocal(opt.date))}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="text-sm text-muted-2" onClick={() => setScheduleOpen(false)}>
            Cancel
          </button>
          <Button variant="pill" type="button" onClick={() => setScheduleOpen(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );

  if (asPage) return <div className="min-h-screen">{form}</div>;
  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-white">
      {form}
    </div>
  );
}

function Row({
  label,
  children,
  extra,
}: {
  label: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-6 border-b border-line/70 pb-4">
      <span className="w-[72px] shrink-0 pt-1 text-[15px] text-muted-2">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {children}
        {extra}
      </div>
    </div>
  );
}

function Tool({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`px-0.5 text-sm ${className}`}>{children}</span>;
}
