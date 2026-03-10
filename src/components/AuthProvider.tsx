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

// Inactivity timeout — auto-logout after 15 minutes of no user activity
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

// Activity events to track
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFactorPending, setTwoFactorPending] = useState<{
    required: boolean;
    totpEnabled: boolean;
  } | null>(null);
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivity = useRef<number>(Date.now());

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const forceLogout = useCallback(async () => {
    clearRefreshTimer();
    clearInactivityTimer();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    setUser(null);
    router.push("/login");
  }, [clearRefreshTimer, clearInactivityTimer, router]);

  const resetInactivityTimer = useCallback(() => {
    lastActivity.current = Date.now();
    clearInactivityTimer();
    inactivityTimer.current = setTimeout(() => {
      forceLogout();
    }, INACTIVITY_TIMEOUT);
  }, [clearInactivityTimer, forceLogout]);

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
      // Only refresh if user has been active within the last 15 minutes
      const timeSinceActivity = Date.now() - lastActivity.current;
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        forceLogout();
        return;
      }

      const ok = await refreshTokens();
      if (!ok) {
        clearRefreshTimer();
        clearInactivityTimer();
        setUser(null);
        router.push("/login");
      }
    }, REFRESH_INTERVAL);
  }, [clearRefreshTimer, clearInactivityTimer, refreshTokens, forceLogout, router]);

  const startSessionTimers = useCallback(() => {
    startRefreshTimer();
    resetInactivityTimer();
  }, [startRefreshTimer, resetInactivityTimer]);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setUser(json.data);
        startSessionTimers();
      } else {
        // Access token expired — try refresh
        const refreshed = await refreshTokens();
        if (refreshed) {
          startSessionTimers();
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshTokens, startSessionTimers]);

  // Track user activity to reset the inactivity timer
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => resetInactivityTimer();

    ACTIVITY_EVENTS.forEach((event) =>
      document.addEventListener(event, handleActivity, { passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        document.removeEventListener(event, handleActivity)
      );
    };
  }, [user, resetInactivityTimer]);

  // Handle tab visibility — check session when user returns to tab
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const timeSinceActivity = Date.now() - lastActivity.current;
        if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
          forceLogout();
          return;
        }
        // Tab became visible — verify session is still valid
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          const refreshed = await refreshTokens();
          if (!refreshed) {
            forceLogout();
            return;
          }
        }
        resetInactivityTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, refreshTokens, forceLogout, resetInactivityTimer]);

  useEffect(() => {
    fetchSession();
    return () => {
      clearRefreshTimer();
      clearInactivityTimer();
    };
  }, [fetchSession, clearRefreshTimer, clearInactivityTimer]);

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
    startSessionTimers();
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
    startSessionTimers();
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
    startSessionTimers();
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
      startSessionTimers();
    }

    return { recoveryCodes: json.data.recoveryCodes };
  };

  const logout = async () => {
    clearRefreshTimer();
    clearInactivityTimer();
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
