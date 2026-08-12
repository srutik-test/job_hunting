"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  Percent,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Users,
} from "lucide-react";
import { api, exportExcelUrl } from "../../../lib/api";
import type { Contact } from "../../../lib/types";
import ContactsTable from "../../../components/search/ContactsTable";
import CompanyGroupedContacts from "../../../components/search/CompanyGroupedContacts";
import { CATEGORY_LABELS } from "../../../lib/types";
import { clsx } from "clsx";

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "verified_hr", label: CATEGORY_LABELS.verified_hr },
  { value: "possible_hr", label: CATEGORY_LABELS.possible_hr },
  { value: "company_email", label: CATEGORY_LABELS.company_email },
  { value: "linkedin", label: CATEGORY_LABELS.linkedin },
];

const VERIFICATION_OPTIONS = [
  { value: "", label: "Any verification" },
  { value: "verified", label: "Verified" },
  { value: "partially_verified", label: "Partially verified" },
  { value: "unverified", label: "Unverified" },
];

export default function ResultsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [verification, setVerification] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [confidencePreset, setConfidencePreset] = useState<string>("");
  const [customConfidence, setCustomConfidence] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  // Determine effective min_confidence value
  const minConfidence = useMemo(() => {
    if (confidencePreset === "custom") {
      if (!customConfidence) return undefined;
      const parsed = parseInt(customConfidence, 10);
      return !isNaN(parsed) && parsed >= 0 && parsed <= 100
        ? parsed
        : undefined;
    }
    if (confidencePreset) {
      const parsed = parseInt(confidencePreset, 10);
      return !isNaN(parsed) ? parsed : undefined;
    }
    return undefined;
  }, [confidencePreset, customConfidence]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listContacts({
        q,
        category,
        verification_status: verification,
        min_confidence: minConfidence,
      });
      setContacts(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [q, category, verification, minConfidence]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // Extract unique companies from fetched contacts
  const companyList = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) {
      if (c.company_name) set.add(c.company_name);
    }
    return Array.from(set).sort();
  }, [contacts]);

  // Filter contacts by selected company (if any)
  const filteredContacts = useMemo(() => {
    if (!selectedCompany) return contacts;
    return contacts.filter((c) => c.company_name === selectedCompany);
  }, [contacts, selectedCompany]);

  // Aggregate statistics for analysis cards
  const stats = useMemo(() => {
    let verifiedHr = 0;
    let possibleHr = 0;
    let companyEmails = 0;
    let profiles = 0;
    const companies = new Set<string>();

    for (const c of filteredContacts) {
      if (c.company_name) companies.add(c.company_name);
      if (c.contact_category === "verified_hr") verifiedHr += 1;
      else if (c.contact_category === "possible_hr") possibleHr += 1;
      else if (c.contact_category === "company_email") companyEmails += 1;
      else if (c.contact_category === "linkedin") profiles += 1;
    }

    return {
      companies: companies.size,
      total: filteredContacts.length,
      verifiedHr,
      possibleHr,
      companyEmails,
      profiles,
    };
  }, [filteredContacts]);

  const isFilterActive = Boolean(
    q ||
    category ||
    verification ||
    selectedCompany ||
    minConfidence !== undefined,
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              All Contacts & Analysis
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              {filteredContacts.length} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real evidence-backed HR contacts, grouped by company for easy
            analysis.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {filteredContacts.length > 0 && (
            <a
              href={exportExcelUrl({
                q: q || undefined,
                category: category || undefined,
                verification_status: verification || undefined,
                company_name: selectedCompany || undefined,
                min_confidence: minConfidence,
              })}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Download className="h-4 w-4" />
              <span>
                {isFilterActive
                  ? `Export Filtered (${filteredContacts.length})`
                  : "Export to Excel"}
              </span>
            </a>
          )}
        </div>
      </div>

      {/* Analysis Metrics Bar - Interactive Clickable Tab Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Companies Tab Card */}
        <button
          type="button"
          onClick={() => {
            setCategory("");
            setSelectedCompany("");
          }}
          className={clsx(
            "rounded-2xl border p-4 shadow-sm text-left transition select-none cursor-pointer group hover:scale-[1.02]",
            !category && !selectedCompany
              ? "border-blue-500/50 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/30"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-blue-500">
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Companies
              </span>
            </div>
            {!category && !selectedCompany && (
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            )}
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {stats.companies}
          </p>
        </button>

        {/* Verified HR Tab Card */}
        <button
          type="button"
          onClick={() =>
            setCategory(category === "verified_hr" ? "" : "verified_hr")
          }
          className={clsx(
            "rounded-2xl border p-4 shadow-sm text-left transition select-none cursor-pointer group hover:scale-[1.02]",
            category === "verified_hr"
              ? "border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Verified HR
              </span>
            </div>
            {category === "verified_hr" && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {stats.verifiedHr}
          </p>
        </button>

        {/* Possible HR Tab Card */}
        <button
          type="button"
          onClick={() =>
            setCategory(category === "possible_hr" ? "" : "possible_hr")
          }
          className={clsx(
            "rounded-2xl border p-4 shadow-sm text-left transition select-none cursor-pointer group hover:scale-[1.02]",
            category === "possible_hr"
              ? "border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/30 ring-2 ring-amber-500/30"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-500">
              <Mail className="h-4 w-4" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Possible HR
              </span>
            </div>
            {category === "possible_hr" && (
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            )}
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {stats.possibleHr}
          </p>
        </button>

        {/* Company Mail Tab Card */}
        <button
          type="button"
          onClick={() =>
            setCategory(category === "company_email" ? "" : "company_email")
          }
          className={clsx(
            "rounded-2xl border p-4 shadow-sm text-left transition select-none cursor-pointer group hover:scale-[1.02]",
            category === "company_email"
              ? "border-slate-500/60 bg-slate-100 dark:bg-slate-800/80 ring-2 ring-slate-400/40"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-500">
              <Table2 className="h-4 w-4" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Company Mail
              </span>
            </div>
            {category === "company_email" && (
              <span className="h-2 w-2 rounded-full bg-slate-500" />
            )}
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-700 dark:text-slate-300">
            {stats.companyEmails}
          </p>
        </button>

        {/* HR Profiles Tab Card */}
        <button
          type="button"
          onClick={() => setCategory(category === "linkedin" ? "" : "linkedin")}
          className={clsx(
            "col-span-2 sm:col-span-1 rounded-2xl border p-4 shadow-sm text-left transition select-none cursor-pointer group hover:scale-[1.02]",
            category === "linkedin"
              ? "border-sky-500/60 bg-sky-50/40 dark:bg-sky-950/30 ring-2 ring-sky-500/30"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sky-500">
              <Users className="h-4 w-4" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                HR Profiles
              </span>
            </div>
            {category === "linkedin" && (
              <span className="h-2 w-2 rounded-full bg-sky-500" />
            )}
          </div>
          <p className="mt-2 text-2xl font-extrabold text-sky-600 dark:text-sky-400">
            {stats.profiles}
          </p>
        </button>
      </div>

      {/* Filter & View Controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company, name, email, or designation…"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setViewMode("grouped")}
              className={clsx(
                "inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                viewMode === "grouped"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900",
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Group by Company</span>
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={clsx(
                "inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                viewMode === "flat"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900",
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span>Flat View</span>
            </button>
          </div>
        </div>

        {/* Dropdown & Custom Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {companyList.length > 1 && (
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">All Companies ({companyList.length})</option>
              {companyList.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          )}

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
          >
            {VERIFICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Confidence Score Filter */}
          <div className="flex items-center space-x-1.5">
            <select
              value={confidencePreset}
              onChange={(e) => setConfidencePreset(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">Any Confidence</option>
              <option value="90">High (90%+)</option>
              <option value="70">Medium (70%+)</option>
              <option value="50">Potential (50%+)</option>
              <option value="custom">Custom min %…</option>
            </select>

            {confidencePreset === "custom" && (
              <div className="flex items-center space-x-1 animate-in fade-in duration-150">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Min %"
                  value={customConfidence}
                  onChange={(e) => setCustomConfidence(e.target.value)}
                  className="w-20 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400 font-bold">%</span>
              </div>
            )}
          </div>

          {isFilterActive && (
            <button
              onClick={() => {
                setQ("");
                setCategory("");
                setVerification("");
                setSelectedCompany("");
                setConfidencePreset("");
                setCustomConfidence("");
              }}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center text-sm text-slate-500 space-y-2">
          <Building2 className="h-10 w-10 text-slate-400 mx-auto opacity-50" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            No contacts match your filters.
          </p>
          <p className="text-xs text-slate-400">
            Try adjusting your search query, confidence threshold, or category
            filter.
          </p>
        </div>
      ) : viewMode === "grouped" ? (
        <CompanyGroupedContacts contacts={filteredContacts} onRefresh={load} />
      ) : (
        <ContactsTable contacts={filteredContacts} />
      )}
    </div>
  );
}
