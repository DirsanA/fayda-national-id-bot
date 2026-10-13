"use client";

import React, { useState, useEffect, useMemo } from "react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Form states
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [telegramUserId, setTelegramUserId] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [faydaApiKey, setFaydaApiKey] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [checkingKeyBalance, setCheckingKeyBalance] = useState(false);
  const [keyBalanceStatus, setKeyBalanceStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  function handleStartAdd() {
    setEditingUserId(null);
    setTelegramUserId("");
    setTelegramUsername("");
    setFaydaApiKey("");
    setInitialBalance("0");
    setKeyBalanceStatus(null);
    setError(null);
    const formEl = document.getElementById("customer-form-card");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth" });
  }

  function handleStartEdit(customer: Customer) {
    setEditingUserId(customer.telegramUserId);
    setTelegramUserId(String(customer.telegramUserId));
    setTelegramUsername(customer.telegramUsername || "");
    setFaydaApiKey("");
    setInitialBalance(String(customer.balance));
    setKeyBalanceStatus(null);
    setError(null);
    setSuccessMessage(null);
    const formEl = document.getElementById("customer-form-card");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth" });
  }

  async function handleDeleteCustomer(userId: number, username?: string) {
    const userLabel = username ? `@${username} (ID: ${userId})` : `User ${userId}`;
    if (
      !window.confirm(
        `Are you sure you want to delete ${userLabel}?\n\nThis will remove their API credentials and balance from the database.`
      )
    ) {
      return;
    }

    setDeletingId(userId);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/customers?telegramUserId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete customer");
      }
      setCustomers((prev) => prev.filter((c) => c.telegramUserId !== userId));
      setSuccessMessage(`Customer ${userId} deleted successfully.`);
      if (editingUserId === userId) {
        handleStartAdd();
      }
    } catch (err: any) {
      setError(err.message || "Delete error");
    } finally {
      setDeletingId(null);
    }
  }

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
      if (!editingUserId) {
        setInitialBalance("0");
      }
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
    setSuccessMessage(null);
    try {
      const payload: any = {
        telegramUserId: Number(telegramUserId.trim()),
        telegramUsername: telegramUsername.trim() || undefined,
        balance: Number(initialBalance) || 0,
      };

      if (faydaApiKey.trim()) {
        payload.faydaApiKey = faydaApiKey.trim();
      }

      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save customer");
      }

      const wasEditing = editingUserId !== null;
      setSuccessMessage(
        wasEditing
          ? `Customer ${telegramUserId} updated successfully!`
          : `Customer ${telegramUserId} registered successfully!`
      );
      handleStartAdd();
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || "Registration error");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleAdjustBalance(userId: number, adjustment: number) {
    setAdjustingId(userId);
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
    } finally {
      setAdjustingId(null);
    }
  }

  // Filtered customers based on search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(
      (c) =>
        String(c.telegramUserId).includes(q) ||
        (c.telegramUsername && c.telegramUsername.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCustomers = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, validCurrentPage, pageSize]);

  // Metrics summary
  const totalBalance = useMemo(
    () => customers.reduce((sum, c) => sum + (c.balance || 0), 0),
    [customers]
  );
  const dedicatedApiKeysCount = useMemo(
    () => customers.filter((c) => c.hasApiKey).length,
    [customers]
  );

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-lg">
                👥
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-3xl">
                Customer & Balance Admin
              </h1>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Manage Telegram customer API credentials and verification balances
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              onClick={handleStartAdd}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-emerald-500 active:scale-[0.98] transition-all touch-manipulation"
            >
              ➕ Add Customer
            </button>
            <a
              href="/"
              className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs sm:text-sm font-medium text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 transition-colors touch-manipulation"
            >
              ← Print Utility
            </a>
          </div>
        </header>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 sm:p-4 animate-pulse ${
                    i === 3 ? "col-span-2 lg:col-span-1" : ""
                  }`}
                >
                  <div className="h-3 w-20 rounded bg-slate-800" />
                  <div className="mt-2 h-7 w-14 rounded bg-slate-700" />
                  <div className="mt-2 h-2.5 w-28 rounded bg-slate-800/60" />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4 backdrop-blur-sm">
                <span className="text-[11px] sm:text-xs font-medium text-slate-400">
                  Total Customers
                </span>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-white">
                  {customers.length}
                </p>
                <span className="text-[10px] sm:text-xs text-slate-500">
                  Registered in database
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4 backdrop-blur-sm">
                <span className="text-[11px] sm:text-xs font-medium text-slate-400">
                  Dedicated API Keys
                </span>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-400">
                  {dedicatedApiKeysCount}
                </p>
                <span className="text-[10px] sm:text-xs text-slate-500">
                  Individual keys connected
                </span>
              </div>
              <div className="col-span-2 lg:col-span-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4 backdrop-blur-sm">
                <span className="text-[11px] sm:text-xs font-medium text-slate-400">
                  Allocated Verifications
                </span>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-400">
                  {totalBalance}
                </p>
                <span className="text-[10px] sm:text-xs text-slate-500">
                  Total points across customers
                </span>
              </div>
            </>
          )}
        </div>

        {/* Register / Update Customer Card */}
        <section
          id="customer-form-card"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-xl backdrop-blur-md transition-all"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-white">
                {editingUserId ? `✏️ Update Customer (ID: ${editingUserId})` : "➕ Register / Add Customer"}
              </h2>
              {editingUserId && (
                <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-amber-400">
                  Editing
                </span>
              )}
            </div>
            {editingUserId && (
              <button
                type="button"
                onClick={handleStartAdd}
                className="inline-flex min-h-[32px] items-center text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                ✕ Cancel Edit
              </button>
            )}
          </div>

          {/* Notification banners */}
          {successMessage && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs sm:text-sm text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span>✅</span>
                <span>{successMessage}</span>
              </span>
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-2 min-h-[32px] min-w-[32px] flex items-center justify-center text-emerald-400 hover:text-emerald-200"
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs sm:text-sm text-red-400">
              <span className="flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{error}</span>
              </span>
              <button
                onClick={() => setError(null)}
                className="ml-2 min-h-[32px] min-w-[32px] flex items-center justify-center text-red-400 hover:text-red-200"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleRegisterCustomer} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Telegram Numeric ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 123456789"
                  value={telegramUserId}
                  onChange={(e) => setTelegramUserId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Telegram Username (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dirsan_A"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Fayda API Key / Credential
                </label>
                <input
                  type="text"
                  placeholder={editingUserId ? "Leave blank to keep key" : "Paste fayda_... key"}
                  value={faydaApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors font-mono text-xs"
                />
                {keyBalanceStatus && (
                  <p
                    className={`mt-1.5 text-xs ${
                      keyBalanceStatus.startsWith("✅")
                        ? "text-emerald-400 font-semibold"
                        : keyBalanceStatus.startsWith("⚠️")
                        ? "text-amber-400"
                        : "text-slate-400 animate-pulse"
                    }`}
                  >
                    {keyBalanceStatus}
                  </p>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-300">
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
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-emerald-400 font-semibold placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Auto-populated or set manually.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 pt-2">
              {editingUserId && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 active:scale-[0.98] transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={formSubmitting}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 transition-all shadow-md"
              >
                {formSubmitting
                  ? "Saving..."
                  : editingUserId
                  ? "💾 Update Customer"
                  : "➕ Add Customer"}
              </button>
            </div>
          </form>
        </section>

        {/* Customers Section */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-xl backdrop-blur-md">
          {/* Controls Bar: Search & Actions */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/60 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                Registered Customers ({customers.length})
              </h2>
              <p className="text-xs text-slate-400">
                {searchQuery ? `Showing ${filteredCustomers.length} matching result(s)` : "Real-time verification quota and customer list"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <input
                  type="text"
                  placeholder="🔍 Search ID or @user"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={handleStartAdd}
                className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                ➕ Add
              </button>
              <button
                onClick={() => fetchCustomers()}
                disabled={loading}
                className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                🔄 {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* SKELETON LOADERS - matching layout at each screen size */}
          {loading ? (
            <div>
              {/* Mobile Card Skeletons */}
              <div className="space-y-3 md:hidden">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 animate-pulse space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-28 rounded bg-slate-700" />
                      <div className="h-4 w-16 rounded-full bg-slate-800" />
                    </div>
                    <div className="h-3 w-40 rounded bg-slate-800" />
                    <div className="flex items-center justify-between pt-1">
                      <div className="h-5 w-24 rounded bg-slate-700" />
                      <div className="h-8 w-28 rounded bg-slate-800" />
                    </div>
                    <div className="flex gap-2 pt-1 border-t border-slate-800/60">
                      <div className="h-9 flex-1 rounded bg-slate-800" />
                      <div className="h-9 flex-1 rounded bg-slate-800" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop/Tablet Table Skeleton */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Telegram ID</th>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">API Credential</th>
                      <th className="px-4 py-3">Provider Limit</th>
                      <th className="px-4 py-3">Available Balance</th>
                      <th className="px-4 py-3 text-center">Adjust Count</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 animate-pulse">
                    {[1, 2, 3, 4].map((n) => (
                      <tr key={n} className="h-14">
                        <td className="px-4 py-3.5"><div className="h-4 w-24 rounded bg-slate-700" /></td>
                        <td className="px-4 py-3.5"><div className="h-4 w-20 rounded bg-slate-800" /></td>
                        <td className="px-4 py-3.5"><div className="h-3 w-28 rounded bg-slate-800" /></td>
                        <td className="px-4 py-3.5"><div className="h-4 w-16 rounded-full bg-slate-800" /></td>
                        <td className="px-4 py-3.5"><div className="h-4 w-24 rounded bg-slate-700" /></td>
                        <td className="px-4 py-3.5 text-center"><div className="mx-auto h-7 w-28 rounded bg-slate-800" /></td>
                        <td className="px-4 py-3.5 text-right"><div className="ml-auto h-7 w-24 rounded bg-slate-800" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <span className="text-3xl">📭</span>
              <p className="mt-2 font-medium text-slate-400">No registered customers found</p>
              <p className="text-xs text-slate-500">
                Click <strong>Add Customer</strong> above to register your first user.
              </p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No customers match &quot;{searchQuery}&quot;.
              <button
                onClick={() => setSearchQuery("")}
                className="ml-2 text-emerald-400 underline hover:text-emerald-300"
              >
                Clear search
              </button>
            </div>
          ) : (
            <>
              {/* MOBILE VIEW: Compact Stacked Cards (< md) */}
              <div className="space-y-3.5 md:hidden">
                {paginatedCustomers.map((c) => (
                  <div
                    key={c.telegramUserId}
                    className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 shadow-sm space-y-3 transition-colors hover:border-slate-700"
                  >
                    {/* Top Row: User & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-emerald-400">
                          ID: {c.telegramUserId}
                        </span>
                        {c.telegramUsername && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                            @{c.telegramUsername}
                          </span>
                        )}
                      </div>
                      {c.providerLimit ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                          🔌 {c.providerLimit.remainingPoints} pts
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">No provider</span>
                      )}
                    </div>

                    {/* Middle: API Key & Balance */}
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950/60 p-2.5 text-xs border border-slate-800/60">
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-medium block">
                          API Key
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 truncate block mt-0.5">
                          {c.maskedApiKey || "Default Server API"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-medium block">
                          Balance
                        </span>
                        <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                          {c.balance} <span className="text-[10px] font-normal text-slate-400">pts</span>
                        </span>
                      </div>
                    </div>

                    {/* Quick Adjust Buttons (min-h 38px for touch targets) */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                        Quick Adjust Count
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          onClick={() => handleAdjustBalance(c.telegramUserId, -1)}
                          disabled={adjustingId === c.telegramUserId}
                          className="min-h-[38px] rounded-lg bg-slate-800 text-xs font-bold text-red-400 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center touch-manipulation disabled:opacity-50"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => handleAdjustBalance(c.telegramUserId, 1)}
                          disabled={adjustingId === c.telegramUserId}
                          className="min-h-[38px] rounded-lg bg-slate-800 text-xs font-bold text-emerald-400 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center touch-manipulation disabled:opacity-50"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleAdjustBalance(c.telegramUserId, 10)}
                          disabled={adjustingId === c.telegramUserId}
                          className="min-h-[38px] rounded-lg bg-slate-800 text-xs font-bold text-emerald-400 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center touch-manipulation disabled:opacity-50"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => handleAdjustBalance(c.telegramUserId, 50)}
                          disabled={adjustingId === c.telegramUserId}
                          className="min-h-[38px] rounded-lg bg-slate-800 text-xs font-bold text-emerald-400 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center touch-manipulation disabled:opacity-50"
                        >
                          +50
                        </button>
                      </div>
                    </div>

                    {/* Card Actions: Edit & Delete */}
                    <div className="flex gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => handleStartEdit(c)}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] transition-colors touch-manipulation"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(c.telegramUserId, c.telegramUsername)}
                        disabled={deletingId === c.telegramUserId}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 text-xs font-semibold text-red-400 hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50 transition-colors touch-manipulation"
                      >
                        {deletingId === c.telegramUserId ? "Deleting..." : "🗑️ Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP & TABLET VIEW: Responsive Table (>= md) */}
              <div className="hidden md:block overflow-x-auto rounded-lg">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 lg:px-4 py-3">Telegram ID</th>
                      <th className="px-3 lg:px-4 py-3">Username</th>
                      <th className="px-3 lg:px-4 py-3">API Credential</th>
                      <th className="px-3 lg:px-4 py-3">Provider Limit</th>
                      <th className="px-3 lg:px-4 py-3">Available Balance</th>
                      <th className="px-3 lg:px-4 py-3 text-center">Adjust Count</th>
                      <th className="px-3 lg:px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedCustomers.map((c) => (
                      <tr key={c.telegramUserId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 lg:px-4 py-3.5 font-mono text-emerald-400 font-medium">
                          {c.telegramUserId}
                        </td>
                        <td className="px-3 lg:px-4 py-3.5">
                          {c.telegramUsername ? `@${c.telegramUsername}` : "-"}
                        </td>
                        <td className="px-3 lg:px-4 py-3.5 font-mono text-xs text-slate-400">
                          {c.maskedApiKey || <span className="text-slate-600">Default Server API</span>}
                        </td>
                        <td className="px-3 lg:px-4 py-3.5">
                          {c.providerLimit ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                              🔌 {c.providerLimit.remainingPoints} pts
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 lg:px-4 py-3.5 font-semibold text-white">
                          <span className="text-base text-emerald-400">{c.balance}</span> verifications
                        </td>
                        <td className="px-3 lg:px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleAdjustBalance(c.telegramUserId, -1)}
                              disabled={adjustingId === c.telegramUserId}
                              className="rounded bg-slate-800 px-2.5 py-1 text-xs font-bold text-red-400 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                              title="Decrease by 1"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => handleAdjustBalance(c.telegramUserId, 1)}
                              disabled={adjustingId === c.telegramUserId}
                              className="rounded bg-slate-800 px-2.5 py-1 text-xs font-bold text-emerald-400 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                              title="Increase by 1"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => handleAdjustBalance(c.telegramUserId, 10)}
                              disabled={adjustingId === c.telegramUserId}
                              className="rounded bg-slate-800 px-2.5 py-1 text-xs font-bold text-emerald-400 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                              title="Increase by 10"
                            >
                              +10
                            </button>
                            <button
                              onClick={() => handleAdjustBalance(c.telegramUserId, 50)}
                              disabled={adjustingId === c.telegramUserId}
                              className="rounded bg-slate-800 px-2.5 py-1 text-xs font-bold text-emerald-400 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
                              title="Increase by 50"
                            >
                              +50
                            </button>
                          </div>
                        </td>
                        <td className="px-3 lg:px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleStartEdit(c)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-colors"
                              title="Edit and update customer details"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(c.telegramUserId, c.telegramUsername)}
                              disabled={deletingId === c.telegramUserId}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 disabled:opacity-50 transition-colors"
                              title="Delete customer permanently"
                            >
                              {deletingId === c.telegramUserId ? "Deleting..." : "🗑️ Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CONTROLS - responsive without horizontal overflow */}
              {totalPages > 1 && (
                <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-800/60 pt-4 sm:flex-row">
                  <div className="text-xs text-slate-400 text-center sm:text-left">
                    Showing{" "}
                    <span className="font-semibold text-white">
                      {(validCurrentPage - 1) * pageSize + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-white">
                      {Math.min(validCurrentPage * pageSize, filteredCustomers.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-white">
                      {filteredCustomers.length}
                    </span>{" "}
                    customers
                  </div>

                  {/* Navigation Buttons: compact for mobile, full for desktop */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={validCurrentPage === 1}
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
                      aria-label="Previous page"
                    >
                      ← Prev
                    </button>

                    {/* Desktop Page Numbers */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-h-[36px] min-w-[36px] rounded-lg text-xs font-semibold transition-colors ${
                            pageNum === validCurrentPage
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    {/* Mobile Compact Page Indicator */}
                    <span className="sm:hidden px-2 text-xs font-medium text-slate-400">
                      Page {validCurrentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={validCurrentPage === totalPages}
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
                      aria-label="Next page"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
