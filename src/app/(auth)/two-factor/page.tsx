"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = "verify" | "setup" | "recovery-codes" | "recovery-input";

export default function TwoFactorPage() {
  const { twoFactorPending, verify2FA, verify2FARecovery, complete2FASetup } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("verify");
  const [otpCode, setOtpCode] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Setup state
  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCodesSaved, setRecoveryCodesSaved] = useState(false);

  useEffect(() => {
    if (!twoFactorPending) {
      router.push("/login");
      return;
    }

    if (!twoFactorPending.totpEnabled) {
      // First-time setup — fetch QR code
      setStep("setup");
      fetchSetup();
    } else {
      setStep("verify");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSetup() {
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setQrCode(json.data.qrCode);
      setManualSecret(json.data.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load 2FA setup");
    }
  }

  // ── OTP Verification (login flow) ──
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verify2FA(otpCode.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  }

  // ── Recovery Code (login flow) ──
  async function handleRecoverySubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verify2FARecovery(recoveryInput.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Setup Verification (first login) ──
  async function handleSetupVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await complete2FASetup(otpCode.trim());
      setRecoveryCodes(result.recoveryCodes);
      setStep("recovery-codes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  }

  function handleContinueAfterCodes() {
    router.push("/cases");
  }

  function copyRecoveryCodes() {
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
  }

  // ── Render ──────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-dark to-navy p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-1">
          <img
            src="/coats_login.png"
            alt="CoATS — Cases of Anti Terrorism Squad"
            className="w-72 object-contain drop-shadow-lg"
          />
        </div>
        <div className="text-center mb-4">
          <p className="text-gray-300 text-sm mt-1">
            Two-Factor Authentication
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          {/* ── Step: OTP Verification ── */}
          {step === "verify" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-navy/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Enter Verification Code
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Open your authenticator app and enter the 6-digit code
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={setOtpCode}
                    disabled={loading}
                    autoFocus
                    autoComplete="one-time-code"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-2.5 bg-navy hover:bg-navy-light text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setError(""); setStep("recovery-input"); }}
                  className="text-sm text-navy hover:underline cursor-pointer"
                >
                  Use a recovery code instead
                </button>
              </div>
            </>
          )}

          {/* ── Step: Recovery Code Input ── */}
          {step === "recovery-input" && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">
                  Recovery Code
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Enter one of your recovery codes
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleRecoverySubmit} className="space-y-5">
                <div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={recoveryInput}
                    onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                    placeholder="XXXX-XXXX"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !recoveryInput.trim()}
                  className="w-full py-2.5 bg-navy hover:bg-navy-light text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Verifying..." : "Verify Recovery Code"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setError(""); setStep("verify"); }}
                  className="text-sm text-navy hover:underline cursor-pointer"
                >
                  Back to OTP verification
                </button>
              </div>
            </>
          )}

          {/* ── Step: 2FA Setup (first time) ── */}
          {step === "setup" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Set Up Two-Factor Authentication
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Scan the QR code with Google Authenticator or any TOTP app
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {qrCode && (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <img
                      src={qrCode}
                      alt="Scan this QR code with your authenticator app"
                      className="w-48 h-48 border rounded-lg"
                    />
                  </div>

                  {/* Manual entry secret */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1 text-center">
                      Can&apos;t scan? Enter this code manually:
                    </p>
                    <p className="text-sm font-mono text-center tracking-wider text-gray-800 select-all break-all">
                      {manualSecret}
                    </p>
                  </div>

                  {/* Verify OTP */}
                  <form onSubmit={handleSetupVerify} className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                        Enter the 6-digit code from your app
                      </p>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={otpCode}
                          onChange={setOtpCode}
                          disabled={loading}
                          autoComplete="one-time-code"
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="w-full py-2.5 bg-navy hover:bg-navy-light text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "Verifying..." : "Verify & Enable 2FA"}
                    </button>
                  </form>
                </div>
              )}

              {!qrCode && !error && (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}

          {/* ── Step: Recovery Codes Display ── */}
          {step === "recovery-codes" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Save Your Recovery Codes
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Store these codes in a safe place. Each code can only be used once.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((code, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm text-gray-800 bg-white rounded px-3 py-2 text-center border"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={copyRecoveryCodes}
                className="w-full py-2 mb-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Copy All Codes
              </button>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="saved"
                  checked={recoveryCodesSaved}
                  onChange={(e) => setRecoveryCodesSaved(e.target.checked)}
                  className="w-4 h-4 accent-navy"
                />
                <label htmlFor="saved" className="text-sm text-gray-600">
                  I have saved these recovery codes
                </label>
              </div>

              <button
                onClick={handleContinueAfterCodes}
                disabled={!recoveryCodesSaved}
                className="w-full py-2.5 bg-navy hover:bg-navy-light text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Continue to CoATS
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Anti Terrorism Squad - Government of Tamil Nadu
        </p>
      </div>
    </div>
  );
}
