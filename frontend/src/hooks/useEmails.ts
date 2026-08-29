"use client";

import { useState, useCallback, useEffect } from "react";
import { apiGet } from "@/lib/api";
import type { EmailListResponse, EmailRow, EmailStatus } from "@/types";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";

export interface UseEmailsOptions {
  status?: EmailStatus;
  search?: string;
  page?: number;
  limit?: number;
  autoFetch?: boolean;
}

export function useEmails(options: UseEmailsOptions = {}) {
  const [items, setItems] = useState<EmailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(
    async (params?: { status?: EmailStatus; search?: string; page?: number; limit?: number }) => {
      const status = params?.status ?? options.status;
      const search = params?.search ?? options.search;
      const page = params?.page ?? options.page ?? 1;
      const limit = params?.limit ?? options.limit ?? DEFAULT_PAGE_SIZE;

      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (status) queryParams.set("status", status);
        if (search && search.trim()) queryParams.set("search", search.trim());
        queryParams.set("page", String(page));
        queryParams.set("limit", String(limit));

        const res = await apiGet<EmailListResponse>(`/api/emails?${queryParams.toString()}`);
        setItems(res.items);
        setTotal(res.total);
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load emails";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [options.status, options.search, options.page, options.limit],
  );

  useEffect(() => {
    if (options.autoFetch) {
      void fetchEmails();
    }
  }, [options.autoFetch, fetchEmails]);

  return {
    items,
    total,
    loading,
    error,
    fetchEmails,
  };
}
