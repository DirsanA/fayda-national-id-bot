"use client";

import React, { useState, useEffect } from "react";

interface Customer {
  telegramUserId: number;
  telegramUsername?: string;
  hasApiKey: boolean;
  maskedApiKey?: string;
  balance: number;
  providerLimit?: {
    remainingPoints: string | number;
    status: string;
  };
  updatedAt: string;
}

export default function AdminPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [telegramUserId, setTelegramUserId] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [faydaApiKey, setFaydaApiKey] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [checkingKeyBalance, setCheckingKeyBalance] = useState(false);
  const [keyBalanceStatus, setKeyBalanceStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function checkKeyBalance(key: string) {
    const cleanKey = key.trim();
    if (!cleanKey) {
      setKeyBalanceStatus(null);
      return;
    }
    setCheckingKeyBalance(true);
    setKeyBalanceStatus("Checking API key balance...");
    try {
      const res = await fetch("/api/admin/check-key-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: cleanKey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInitialBalance(String(data.points));
        setKeyBalanceStatus(`✅ Live API Balance: ${data.points} points`);
      } else {
        setKeyBalanceStatus(`⚠️ ${data.message || "Invalid or inaccessible API key"}`);
      }
    } catch {
      setKeyBalanceStatus("⚠️ Could not contact Fayda provider");
    } finally {
      setCheckingKeyBalance(false);
    }
  }

  function handleApiKeyChange(val: string) {
    setFaydaApiKey(val);
    const trimmed = val.trim();
    if (trimmed.length >= 10) {
      checkKeyBalance(trimmed);
    } else if (!trimmed) {
      setKeyBalanceStatus(null);
      setInitialBalance("0");
    }
  }

  async function fetchCustomers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load customers");
      }
      setCustomers(data.customers || []);
    } catch (err: any) {
      setError(err.message || "Error loading customers");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!telegramUserId.trim()) return;
    setFormSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegramUserId: Number(telegramUserId.trim()),
          telegramUsername: telegramUsername.trim() || undefined,
          faydaApiKey: faydaApiKey.trim() || undefined,
          balance: Number(initialBalance) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to register customer");
      }
      setTelegramUserId("");
      setTelegramUsername("");
      setFaydaApiKey("");
      setInitialBalance("0");
      setKeyBalanceStatus(null);
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || "Registration error");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleAdjustBalance(userId: number, adjustment: number) {
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegramUserId: userId,
          adjustment,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.telegramUserId === userId ? { ...c, balance: data.newBalance } : c
          )
        );
      }
    } catch {
      fetchCustomers();
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Customer & Balance Admin
            </h1>
            <p className="text-sm text-slate-400">
              Manage Telegram customer API credentials and verification balances
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            ← Back to Print Utility
          </a>
        </div>

        <div className="space-y-8">
            {/* Register New Customer Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
              <h2 className="text-lg font-semibold text-white mb-4">
                ➕ Register / Update Customer
              </h2>
              {error && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <form onSubmit={handleRegisterCustomer} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Telegram Numeric ID *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 123456789"
                    value={telegramUserId}
                    onChange={(e) => setTelegramUserId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Telegram Username (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dirsan_A"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Fayda API Key / Credential
                  </label>
                  <input
                    type="text"
                    placeholder="Paste fayda_... key"
                    value={faydaApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                  {keyBalanceStatus && (
                    <p className={`mt-1 text-xs ${keyBalanceStatus.startsWith("✅") ? "text-emerald-400 font-semibold" : keyBalanceStatus.startsWith("⚠️") ? "text-amber-400" : "text-slate-400 animate-pulse"}`}>
                      {keyBalanceStatus}
                    </p>
                  )}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-400">
                      Verification Balance Count
                    </label>
                    {checkingKeyBalance && (
                      <span className="text-[10px] text-emerald-400 animate-pulse">Reading balance...</span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none font-semibold text-emerald-400"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Auto-filled from API key. Can also be adjusted manually.
                  </p>
                </div>
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {formSubmitting ? "Saving..." : "Save Customer"}
                  </button>
                </div>
              </form>
            </div>

            {/* Customers Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Registered Customers ({customers.length})</h2>
                <button
                  onClick={() => fetchCustomers()}
                  disabled={loading}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                >
                  🔄 Refresh
                </button>
              </div>

              {customers.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No registered customers found. Add your first customer above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Telegram ID</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">API Credential</th>
                        <th className="px-4 py-3">Provider Limit</th>
                        <th className="px-4 py-3">Available Balance</th>
                        <th className="px-4 py-3 text-right">Adjust Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customers.map((c) => (
                        <tr key={c.telegramUserId} className="hover:bg-slate-800/20">
                          <td className="px-4 py-3.5 font-mono text-emerald-400">
                            {c.telegramUserId}
                          </td>
                          <td className="px-4 py-3.5">
                            {c.telegramUsername ? `@${c.telegramUsername}` : "-"}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                            {c.maskedApiKey || <span className="text-slate-600">Default Server API</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            {c.providerLimit ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                                🔌 {c.providerLimit.remainingPoints} pts
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-white">
                            <span className="text-base text-emerald-400">{c.balance}</span> verifications
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleAdjustBalance(c.telegramUserId, -1)}
                                className="rounded bg-slate-800 px-2 py-1 text-xs font-bold text-red-400 hover:bg-slate-700"
                                title="Decrease by 1"
                              >
                                -1
                              </button>
                              <button
                                onClick={() => handleAdjustBalance(c.telegramUserId, 1)}
                                className="rounded bg-slate-800 px-2 py-1 text-xs font-bold text-emerald-400 hover:bg-slate-700"
                                title="Increase by 1"
                              >
                                +1
                              </button>
                              <button
                                onClick={() => handleAdjustBalance(c.telegramUserId, 10)}
                                className="rounded bg-slate-800 px-2 py-1 text-xs font-bold text-emerald-400 hover:bg-slate-700"
                                title="Increase by 10"
                              >
                                +10
                              </button>
                              <button
                                onClick={() => handleAdjustBalance(c.telegramUserId, 50)}
                                className="rounded bg-slate-800 px-2 py-1 text-xs font-bold text-emerald-400 hover:bg-slate-700"
                                title="Increase by 50"
                              >
                                +50
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
