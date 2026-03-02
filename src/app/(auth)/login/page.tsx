"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Script from "next/script";
import { useAuth } from "@/components/AuthProvider";

declare global {
  interface Window {
    onTurnstileSuccess: (token: string) => void;
    onTurnstileExpired: () => void;
    turnstile?: { reset: (widgetId?: string) => void };
    _turnstileWidgetId?: string;
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    window.onTurnstileExpired = () => setTurnstileToken("");
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA challenge.");
      return;
    }

    setLoading(true);

    try {
      await login(username.trim(), password, turnstileToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      // Reset Turnstile so user can get a fresh token
      window.turnstile?.reset(window._turnstileWidgetId);
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-dark to-navy p-4">
        <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-wide">CoATS</h1>
          <p className="text-gray-300 text-sm mt-1">
            Cases of Anti Terrorism Squad
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            Sign In
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                User ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none transition-colors"
                placeholder="e.g. SP ATS HQ"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none transition-colors"
                placeholder="Enter password"
                required
              />
            </div>

            {/* Cloudflare Turnstile CAPTCHA */}
            <div
              ref={turnstileRef}
              className="cf-turnstile"
              data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              data-callback="onTurnstileSuccess"
              data-expired-callback="onTurnstileExpired"
              data-theme="light"
            />

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full py-2.5 bg-navy hover:bg-navy-light text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Anti Terrorism Squad — Government of Tamil Nadu
        </p>
      </div>
    </div>
    </>
  );
}
