"use client";

import React from "react";
import { Button } from "./Button";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  fromIndex: number;
  toIndex: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  fromIndex,
  toIndex,
  canPrev,
  canNext,
  onPrev,
  onNext,
  className = "",
}: PaginationProps) {
  if (total === 0) return null;

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-t border-line text-sm text-muted ${className}`}>
      <div>
        Showing <span className="font-medium text-ink">{fromIndex}</span> to{" "}
        <span className="font-medium text-ink">{toIndex}</span> of{" "}
        <span className="font-medium text-ink">{total}</span> emails
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!canPrev}
        >
          Previous
        </Button>
        <span className="text-xs px-2 text-muted-2">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!canNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
