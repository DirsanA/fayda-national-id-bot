"use client";

import { useState } from "react";

type FaydaApiFormProps = {
  onSuccess: (idData: any) => void;
  onError: (msg: string) => void;
};

export function FaydaApiForm({ onSuccess, onError }: FaydaApiFormProps) {
  const [step, setStep] = useState<"send_otp" | "verify_otp">("send_otp");
  const [fanNumber, setFanNumber] = useState("");
  const [session, setSession] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [remainingPoints, setRemainingPoints] = useState<number | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedFan = fanNumber.replace(/\s+/g, "");
    if (!/^\d{16}$/.test(cleanedFan)) {
      onError("Please enter a valid 16-digit FAN number.");
      return;
    }

    setLoading(true);
    onError("");

    try {
      const res = await fetch("/api/fayda/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fanNumber: cleanedFan }),
      });

      let data: any = null;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server returned error (${res.status}). Please check server logs.`);
      }

      if (!res.ok || !data?.session) {
        throw new Error(data?.message || "Failed to request OTP from Fayda API.");
      }

      setSession(data.session);
      setMaskedPhone(data.phone || "");
      setStep("verify_otp");
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Error connecting to Fayda API.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      onError("Please enter a valid 6-digit SMS OTP code.");
      return;
    }

    setLoading(true);
    onError("");

    try {
      const cleanedFan = fanNumber.replace(/\s+/g, "");
      const res = await fetch("/api/fayda/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: cleanedOtp,
          fanNumber: cleanedFan,
          session,
        }),
      });

      let data: any = null;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server returned error (${res.status}). Please check server logs.`);
      }

      if (!res.ok || !data?.success || !data?.data) {
        throw new Error(data?.message || "Verification failed. Please check the OTP.");
      }

      if (typeof data.remainingPoints === "number") {
        setRemainingPoints(data.remainingPoints);
      }

      onSuccess(data.data);

    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Error verifying OTP.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("send_otp");
    setSession("");
    setMaskedPhone("");
    setOtp("");
    setLoading(false);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/90 p-5 shadow-2xl backdrop-blur-2xl sm:p-8">
      {/* Subtle ambient background glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header bar */}
      <div className="relative flex flex-col gap-3 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-sm text-teal-400 border border-teal-500/20">
              ⚡
            </span>
            <h2 className="text-base font-bold text-white tracking-tight sm:text-xl">
              Fayda National ID Verification
            </h2>
          </div>
          <p className="text-xs text-slate-400 sm:text-sm">
            Authenticate directly via Fayda government server using 16-digit FAN &amp; mobile OTP.
          </p>
        </div>

        {remainingPoints !== null && (
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 shadow-inner">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Balance: <strong>{remainingPoints}</strong> points</span>
          </div>
        )}
      </div>

      {step === "send_otp" ? (
        <form onSubmit={handleSendOtp} className="relative mt-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor="fanInput" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              National FAN Number
            </label>
            <div className="relative">
              <input
                id="fanInput"
                type="text"
                value={fanNumber}
                onChange={(e) => setFanNumber(e.target.value)}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3.5 text-base font-medium text-white placeholder-slate-600 shadow-inner transition-all focus:border-teal-400 focus:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-teal-500/15 sm:text-lg sm:tracking-widest font-mono"
                disabled={loading}
                autoFocus
                required
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                16 digits
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Spaces are optional. A one-time verification code will be sent to the registered mobile number.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !fanNumber.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-500 to-teal-500 px-7 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 hover:from-teal-300 hover:to-emerald-400 focus:outline-none disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Requesting OTP...
              </span>
            ) : (
              <>
                <span>Send Verification OTP</span>
                <span className="text-slate-800">→</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="relative mt-6 space-y-5">
          <div className="flex flex-col gap-2 rounded-2xl border border-teal-500/30 bg-teal-950/30 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="font-semibold text-teal-300">
                SMS OTP dispatched to {maskedPhone || "registered phone"}
              </p>
              <p className="text-[11px] font-mono text-slate-400">
                FAN: {fanNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="w-fit text-xs font-semibold text-teal-400 underline underline-offset-2 hover:text-teal-200 transition-colors"
            >
              Change FAN
            </button>
          </div>

          <div className="space-y-2">
            <label htmlFor="otpInput" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              6-Digit SMS Verification Code
            </label>
            <input
              id="otpInput"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="••••••"
              maxLength={6}
              className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3.5 text-center font-mono text-2xl font-black tracking-[0.4em] text-white placeholder-slate-700 shadow-inner transition-all focus:border-teal-400 focus:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-teal-500/15"
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading || otp.trim().length !== 6}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-500 to-teal-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 hover:from-teal-300 hover:to-emerald-400 focus:outline-none disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Verifying Identity (up to 120s)...
                </span>
              ) : (
                "Verify & Generate Landscape ID Cards"
              )}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

