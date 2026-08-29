"use client";

import type { ReactNode } from "react";

type Tone = "scheduled" | "sent" | "failed" | "neutral";

const tones: Record<Tone, string> = {
  scheduled: "bg-scheduled-bg text-scheduled-text",
  sent: "bg-sent-bg text-sent-text",
  failed: "bg-failed-bg text-failed-text",
  neutral: "bg-field text-muted-2",
};

type Props = {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
};

export function Badge({ tone = "neutral", children, className = "", icon }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
