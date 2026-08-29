"use client";

import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Textarea({ label, className = "", ...rest }: Props) {
  return (
    <label className="block w-full">
      {label ? <span className="mb-1 block text-sm text-muted-2">{label}</span> : null}
      <textarea
        className={`min-h-[200px] w-full resize-y rounded-xl bg-editor px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/30 ${className}`}
        {...rest}
      />
    </label>
  );
}
