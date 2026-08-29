"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ComposeModal } from "@/components/emails/ComposeModal";
import { getToken } from "@/lib/auth";

export default function ComposePage() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  return (
    <ComposeModal
      asPage
      open
      onScheduled={() => router.push("/dashboard")}
    />
  );
}
