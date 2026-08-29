"use client";

import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/emails/StatusBadge";
import { displayNameFromEmail } from "@/lib/format";
import type { EmailRow } from "@/types";

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6C6C6" strokeWidth="1.6">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9L12 3.5z" />
    </svg>
  );
}

export function SentTable({
  rows,
  onRowClick,
}: {
  rows: EmailRow[];
  onRowClick?: (row: EmailRow) => void;
}) {
  return (
    <Table
      hideHeader
      rows={rows}
      rowKey={(r) => r.id}
      onRowClick={onRowClick}
      columns={[
        {
          key: "email",
          header: "Email",
          className: "w-[220px]",
          render: (r) => (
            <span className="text-[15px] font-semibold text-ink">
              To: {displayNameFromEmail(r.recipientEmail)}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          className: "w-[90px]",
          render: (r) => <StatusBadge status={r.status} />,
        },
        {
          key: "subject",
          header: "Subject",
          render: (r) => (
            <p className="truncate text-[15px]">
              <span className="font-semibold text-ink">{r.subject}</span>
              <span className="text-muted"> — {r.body}</span>
            </p>
          ),
        },
        {
          key: "sent",
          header: "Sent time",
          className: "w-10 text-right",
          render: () => <StarIcon />,
        },
      ]}
    />
  );
}
