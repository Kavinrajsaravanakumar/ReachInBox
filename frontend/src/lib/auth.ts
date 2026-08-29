import type { AuthPayload, User } from "@/types";

const TOKEN_KEY = "rib_token";
const USER_KEY = "rib_user";
const SENDER_KEY = "rib_sender_id";
const SLACK_KEY = "rib_slack_connected";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY) ?? sessionMemory.token;
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
  return sessionMemory.user;
}

const sessionMemory: { token: string | null; user: User | null } = {
  token: null,
  user: null,
};

export function setSession(token: string, user?: User | null): void {
  sessionMemory.token = token;
  sessionMemory.user = user ?? decodeUser(token);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  if (sessionMemory.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(sessionMemory.user));
  }
  document.cookie = `rib_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

export function clearSession(): void {
  sessionMemory.token = null;
  sessionMemory.user = null;
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(SENDER_KEY);
  document.cookie = "rib_token=; path=/; max-age=0";
}

export function decodeUser(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as AuthPayload;
    const email = payload.email || "";
    const name = payload.name || email.split("@")[0] || "Account";
    return { id: payload.sub, email, name };
  } catch {
    return null;
  }
}

export function getSenderId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SENDER_KEY);
}

export function setSenderId(id: string): void {
  window.localStorage.setItem(SENDER_KEY, id);
}

export function setSlackConnected(value: boolean): void {
  window.localStorage.setItem(SLACK_KEY, value ? "1" : "0");
}

export function isSlackConnected(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SLACK_KEY) === "1";
}
