"use client";

import React, { useState, useEffect, useMemo } from "react";

interface Customer {
  telegramUserId: number;
  telegramUsername?: string;
  hasApiKey: boolean;
  maskedApiKey?: string;
  balance: number;
  cardTemplate?: "template1" | "template2" | "template3";
  providerLimit?: {
    remainingPoints: string | number;
    status: string;
  };
  updatedAt: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  status: "draft" | "published";
  publishedAt?: string | null;
  sentCount?: number;
  totalTarget?: number;
  createdAt: string;
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
  const [initialBalance, setInitialBalance] = useState("0");
  const [cardTemplate, setCardTemplate] = useState<"template1" | "template2" | "template3">("template1");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [adjustInputs, setAdjustInputs] = useState<Record<number, string>>({});

  // Announcement states
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementDeletingId, setAnnouncementDeletingId] = useState<string | null>(null);
  const [announcementPublishingId, setAnnouncementPublishingId] = useState<string | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");

  // Live Default Admin Fayda Provider Balance State
  const [providerBalance, setProviderBalance] = useState<{
    liveProviderPoints: number;
    allocatedPoints: number;
    remainingDistributable: number;
    points: number;
    status: string;
    username?: string;
  } | null>(null);
  const [providerBalanceLoading, setProviderBalanceLoading] = useState(false);
  const [providerBalanceError, setProviderBalanceError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
    fetchAdminProviderBalance();
    fetchAnnouncements();
  }, []);

  // Auto-dismiss floating popup message after 4.5 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Auto-dismiss floating error popup message after 5.5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, 5500);
    return () => clearTimeout(timer);
  }, [error]);

  async function fetchAdminProviderBalance() {
    setProviderBalanceLoading(true);
    setProviderBalanceError(null);
    try {
      const res = await fetch("/api/fayda/balance");
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setProviderBalance({
          liveProviderPoints:
            typeof data.liveProviderPoints === "number"
              ? data.liveProviderPoints
              : typeof data.totalProviderPoints === "number"
              ? data.totalProviderPoints
              : Number(data.points ?? 0),
          allocatedPoints: typeof data.allocatedPoints === "number" ? data.allocatedPoints : 0,
          remainingDistributable:
            typeof data.remainingDistributable === "number"
              ? data.remainingDistributable
              : Number(data.points ?? 0),
          points: typeof data.points === "number" ? data.points : 0,
          status: data.status || "active",
          username: data.username,
        });
      } else {
        setProviderBalanceError(data?.message || "Failed to load provider balance");
      }
    } catch (err: any) {
      setProviderBalanceError(err.message || "Network error querying provider balance");
    } finally {
      setProviderBalanceLoading(false);
    }
  }

  function handleStartAdd() {
    setEditingUserId(null);
    setTelegramUserId("");
    setTelegramUsername("");
    setInitialBalance("0");
    setCardTemplate("template1");
    setError(null);
    const formEl = document.getElementById("customer-form-card");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth" });
  }

  function handleStartEdit(customer: Customer) {
    setEditingUserId(customer.telegramUserId);
    setTelegramUserId(String(customer.telegramUserId));
    setTelegramUsername(customer.telegramUsername || "");
    setInitialBalance(String(customer.balance));
    setCardTemplate(customer.cardTemplate || "template1");
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
      setSuccessMessage(data.message || `Customer ${userId} deleted successfully.`);
      if (editingUserId === userId) {
        handleStartAdd();
      }
      // Instantly refresh admin provider balance to display returned balance
      fetchAdminProviderBalance();
    } catch (err: any) {
      setError(err.message || "Delete error");
    } finally {
      setDeletingId(null);
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

  async function fetchAnnouncements() {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setAnnouncements(data.announcements || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setAnnouncementsLoading(false);
    }
  }

  function handleStartEditAnnouncement(ann: Announcement) {
    setEditingAnnouncementId(ann.id);
    setAnnouncementTitle(ann.title);
    setAnnouncementMessage(ann.message);
    const el = document.getElementById("announcement-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  function handleCancelEditAnnouncement() {
    setEditingAnnouncementId(null);
    setAnnouncementTitle("");
    setAnnouncementMessage("");
  }

  async function handleSaveAnnouncement(publishNow: boolean) {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setError("Please provide both an announcement title and message content.");
      return;
    }

    setAnnouncementSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const isEditing = Boolean(editingAnnouncementId);
      const url = "/api/admin/announcements";
      const method = isEditing ? "PUT" : "POST";
      const body = {
        ...(isEditing ? { id: editingAnnouncementId } : {}),
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        publishNow,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save announcement.");
      }

      setSuccessMessage(data.message || (publishNow ? "Announcement published!" : "Draft saved!"));
      handleCancelEditAnnouncement();
      await fetchAnnouncements();
    } catch (err: any) {
      setError(err?.message || "Error processing announcement.");
    } finally {
      setAnnouncementSubmitting(false);
    }
  }

  async function handlePublishExistingAnnouncement(ann: Announcement) {
    if (
      !window.confirm(
        `Are you sure you want to broadcast "${ann.title}" to all registered Telegram customers now?`
      )
    ) {
      return;
    }

    setAnnouncementPublishingId(ann.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ann.id,
          title: ann.title,
          message: ann.message,
          publishNow: true,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to publish announcement.");
      }

      setSuccessMessage(data.message || "Announcement published successfully.");
      await fetchAnnouncements();
    } catch (err: any) {
      setError(err?.message || "Error publishing announcement.");
    } finally {
      setAnnouncementPublishingId(null);
    }
  }

  async function handleDeleteAnnouncement(id: string, title: string) {
    if (!window.confirm(`Are you sure you want to delete announcement "${title}"?`)) {
      return;
    }

    setAnnouncementDeletingId(id);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/announcements?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to delete announcement.");
      }

      setSuccessMessage(data.message || "Announcement deleted successfully.");
      if (editingAnnouncementId === id) {
        handleCancelEditAnnouncement();
      }
      await fetchAnnouncements();
    } catch (err: any) {
      setError(err?.message || "Error deleting announcement.");
    } finally {
      setAnnouncementDeletingId(null);
    }
  }

  async function handleRegisterCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (formSubmitting) return;

    const trimmedId = telegramUserId.trim();
    if (!trimmedId) {
      setError("Telegram Numeric ID is required.");
      return;
    }

    const idNum = Number(trimmedId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      setError("Please enter a valid positive numeric Telegram ID.");
      return;
    }

    const trimmedBal = initialBalance.trim();
    const balNum = Number(trimmedBal);
    if (trimmedBal === "" || isNaN(balNum) || balNum < 0) {
      setError("Verification balance must be a non-negative number (0 or greater).");
      return;
    }

    const isEditing = editingUserId !== null;
    const existingCust = customers.find((c) => c.telegramUserId === idNum);
    const additionalRequested = isEditing
      ? Math.max(0, balNum - (existingCust?.balance ?? 0))
      : balNum;

    if (additionalRequested > 0 && providerBalance !== null) {
      const remainingDistributable = Math.max(
        0,
        providerBalance.liveProviderPoints - totalBalance
      );
      if (additionalRequested > remainingDistributable) {
        setError(
          `Cannot allocate ${additionalRequested} calls. Only ${remainingDistributable} distributable calls remain available (Live Provider: ${providerBalance.liveProviderPoints}, Total Allocated: ${totalBalance}).`
        );
        return;
      }
    }

    setFormSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: any = {
        telegramUserId: idNum,
        telegramUsername: telegramUsername.trim() || undefined,
        balance: balNum,
        cardTemplate,
        isUpdate: isEditing,
      };

      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Failed to save customer (HTTP ${res.status})`);
      }

      setSuccessMessage(
        isEditing
          ? `Customer ${idNum} updated successfully! Balance set to ${balNum}.`
          : `Customer ${idNum} registered successfully with balance ${balNum}!`
      );
      handleStartAdd();
      await Promise.all([fetchCustomers(), fetchAdminProviderBalance()]);
    } catch (err: any) {
      setError(err.message || "Registration error occurred");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleAdjustCount(userId: number, direction: 1 | -1) {
    const rawVal = adjustInputs[userId]?.trim();
    if (!rawVal) {
      setError("Please enter the number of API calls to adjust in the input field.");
      return;
    }
    const parsedAmount = Math.abs(Number(rawVal));
    if (isNaN(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid positive whole number of API calls to adjust.");
      return;
    }

    const adjustment = direction * parsedAmount;

    // Client-side limit check against distributable balance
    if (adjustment > 0 && providerBalance !== null) {
      const remainingDistributable = Math.max(
        0,
        providerBalance.liveProviderPoints - totalBalance
      );
      if (adjustment > remainingDistributable) {
        setError(
          `Cannot allocate ${adjustment} calls. Only ${remainingDistributable} distributable calls remain available (Live Provider: ${providerBalance.liveProviderPoints}, Total Allocated: ${totalBalance}).`
        );
        return;
      }
    }

    setAdjustingId(userId);
    setError(null);
    setSuccessMessage(null);

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

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Failed to adjust balance (HTTP ${res.status})`);
      }

      setCustomers((prev) =>
        prev.map((c) =>
          c.telegramUserId === userId ? { ...c, balance: data.newBalance } : c
        )
      );

      // Clear input for this customer upon success
      setAdjustInputs((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });

      setSuccessMessage(
        adjustment > 0
          ? `Added ${parsedAmount} calls to customer ${userId}. New balance: ${data.newBalance}.`
          : `Deducted ${parsedAmount} calls from customer ${userId}. New balance: ${data.newBalance}.`
      );

      // Refresh live admin provider balance to update remaining pool
      fetchAdminProviderBalance();
    } catch (err: any) {
      setError(err.message || "Adjustment error occurred");
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
  const remainingForDistribution = useMemo(() => {
    if (!providerBalance) return null;
    return Math.max(0, providerBalance.liveProviderPoints - totalBalance);
  }, [providerBalance, totalBalance]);

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-6 text-slate-100 sm:px-6 lg:px-8 relative">
      {/* Floating Action Popup Notification */}
      {(successMessage || error) && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 sm:top-6 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100%-2.5rem)] pointer-events-auto transition-all duration-200"
        >
          {successMessage && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-4 shadow-2xl shadow-emerald-950/70 backdrop-blur-xl ring-1 ring-emerald-500/30">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-lg">
                ✅
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Action Completed
                </span>
                <p className="mt-1 text-xs sm:text-sm text-slate-100 font-medium leading-relaxed break-words">
                  {successMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-slate-900/95 p-4 shadow-2xl shadow-rose-950/70 backdrop-blur-xl ring-1 ring-rose-500/30">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-lg">
                ⚠️
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                  Action Notice
                </span>
                <p className="mt-1 text-xs sm:text-sm text-slate-100 font-medium leading-relaxed break-words">
                  {error}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="Close alert"
              >
                ✕
              </button>
            </div>
          )}
        </aside>
      )}

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

        {/* Overview Stats Cards: 4 Real-time Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Card 1: Live Admin Provider Key */}
          <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-emerald-950/30 p-3.5 sm:p-4 backdrop-blur-sm relative shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Admin Provider Key
              </span>
              <button
                type="button"
                onClick={fetchAdminProviderBalance}
                disabled={providerBalanceLoading}
                className="text-xs text-slate-400 hover:text-emerald-300 disabled:opacity-40 transition-colors p-1 touch-manipulation"
                title="Refresh live provider balance"
                aria-label="Refresh live provider balance"
              >
                🔄
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {providerBalanceLoading ? (
                <div className="h-8 w-16 rounded bg-slate-800 animate-pulse" />
              ) : providerBalanceError ? (
                <span className="text-xs sm:text-sm font-semibold text-amber-400" title={providerBalanceError}>
                  ⚠️ Connection Issue
                </span>
              ) : (
                <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {providerBalance !== null ? providerBalance.liveProviderPoints : "—"}
                </p>
              )}
              <span className="text-xs font-medium text-slate-400">
                calls available
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
              <span>Default provider API</span>
              {providerBalance?.status && (
                <span className={`capitalize font-semibold ${
                  providerBalance.status === "active" ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {providerBalance.status}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Allocated to Customers */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] sm:text-xs font-medium text-slate-400">
              Allocated to Customers
            </span>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-amber-400 tracking-tight">
              {loading ? "..." : totalBalance}
            </p>
            <div className="mt-1.5 text-[10px] sm:text-[11px] text-slate-500">
              Total calls across users
            </div>
          </div>

          {/* Card 3: Remaining for Distribution */}
          <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-cyan-950/30 p-3.5 sm:p-4 backdrop-blur-sm relative shadow-sm">
            <span className="text-[11px] sm:text-xs font-semibold text-cyan-400">
              Remaining for Distribution
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              {providerBalanceLoading ? (
                <div className="h-8 w-16 rounded bg-slate-800 animate-pulse" />
              ) : providerBalanceError ? (
                <span className="text-xs sm:text-sm font-semibold text-amber-400" title={providerBalanceError}>
                  ⚠️ Unavailable
                </span>
              ) : (
                <p className="text-2xl sm:text-3xl font-extrabold text-cyan-300 tracking-tight">
                  {remainingForDistribution !== null ? remainingForDistribution : "—"}
                </p>
              )}
              <span className="text-xs font-medium text-slate-400">
                distributable calls
              </span>
            </div>
            <div className="mt-1.5 text-[10px] sm:text-[11px] text-slate-400">
              Live Provider minus Allocated
            </div>
          </div>

          {/* Card 4: Total Customers */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] sm:text-xs font-medium text-slate-400">
              Total Customers
            </span>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {loading ? "..." : customers.length}
            </p>
            <div className="mt-1.5 text-[10px] sm:text-[11px] text-slate-500">
              Registered in database
            </div>
          </div>
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
                  Verification Balance Count
                </label>
                <input
                  type="number"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-emerald-400 font-semibold placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Allocated balance.
                  {remainingForDistribution !== null && (
                    <span className="block sm:inline sm:ml-1 text-emerald-400/90 font-medium">
                      ({remainingForDistribution} remaining)
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Default Card Template
                </label>
                <select
                  value={cardTemplate}
                  onChange={(e) => setCardTemplate(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
                >
                  <option value="template1">Template 1 (Classic Standard)</option>
                  <option value="template2">Template 2 (Modern Blue)</option>
                  <option value="template3">Template 3 (Minimal)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Assigned ID card layout.
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

        {/* Announcements Section */}
        <section
          id="announcement-section"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-xl backdrop-blur-md transition-all"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-base">
                  📢
                </span>
                <h2 className="text-base sm:text-lg font-semibold text-white">
                  {editingAnnouncementId ? "✏️ Edit Announcement" : "📢 Bot Announcements"}
                </h2>
                {editingAnnouncementId && (
                  <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-cyan-400">
                    Editing
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Write, publish, edit, and delete announcements. Published announcements are sent directly to customer Telegram chats.
              </p>
            </div>
            {editingAnnouncementId && (
              <button
                type="button"
                onClick={handleCancelEditAnnouncement}
                className="inline-flex min-h-[32px] items-center text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                ✕ Cancel Edit
              </button>
            )}
          </div>

          {/* Announcement Composer Form */}
          <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 sm:p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Announcement Title <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. System Maintenance Notice / New Feature Available"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Message Content <span className="text-cyan-400">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Write your announcement message here. Supports basic text and lines..."
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {editingAnnouncementId && (
                <button
                  type="button"
                  onClick={handleCancelEditAnnouncement}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                disabled={announcementSubmitting}
                onClick={() => handleSaveAnnouncement(false)}
                className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {announcementSubmitting ? "Saving..." : editingAnnouncementId ? "💾 Save Changes" : "📝 Save as Draft"}
              </button>
              <button
                type="button"
                disabled={announcementSubmitting}
                onClick={() => handleSaveAnnouncement(true)}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 active:scale-[0.98] disabled:opacity-50 transition-all shadow-md"
              >
                {announcementSubmitting ? "Publishing..." : "🚀 Publish & Broadcast to Bot"}
              </button>
            </div>
          </div>

          {/* Announcements List */}
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Announcement History ({announcements.length})
            </h3>
            {announcementsLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
                No announcements created yet. Compose your first announcement above.
              </div>
            ) : (
              <div className="space-y-2.5">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 sm:flex-row sm:items-center sm:justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-white break-words">
                          {ann.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            ann.status === "published"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {ann.status}
                        </span>
                        {ann.status === "published" && (
                          <span className="text-[11px] text-slate-400">
                            (Sent to {ann.sentCount ?? 0}/{ann.totalTarget ?? 0} users)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap line-clamp-2">
                        {ann.message}
                      </p>
                      <div className="text-[10px] text-slate-500">
                        Created: {new Date(ann.createdAt).toLocaleString()}
                        {ann.publishedAt && ` • Published: ${new Date(ann.publishedAt).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                      {ann.status === "draft" && (
                        <button
                          type="button"
                          disabled={announcementPublishingId === ann.id}
                          onClick={() => handlePublishExistingAnnouncement(ann)}
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 active:scale-95 disabled:opacity-50 transition-colors"
                          title="Publish and send to Telegram bot users"
                        >
                          {announcementPublishingId === ann.id ? "Publishing..." : "🚀 Publish"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEditAnnouncement(ann)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 active:scale-95 transition-colors"
                        title="Edit announcement"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        disabled={announcementDeletingId === ann.id}
                        onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 disabled:opacity-50 transition-colors"
                        title="Delete announcement"
                      >
                        {announcementDeletingId === ann.id ? "Deleting..." : "🗑️ Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                        <td className="px-4 py-3.5"><div className="h-4 w-24 rounded bg-slate-700" /></td>
                        <td className="px-4 py-3.5 text-center"><div className="mx-auto h-7 w-32 rounded bg-slate-800" /></td>
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
                    {/* Top Row: User ID & Username */}
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
                        <span className="rounded bg-slate-800/90 border border-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">
                          {c.cardTemplate === "template2" ? "T2" : c.cardTemplate === "template3" ? "T3" : "T1"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-500 font-medium block">
                          Available Balance
                        </span>
                        <span className="text-sm font-bold text-emerald-400 block">
                          {c.balance} <span className="text-[10px] font-normal text-slate-400">calls</span>
                        </span>
                      </div>
                    </div>

                    {/* Adjust Count Input Row */}
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium block mb-1">
                        Adjust Count
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="e.g. 5"
                          value={adjustInputs[c.telegramUserId] ?? ""}
                          onChange={(e) =>
                            setAdjustInputs((prev) => ({ ...prev, [c.telegramUserId]: e.target.value }))
                          }
                          className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                        />
                        <button
                          onClick={() => handleAdjustCount(c.telegramUserId, 1)}
                          disabled={adjustingId === c.telegramUserId}
                          className="min-h-[38px] px-3.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs hover:bg-emerald-500/30 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 touch-manipulation"
                          title="Add API calls"
                        >
                          + Add
                        </button>
                        <button
                          onClick={() => handleAdjustCount(c.telegramUserId, -1)}
                          disabled={adjustingId === c.telegramUserId}
                          className="min-h-[38px] px-3.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 font-bold text-xs hover:bg-red-500/30 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 touch-manipulation"
                          title="Subtract API calls"
                        >
                          − Deduct
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
                      <th className="px-3 lg:px-4 py-3">Card Template</th>
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
                        <td className="px-3 lg:px-4 py-3.5">
                          <span className="inline-flex items-center rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-medium text-cyan-300">
                            {c.cardTemplate === "template2" ? "Template 2" : c.cardTemplate === "template3" ? "Template 3" : "Template 1"}
                          </span>
                        </td>
                        <td className="px-3 lg:px-4 py-3.5 font-semibold text-white">
                          <span className="text-base text-emerald-400 font-bold">{c.balance}</span> verifications
                        </td>
                        <td className="px-3 lg:px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <input
                              type="number"
                              placeholder="Count"
                              value={adjustInputs[c.telegramUserId] ?? ""}
                              onChange={(e) =>
                                setAdjustInputs((prev) => ({ ...prev, [c.telegramUserId]: e.target.value }))
                              }
                              className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white text-center placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                            />
                            <button
                              onClick={() => handleAdjustCount(c.telegramUserId, 1)}
                              disabled={adjustingId === c.telegramUserId}
                              className="min-h-[28px] min-w-[28px] rounded bg-emerald-600/20 border border-emerald-500/30 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
                              title="Add API calls"
                              aria-label="Add API calls"
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleAdjustCount(c.telegramUserId, -1)}
                              disabled={adjustingId === c.telegramUserId}
                              className="min-h-[28px] min-w-[28px] rounded bg-red-600/20 border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/30 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
                              title="Subtract API calls"
                              aria-label="Subtract API calls"
                            >
                              −
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
