"use client";

import type { ReactNode } from "react";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
};

type Props<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
};

export function Tabs<T extends string>({ items, value, onChange }: Props<T>) {
  return (
    <nav className="flex flex-col gap-1">
      <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Core</p>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] ${
              active ? "bg-brand-nav font-medium text-brand-ink" : "text-muted-2 hover:bg-field"
            }`}
          >
            <span className={active ? "text-brand-ink" : "text-muted"}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.count != null ? (
              <span className={`text-sm ${active ? "text-brand-ink" : "text-muted"}`}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
