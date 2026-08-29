"use client";

import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ label, className = "", id, ...rest }: Props) {
  return (
    <label className="block w-full">
      {label ? <span className="mb-1 block text-sm text-muted-2">{label}</span> : null}
      <input
        id={id}
        className={`w-full rounded-lg bg-field px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/30 ${className}`}
        {...rest}
      />
    </label>
  );
}
