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
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl backdrop-blur-xl sm:p-7 space-y-5">
      <div className="flex flex-col gap-1 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>⚡</span> Fayda National ID Validation (JSON API)
          </h2>
          <p className="text-xs text-slate-400">
            Fetch identity data directly from official Fayda API using 16-digit FAN and SMS OTP.
          </p>
        </div>
        {remainingPoints !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            Points Balance: {remainingPoints}
          </span>
        )}
      </div>

      {step === "send_otp" ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label htmlFor="fanInput" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              FAN Number (16 Digits)
            </label>
            <input
              id="fanInput"
              type="text"
              value={fanNumber}
              onChange={(e) => setFanNumber(e.target.value)}
              placeholder="e.g. 1234 5678 9012 3456"
              maxLength={19}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white font-mono text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !fanNumber.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:from-teal-400 hover:to-emerald-500 focus:outline-none disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sending OTP...
              </span>
            ) : (
              "Send OTP to Registered Phone"
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="rounded-xl bg-teal-950/40 border border-teal-500/30 p-3.5 text-xs text-teal-200 flex items-center justify-between">
            <div>
              <p className="font-semibold">OTP sent to {maskedPhone || "registered mobile number"}</p>
              <p className="text-teal-400">FAN: {fanNumber}</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-teal-300 underline hover:text-teal-100"
            >
              Change FAN
            </button>
          </div>

          <div>
            <label htmlFor="otpInput" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              6-Digit SMS OTP Code
            </label>
            <input
              id="otpInput"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="e.g. 123456"
              maxLength={6}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white font-mono text-center tracking-widest text-lg font-bold focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading || otp.trim().length !== 6}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:from-teal-400 hover:to-emerald-500 focus:outline-none disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Verifying OTP (up to 120s)...
                </span>
              ) : (
                "Verify OTP & Fetch JSON Data"
              )}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
