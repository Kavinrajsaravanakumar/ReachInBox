"use client";

import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, children, className = "" }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <button className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-md rounded-xl bg-white p-5 shadow-pop ${className}`}>
        {children}
      </div>
    </div>
  );
}
