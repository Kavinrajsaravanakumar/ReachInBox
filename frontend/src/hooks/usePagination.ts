import { useState, useMemo, useCallback } from "react";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";

export interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const [page, setPage] = useState(options.initialPage ?? 1);
  const [limit, setLimit] = useState(options.pageSize ?? DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const canNext = page < totalPages;
  const canPrev = page > 1;

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(p - 1, 1));
  }, []);

  const goToPage = useCallback(
    (targetPage: number) => {
      setPage(Math.max(1, Math.min(targetPage, totalPages)));
    },
    [totalPages],
  );

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  const fromIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const toIndex = Math.min(page * limit, total);

  return {
    page,
    limit,
    total,
    totalPages,
    canNext,
    canPrev,
    fromIndex,
    toIndex,
    setPage,
    setLimit,
    setTotal,
    nextPage,
    prevPage,
    goToPage,
    resetPage,
  };
}
