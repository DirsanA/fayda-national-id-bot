"use client";

import React, { useState } from "react";
import type { EthiopianIdData } from "@/types/id-card";

export function ManualIdGenerator() {
  const [formData, setFormData] = useState<Partial<EthiopianIdData>>({
    fullNameAmharic: "",
    fullNameEnglish: "",
    dateOfBirthEth: "",
    dateOfBirthGreg: "",
    sexAmharic: "",
    sexEnglish: "",
    dateOfExpiryEth: "",
    dateOfExpiryGreg: "",
    dateOfIssueEth: "",
    dateOfIssueGreg: "",
    fanNumber: "",
    finNumber: "",
    serialNumber: "",
    phoneNumber: "",
    nationalityAmharic: "ኢትዮጵያዊ",
    nationalityEnglish: "Ethiopian",
    regionAmharic: "",
    regionEnglish: "",
    subcityAmharic: "",
    subcityEnglish: "",
    woredaAmharic: "",
    woredaEnglish: "",
    photoUrl: "",
    qrCodeUrl: "/assets/target-qr.png",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<{
    combinedUrl: string;
    frontUrl: string;
    backUrl: string;
  } | null>(null);

  // Converts Ethiopian date (DD/MM/YYYY) to Gregorian date (DD/MM/YYYY)
  const convertEthToGregorian = (ethDateStr: string): string | null => {
    if (!ethDateStr) return null;
    const parts = ethDateStr.trim().split(/[\/\-\.]/);
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 30 || month < 1 || month > 13 || year < 1000 || year > 2500) return null;

    // Ethiopian new year occurs on Sep 11, or Sep 12 if previous year was leap (year % 4 === 0)
    const isPrevLeap = (year - 1) % 4 === 3;
    const newYearDay = isPrevLeap ? 12 : 11;
    const newYearDate = new Date(Date.UTC(year + 7, 8, newYearDay));
    const dayOffset = (month - 1) * 30 + (day - 1);
    const targetDate = new Date(newYearDate.getTime() + dayOffset * 86400000);

    const gDay = String(targetDate.getUTCDate()).padStart(2, "0");
    const gMonth = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
    const gYear = targetDate.getUTCFullYear();
    return `${gDay}/${gMonth}/${gYear}`;
  };

  const handleInputChange = (field: keyof EthiopianIdData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Automatically compute and sync Gregorian dates when Ethiopian dates are entered
      if (field === "dateOfBirthEth") {
        const converted = convertEthToGregorian(value);
        if (converted) {
          updated.dateOfBirthGreg = converted;
        }
      } else if (field === "dateOfExpiryEth") {
        const converted = convertEthToGregorian(value);
        if (converted) {
          updated.dateOfExpiryGreg = converted;
        }
      } else if (field === "dateOfIssueEth") {
        const converted = convertEthToGregorian(value);
        if (converted) {
          updated.dateOfIssueGreg = converted;
        }
      }

      return updated;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFormData((prev) => ({ ...prev, photoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCards(null);

    try {
      const res = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to generate card");
      }

      setCards({
        combinedUrl: data.combinedUrl,
        frontUrl: data.frontUrl,
        backUrl: data.backUrl,
      });

      // Smooth scroll to generated preview
      setTimeout(() => {
        document.getElementById("generated-card-section")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generating Template 3 ID card.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Form Container */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7 shadow-2xl backdrop-blur-md"
      >
        <div className="border-b border-slate-800/80 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 text-base">
                🪪
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Demographic Data Entry (Template 3 Minimal)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Fill in personal, date, and address information in English and Amharic. No OTP required.
            </p>
          </div>
          <span className="inline-flex items-center self-start sm:self-auto rounded-full bg-teal-500/10 border border-teal-500/30 px-3 py-1 text-xs font-semibold text-teal-300">
            🎨 Template 3 (Minimal)
          </span>
        </div>

        {/* Section 1: Names & Photo */}
        <div className="mb-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <span>👤</span> Personal Names & Portrait
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Full Name (Amharic / አማርኛ) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullNameAmharic || ""}
                onChange={(e) => handleInputChange("fullNameAmharic", e.target.value)}
                placeholder="ሙሉ ስም በአማርኛ ያስገቡ (ምሳሌ፡ ዮሴፍ ግርማ ቱፋ)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Full Name (English) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullNameEnglish || ""}
                onChange={(e) => handleInputChange("fullNameEnglish", e.target.value)}
                placeholder="Enter Full Name in English (e.g. Yosef Girma Tufa)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Portrait Photo Upload
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-teal-600 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Transparent subject removal is automatically applied.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Dates, Gender & Numbers */}
        <div className="mb-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <span>📅</span> Dates, Gender & Card Numbers
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                DOB Eth (የተወለዱበት ቀን)
              </label>
              <input
                type="text"
                value={formData.dateOfBirthEth || ""}
                onChange={(e) => handleInputChange("dateOfBirthEth", e.target.value)}
                placeholder="ቀን/ወር/ዓ.ም (ምሳሌ፡ 12/04/1988)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                DOB Greg (Date of Birth)
              </label>
              <input
                type="text"
                value={formData.dateOfBirthGreg || ""}
                onChange={(e) => handleInputChange("dateOfBirthGreg", e.target.value)}
                placeholder="DD/MM/YYYY (e.g. 21/12/1995)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Sex / ጾታ
              </label>
              <select
                value={
                  formData.sexEnglish === "Male"
                    ? "male"
                    : formData.sexEnglish === "Female"
                    ? "female"
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value === "male") {
                    setFormData((prev) => ({ ...prev, sexEnglish: "Male", sexAmharic: "ወንድ" }));
                  } else if (e.target.value === "female") {
                    setFormData((prev) => ({ ...prev, sexEnglish: "Female", sexAmharic: "ሴት" }));
                  } else {
                    setFormData((prev) => ({ ...prev, sexEnglish: "", sexAmharic: "" }));
                  }
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none transition-colors"
              >
                <option value="">-- Select Sex / ጾታ ይምረጡ --</option>
                <option value="male">ወንድ / Male</option>
                <option value="female">ሴት / Female</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Sex Custom (Amharic & English)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.sexAmharic || ""}
                  onChange={(e) => handleInputChange("sexAmharic", e.target.value)}
                  placeholder="ጾታ (ምሳሌ፡ ወንድ)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
                />
                <input
                  type="text"
                  value={formData.sexEnglish || ""}
                  onChange={(e) => handleInputChange("sexEnglish", e.target.value)}
                  placeholder="Sex (e.g. Male)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Expiry Eth (የሚያበቃበት ቀን)
              </label>
              <input
                type="text"
                value={formData.dateOfExpiryEth || ""}
                onChange={(e) => handleInputChange("dateOfExpiryEth", e.target.value)}
                placeholder="ቀን/ወር/ዓ.ም (ምሳሌ፡ 11/04/1998)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Expiry Greg (Date of Expiry)
              </label>
              <input
                type="text"
                value={formData.dateOfExpiryGreg || ""}
                onChange={(e) => handleInputChange("dateOfExpiryGreg", e.target.value)}
                placeholder="DD/MM/YYYY (e.g. 20/12/2005)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Issue Eth (የተሰጠበት ቀን)
              </label>
              <input
                type="text"
                value={formData.dateOfIssueEth || ""}
                onChange={(e) => handleInputChange("dateOfIssueEth", e.target.value)}
                placeholder="ቀን/ወር/ዓ.ም (ምሳሌ፡ 12/04/1988)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Issue Greg (Date of Issue)
              </label>
              <input
                type="text"
                value={formData.dateOfIssueGreg || ""}
                onChange={(e) => handleInputChange("dateOfIssueGreg", e.target.value)}
                placeholder="DD/MM/YYYY (e.g. 21/12/1995)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                FAN Number (16 Digits) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fanNumber || ""}
                onChange={(e) => handleInputChange("fanNumber", e.target.value)}
                placeholder="16-digit FAN (e.g. 8029 5016 4312 4539)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-teal-300 placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                FIN Number (ፋይዳ ልዩ ቁጥር) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.finNumber || ""}
                onChange={(e) => handleInputChange("finNumber", e.target.value)}
                placeholder="12-digit FIN (e.g. 2142 7039 0587)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-teal-300 placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Serial Number (SN)
              </label>
              <input
                type="text"
                value={formData.serialNumber || ""}
                onChange={(e) => handleInputChange("serialNumber", e.target.value)}
                placeholder="8-digit SN (e.g. 65501482)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-slate-300 placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phoneNumber || ""}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                placeholder="ስልክ ቁጥር (e.g. +251917521765)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Address */}
        <div className="mb-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <span>📍</span> Address & Nationality
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Region Amharic (ክልል)
              </label>
              <input
                type="text"
                value={formData.regionAmharic || ""}
                onChange={(e) => handleInputChange("regionAmharic", e.target.value)}
                placeholder="ክልል (ምሳሌ፡ ኦሮሚያ)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Region English
              </label>
              <input
                type="text"
                value={formData.regionEnglish || ""}
                onChange={(e) => handleInputChange("regionEnglish", e.target.value)}
                placeholder="Region (e.g. Oromia)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Nationality (Amharic / English)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.nationalityAmharic || ""}
                  onChange={(e) => handleInputChange("nationalityAmharic", e.target.value)}
                  placeholder="ዜግነት (ኢትዮጵያዊ)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={formData.nationalityEnglish || ""}
                  onChange={(e) => handleInputChange("nationalityEnglish", e.target.value)}
                  placeholder="Nationality (Ethiopian)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Subcity / Zone (ዞን / ክ/ከተማ)
              </label>
              <input
                type="text"
                value={formData.subcityAmharic || ""}
                onChange={(e) => handleInputChange("subcityAmharic", e.target.value)}
                placeholder="ዞን ወይም ክ/ከተማ (ምሳሌ፡ አዳማ)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Subcity / Zone English
              </label>
              <input
                type="text"
                value={formData.subcityEnglish || ""}
                onChange={(e) => handleInputChange("subcityEnglish", e.target.value)}
                placeholder="Subcity / Zone (e.g. Adama)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Woreda Amharic (ወረዳ)
              </label>
              <input
                type="text"
                value={formData.woredaAmharic || ""}
                onChange={(e) => handleInputChange("woredaAmharic", e.target.value)}
                placeholder="ወረዳ (ምሳሌ፡ ወረዳ 02)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Woreda English
              </label>
              <input
                type="text"
                value={formData.woredaEnglish || ""}
                onChange={(e) => handleInputChange("woredaEnglish", e.target.value)}
                placeholder="Woreda (e.g. Woreda 02)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3.5 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-lg hover:from-teal-500 hover:to-emerald-500 active:scale-[0.98] disabled:opacity-50 transition-all touch-manipulation"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Rendering Template 3 ID Card...
              </>
            ) : (
              <>🎨 Generate Template 3 Card</>
            )}
          </button>
        </div>
      </form>

      {/* Generated Preview Result */}
      {cards && (
        <section
          id="generated-card-section"
          className="rounded-2xl border border-teal-500/40 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-400">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                Render Complete
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                Print-Ready Ethiopian National ID (Template 3)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={cards.combinedUrl}
                download={`national-id-${formData.finNumber || "card"}-combined.png`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 shadow-md transition-all"
              >
                💾 Download Side-by-Side (300 DPI)
              </a>
              <a
                href={cards.frontUrl}
                download={`national-id-${formData.finNumber || "card"}-front.png`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Front Only
              </a>
              <a
                href={cards.backUrl}
                download={`national-id-${formData.finNumber || "card"}-back.png`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Back Only
              </a>
            </div>
          </div>

          {/* Combined Image Display */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-black/40 p-2 sm:p-4 text-center">
            <img
              src={cards.combinedUrl}
              alt="Generated Ethiopian National ID Card (Front and Back)"
              className="mx-auto max-h-[500px] w-full object-contain rounded-lg shadow-xl"
            />
          </div>
        </section>
      )}
    </div>
  );
}
