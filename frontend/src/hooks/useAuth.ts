"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, getUser, setSession } from "@/lib/auth";
import type { User } from "@/types";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const currentUser = getUser();
    if (token && currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const login = useCallback(
    (token: string, userData?: User) => {
      setSession(token, userData);
      setUser(getUser());
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router]);

  return {
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
  };
}
