"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/types";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string, turnstileToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Refresh the access token 1 minute before it expires (15m token → refresh at 14m)
const REFRESH_INTERVAL = 14 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setUser(json.data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    clearRefreshTimer();
    refreshTimer.current = setInterval(async () => {
      const ok = await refreshTokens();
      if (!ok) {
        clearRefreshTimer();
        setUser(null);
        router.push("/login");
      }
    }, REFRESH_INTERVAL);
  }, [clearRefreshTimer, refreshTokens, router]);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setUser(json.data);
        startRefreshTimer();
      } else {
        // Access token expired — try refresh
        const refreshed = await refreshTokens();
        if (refreshed) {
          startRefreshTimer();
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshTokens, startRefreshTimer]);

  useEffect(() => {
    fetchSession();
    return () => clearRefreshTimer();
  }, [fetchSession, clearRefreshTimer]);

  const login = async (username: string, password: string, turnstileToken: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, turnstileToken }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || "Login failed");
    }

    setUser(json.data.user);
    startRefreshTimer();
    router.push("/cases");
  };

  const logout = async () => {
    clearRefreshTimer();
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
