"use client";

import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, children, className = "" }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <button className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-md rounded-xl bg-white p-5 shadow-pop ${className}`}>
        {title ? (
          <div className="mb-3 flex items-center justify-between pb-2 border-b border-line">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink transition-colors"
              aria-label="Close modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
