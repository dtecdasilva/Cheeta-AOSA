"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth/users";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The signed-in user, for screens that show or hide things by role.
 *
 * The portal layouts already know the user (requireRole, on the server) and
 * pass it in as `initialUser`, so a portal page has the right user from its
 * first render instead of waiting for /api/auth/session: no Add or Edit
 * button can be hidden because that request was slow, failed or came back
 * out of order. The session is still re-read on every page change, and an
 * answer older than the latest request is ignored.
 */
export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: PublicUser | null }) {
  const [user, setUser] = useState<PublicUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);
  const router = useRouter();
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return; // keep what we have; the server still enforces every request
      const data = await res.json();
      if (ticket === latest.current) setUser(data.user ?? null);
    } catch {
      // A network hiccup isn't a sign-out: keep the current user.
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, []);

  // The provider lives in the root layout and survives client-side navigation, so signing in (or out, or
  // resetting a password) on one page and moving to another would otherwise leave it holding the old
  // session: a newly signed-in administrator would see no Add or Edit buttons until a full reload.
  // Re-reading the session on every page change keeps it in step with the cookie.
  const pathname = usePathname();
  useEffect(() => {
    // A deliberate synchronization with an external system (the session API), not a pattern that needs
    // restructuring away from setState-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh, pathname]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  return <AuthContext.Provider value={{ user, loading, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
