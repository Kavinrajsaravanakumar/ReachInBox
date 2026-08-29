"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { apiPost, apiUrl } from "@/lib/api";
import { setSession } from "@/lib/auth";
import type { DevAuthResponse } from "@/types";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.7 7.2l.1.1 6.3 5.3C36.9 41.5 44 36 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter an email");
      return;
    }
    setBusy(true);
    try {
      const name = email.split("@")[0] || "User";
      const res = await apiPost<DevAuthResponse>("/api/auth/dev", { email: email.trim(), name });
      setSession(res.token, res.user);
      toast.success("Logged in");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={onEmailLogin} className="w-full max-w-[380px] rounded-login bg-white px-8 py-10 shadow-card">
        <h1 className="mb-8 text-center text-[28px] font-bold text-ink">Login</h1>
        <Button
          type="button"
          variant="google"
          onClick={() => {
            window.location.href = apiUrl("/api/auth/google");
          }}
        >
          <GoogleMark />
          Login with Google
        </Button>
        <div className="relative my-6">
          <div className="h-px bg-line" />
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-[11px] text-muted">
            or, Sign up through email
          </p>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Email ID"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {/* Assumption: Figma password field has no backend; email login uses POST /api/auth/dev (DEV_AUTH_ENABLED). Password is not sent. */}
        <div className="mt-6">
          <Button type="submit" disabled={busy}>
            Login
          </Button>
        </div>
      </form>
    </main>
  );
}
