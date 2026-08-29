"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { decodeUser, setSession, setSlackConnected } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const slack = params.get("slack");
    const error = params.get("error");

    if (error) {
      toast.error(error);
      router.replace("/login");
      return;
    }

    if (slack === "connected") {
      setSlackConnected(true);
      toast.success("Slack connected");
      if (token) {
        setSession(token, decodeUser(token));
      }
      router.replace("/dashboard");
      return;
    }

    if (!token) {
      toast.error("Missing token");
      router.replace("/login");
      return;
    }

    setSession(token, decodeUser(token));
    toast.success("Signed in");
    router.replace("/dashboard");
  }, [router, toast]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      <p className="text-sm text-muted">Signing you in…</p>
    </main>
  );
}
