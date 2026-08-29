import { clearSession, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/config/constants";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function handle401(): never {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
  throw new ApiError("Unauthorized", 401);
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 401) handle401();
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T);
  if (!res.ok) {
    const err = data as { error?: string };
    throw new ApiError(err.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

function headers(json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: headers(false), cache: "no-store" });
  return parse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: isFormData
      ? { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }
      : headers(true),
    body: isFormData ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: headers(true),
  });
  return parse<T>(res);
}

export { API_BASE_URL, API_BASE_URL as API_URL };
