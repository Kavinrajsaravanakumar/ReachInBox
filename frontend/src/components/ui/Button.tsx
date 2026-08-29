"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "google" | "outline" | "ghost" | "pill";

const variants: Record<Variant, string> = {
  primary:
    "w-full rounded-lg bg-brand-forest py-3 text-[15px] font-semibold text-white hover:bg-brand-hover",
  google:
    "flex w-full items-center justify-center gap-3 rounded-lg bg-brand-google py-3 text-[15px] font-medium text-ink hover:bg-brand-googleHover",
  outline:
    "rounded-full border border-brand px-8 py-2 text-[15px] font-medium text-brand hover:bg-brand-mint",
  ghost: "rounded-md px-3 py-1.5 text-sm text-muted-2 hover:bg-field",
  pill: "rounded-full border border-brand bg-white px-5 py-2 text-sm font-medium text-brand hover:bg-brand-mint",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function Button({ variant = "primary", className = "", children, ...rest }: Props) {
  return (
    <button
      className={`${variants[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
