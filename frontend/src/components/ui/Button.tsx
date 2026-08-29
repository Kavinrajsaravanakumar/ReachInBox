"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "google" | "outline" | "ghost" | "pill";
type Size = "sm" | "md" | "lg";

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

const sizes: Record<Size, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({ variant = "primary", size, className = "", children, ...rest }: Props) {
  const sizeClass = size ? sizes[size] : "";
  return (
    <button
      className={`${variants[variant]} ${sizeClass} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
