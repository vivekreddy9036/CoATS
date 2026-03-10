"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";

type Step =
  // ── First-time mandatory setup (both required) ──
  | "setup-passkey"     // Step 1: register passkey
  | "setup-totp"        // Step 2: set up authenticator app
  | "recovery-codes"    // Step 3: save recovery codes
  // ── Returning login (choose one) ──
  | "choose-method"     // pick Passkey vs TOTP
  | "verify"            // OTP input
  | "passkey-verify"    // passkey prompt
  | "recovery-input";   // recovery code fallback

export default function TwoFactorPage() {
  const {
    twoFactorPending,
    verify2FA,
    verify2FARecovery,
    complete2FASetup,
    getPasskeyRegistrationOptions,
    completePasskeyRegistration,
    getPasskeyAuthOptions,
    verifyPasskey,
  } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("choose-method");
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

  // Passkey setup state
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyDone, setPasskeyDone] = useState(false);

  useEffect(() => {
    if (!twoFactorPending) {
      router.push("/login");
      return;
    }

    const { totpEnabled, passkeyEnabled } = twoFactorPending;

    if (!totpEnabled && !passkeyEnabled) {
      // Fresh account — start full mandatory setup
      setStep("setup-passkey");
    } else if (totpEnabled && passkeyEnabled) {
      // Both done — choose a method to verify
      setStep("choose-method");
    } else if (passkeyEnabled && !totpEnabled) {
      // Passkey registered but TOTP not completed (e.g. refreshed mid-setup)
      // Force them back to TOTP setup to finish the mandatory wizard.
      setPasskeyDone(true);
      setStep("setup-totp");
      fetchSetup();
    } else if (totpEnabled && !passkeyEnabled) {
      // TOTP done but passkey not registered (e.g. refreshed mid-setup)
      setStep("setup-passkey");
    } else {
      setStep("verify");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSetup() {
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error);
      setQrCode(json.data.qrCode);
      setManualSecret(json.data.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load 2FA setup");
    }
  }

  // ── Passkey Setup (Step 1 of mandatory setup) ──
  async function handlePasskeySetup() {
    setError("");
    setLoading(true);

    if (!browserSupportsWebAuthn()) {
      setError(
        "Passkey is not supported in this browser. " +
        "WebAuthn requires HTTPS or localhost. " +
        "If you're on a phone, please use HTTPS to access this site."
      );
      setLoading(false);
      return;
    }

    try {
      const options = await getPasskeyRegistrationOptions();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const credential = await startRegistration({ optionsJSON: options as any });
      // setupOnly=true: registers passkey but keeps 2fa_pending alive for TOTP setup
      await completePasskeyRegistration(credential, passkeyName || undefined, true);
      setPasskeyDone(true);
      // Proceed to TOTP setup
      setStep("setup-totp");
      fetchSetup();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Passkey registration was cancelled. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Passkey setup failed");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── TOTP Setup Verify (Step 2 of mandatory setup) ──
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

  // ── OTP Verification (returning login) ──
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

  // ── Passkey Verification (returning login) ──
  async function handlePasskeyVerify() {
    setError("");
    setLoading(true);

    if (!browserSupportsWebAuthn()) {
      setError(
        "Passkey is not supported in this browser. " +
        "WebAuthn requires HTTPS or localhost. " +
        "Please use the authenticator app or a recovery code instead."
      );
      setLoading(false);
      return;
    }

    try {
      const options = await getPasskeyAuthOptions();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const credential = await startAuthentication({ optionsJSON: options as any });
      const result = await verifyPasskey(credential);
      // Passkey verified but TOTP setup was never finished — resume setup wizard
      if (result?.setupRequired) {
        setPasskeyDone(true);
        setStep("setup-totp");
        fetchSetup();
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Passkey verification was cancelled.");
      } else {
        setError(err instanceof Error ? err.message : "Passkey verification failed");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Recovery Code (returning login) ──
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

  function handleContinueAfterCodes() {
    router.push("/cases");
  }

  function copyRecoveryCodes() {
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
  }

  // ── Step progress indicator for setup ──
  function SetupStepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
    const steps = [
      { num: 1, label: "Passkey" },
      { num: 2, label: "Auth App" },
      { num: 3, label: "Backup" },
    ];
    return (
      <div className="flex items-center justify-center gap-1 mb-6">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  s.num < currentStep
                    ? "bg-green-500 text-white"
                    : s.num === currentStep
                    ? "bg-navy text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {s.num < currentStep ? "✓" : s.num}
              </div>
              <span className="text-[10px] text-gray-500 mt-1">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-10 h-0.5 mb-4 mx-1 ${
                  s.num < currentStep ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
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

          {/* ══════════════════════════════════════════════
               FIRST-TIME SETUP — Step 1: Register Passkey
             ══════════════════════════════════════════════ */}
          {step === "setup-passkey" && (
            <>
              <SetupStepIndicator currentStep={1} />

              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Step 1: Register a Passkey
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Your device will prompt you to use fingerprint, face, or a security key
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name this passkey (optional)
                  </label>
                  <input
                    type="text"
                    value={passkeyName}
                    onChange={(e) => setPasskeyName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none text-sm"
                    placeholder='e.g. "Work Laptop", "iPhone"'
                    maxLength={100}
                  />
                </div>

                <button
                  onClick={handlePasskeySetup}
                  disabled={loading}
                  className="w-full py-3 bg-navy hover:bg-navy-light text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Waiting for device...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                      </svg>
                      Register Passkey
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Both methods are required.</strong> You&apos;ll set up a passkey first, then an authenticator app.
                  This ensures you can always log in, even from a different device.
                </p>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════
               FIRST-TIME SETUP — Step 2: TOTP Setup
             ══════════════════════════════════════════════ */}
          {step === "setup-totp" && (
            <>
              <SetupStepIndicator currentStep={2} />

              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Step 2: Set Up Authenticator App
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Scan the QR code with Google Authenticator or any TOTP app
                </p>
              </div>

              {passkeyDone && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Passkey registered successfully!
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {qrCode && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img
                      src={qrCode}
                      alt="Scan this QR code with your authenticator app"
                      className="w-48 h-48 border rounded-lg"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1 text-center">
                      Can&apos;t scan? Enter this code manually:
                    </p>
                    <p className="text-sm font-mono text-center tracking-wider text-gray-800 select-all break-all">
                      {manualSecret}
                    </p>
                  </div>

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

          {/* ══════════════════════════════════════════════
               FIRST-TIME SETUP — Step 3: Recovery Codes
             ══════════════════════════════════════════════ */}
          {step === "recovery-codes" && (
            <>
              {/* Show step indicator only during first-time setup */}
              {passkeyDone && <SetupStepIndicator currentStep={3} />}

              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {passkeyDone ? "Step 3: Save Recovery Codes" : "Save Your Recovery Codes"}
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

          {/* ══════════════════════════════════════════════
               RETURNING LOGIN — Choose Method
             ══════════════════════════════════════════════ */}
          {step === "choose-method" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-navy/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Verify Your Identity
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Choose how you&apos;d like to verify
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setStep("passkey-verify")}
                  className="w-full flex items-center gap-4 p-4 border-2 border-navy bg-navy/5 rounded-xl hover:bg-navy/10 transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800">Passkey</p>
                    <p className="text-xs text-gray-500">Fingerprint, face, or security key</p>
                  </div>
                  <span className="text-xs bg-navy text-white px-2 py-0.5 rounded-full ml-auto">Recommended</span>
                </button>

                <button
                  onClick={() => setStep("verify")}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-navy hover:bg-navy/5 transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800">Authenticator App</p>
                    <p className="text-xs text-gray-500">Enter a 6-digit code</p>
                  </div>
                </button>
              </div>

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

          {/* ══════════════════════════════════════════════
               RETURNING LOGIN — Passkey Verify
             ══════════════════════════════════════════════ */}
          {step === "passkey-verify" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Verify with Passkey
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Use your fingerprint, face recognition, or security key
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handlePasskeyVerify}
                disabled={loading}
                className="w-full py-3 bg-navy hover:bg-navy-light text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Waiting for passkey...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    Verify with Passkey
                  </>
                )}
              </button>

              <div className="mt-4 space-y-2 text-center">
                {twoFactorPending?.totpEnabled && (
                  <button
                    onClick={() => { setError(""); setStep("verify"); }}
                    className="text-sm text-navy hover:underline cursor-pointer block mx-auto"
                  >
                    Use authenticator app instead
                  </button>
                )}
                <button
                  onClick={() => { setError(""); setStep("recovery-input"); }}
                  className="text-sm text-navy hover:underline cursor-pointer block mx-auto"
                >
                  Use a recovery code
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════
               RETURNING LOGIN — OTP Verification
             ══════════════════════════════════════════════ */}
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

              <div className="mt-4 space-y-2 text-center">
                {twoFactorPending?.passkeyEnabled && (
                  <button
                    onClick={() => { setError(""); setStep("passkey-verify"); }}
                    className="text-sm text-navy hover:underline cursor-pointer block mx-auto"
                  >
                    Use passkey instead
                  </button>
                )}
                <button
                  onClick={() => { setError(""); setStep("recovery-input"); }}
                  className="text-sm text-navy hover:underline cursor-pointer block mx-auto"
                >
                  Use a recovery code instead
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════
               RETURNING LOGIN — Recovery Code Input
             ══════════════════════════════════════════════ */}
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
                  onClick={() => {
                    setError("");
                    setStep("choose-method");
                  }}
                  className="text-sm text-navy hover:underline cursor-pointer"
                >
                  Back to verification
                </button>
              </div>
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
