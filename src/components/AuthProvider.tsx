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
  twoFactorPending: { required: boolean; totpEnabled: boolean } | null;
  login: (username: string, password: string, turnstileToken: string) => Promise<void>;
  verify2FA: (token: string) => Promise<{ recoveryCodes?: string[] }>;
  verify2FARecovery: (code: string) => Promise<void>;
  complete2FASetup: (token: string) => Promise<{ recoveryCodes: string[] }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Refresh the access token 1 minute before it expires (15m token → refresh at 14m)
const REFRESH_INTERVAL = 14 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFactorPending, setTwoFactorPending] = useState<{
    required: boolean;
    totpEnabled: boolean;
  } | null>(null);
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

    // Check if 2FA is required
    if (json.data?.requires2FA) {
      setTwoFactorPending({
        required: true,
        totpEnabled: json.data.totpEnabled,
      });
      router.push("/two-factor");
      return;
    }

    setUser(json.data.user);
    startRefreshTimer();
    router.push("/cases");
  };

  /** Verify TOTP code during login */
  const verify2FA = async (token: string): Promise<{ recoveryCodes?: string[] }> => {
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || "Verification failed");
    }

    setUser(json.data.user);
    setTwoFactorPending(null);
    startRefreshTimer();
    router.push("/cases");

    return { recoveryCodes: json.data.recoveryCodes };
  };

  /** Verify recovery code during login */
  const verify2FARecovery = async (code: string) => {
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryCode: code }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || "Verification failed");
    }

    setUser(json.data.user);
    setTwoFactorPending(null);
    startRefreshTimer();
    router.push("/cases");
  };

  /** Complete 2FA setup (first-time): verify OTP + enable 2FA */
  const complete2FASetup = async (token: string): Promise<{ recoveryCodes: string[] }> => {
    const res = await fetch("/api/auth/2fa/verify-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || "Setup verification failed");
    }

    // If user data is returned (login flow), set session
    if (json.data.user) {
      setUser(json.data.user);
      setTwoFactorPending(null);
      startRefreshTimer();
    }

    return { recoveryCodes: json.data.recoveryCodes };
  };

  const logout = async () => {
    clearRefreshTimer();
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        twoFactorPending,
        login,
        verify2FA,
        verify2FARecovery,
        complete2FASetup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
