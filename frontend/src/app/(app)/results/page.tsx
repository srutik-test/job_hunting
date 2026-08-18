"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Globe,
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
  X,
} from "lucide-react";
import { api, exportExcelUrl } from "../../../lib/api";
import type { Contact } from "../../../lib/types";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  getSavedTimezone,
  saveTimezone,
} from "../../../lib/timezones";
import ContactsTable from "../../../components/search/ContactsTable";
import CompanyGroupedContacts from "../../../components/search/CompanyGroupedContacts";
import ExcelPreviewTable from "../../../components/search/ExcelPreviewTable";
import DateRangeCalendarModal, {
  DateTimeRange,
} from "../../../components/search/DateRangeCalendarModal";
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

type SortOption =
  | "date_desc"
  | "date_asc"
  | "confidence_desc"
  | "confidence_asc"
  | "company_asc"
  | "company_desc"
  | "name_asc";

export default function ResultsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [verification, setVerification] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [confidencePreset, setConfidencePreset] = useState<string>("");
  const [customConfidence, setCustomConfidence] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("");
  const [customDateRange, setCustomDateRange] = useState<DateTimeRange | null>(
    null,
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [timezone, setTimezoneState] = useState<string>(DEFAULT_TIMEZONE);
  const [viewMode, setViewMode] = useState<"grouped" | "flat" | "excel_preview">(
    "grouped",
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Extract all activity dates to populate calendar green highlights
  const activityDates = useMemo(
    () => contacts.map((c) => c.created_at),
    [contacts],
  );

  useEffect(() => {
    setTimezoneState(getSavedTimezone());
    const onTzChanged = (e: any) => {
      if (e?.detail) setTimezoneState(e.detail);
    };
    window.addEventListener("timezone-changed", onTzChanged);
    return () => window.removeEventListener("timezone-changed", onTzChanged);
  }, []);

  const handleTimezoneChange = (newTz: string) => {
    setTimezoneState(newTz);
    saveTimezone(newTz);
  };

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

  // Autocomplete suggestions computed from company list & contacts
  const suggestions = useMemo(() => {
    if (!q.trim()) return [];
    const query = q.toLowerCase().trim();
    const results: { text: string; type: string }[] = [];
    const seen = new Set<string>();

    for (const comp of companyList) {
      if (comp.toLowerCase().includes(query)) {
        results.push({ text: comp, type: "Company" });
        seen.add(comp.toLowerCase());
        if (results.length >= 6) break;
      }
    }

    if (results.length < 6) {
      for (const c of contacts) {
        if (
          c.name &&
          c.name.toLowerCase().includes(query) &&
          !seen.has(c.name.toLowerCase())
        ) {
          results.push({ text: c.name, type: "Person" });
          seen.add(c.name.toLowerCase());
        } else if (
          c.designation &&
          c.designation.toLowerCase().includes(query) &&
          !seen.has(c.designation.toLowerCase())
        ) {
          results.push({ text: c.designation, type: "Role" });
          seen.add(c.designation.toLowerCase());
        }
        if (results.length >= 6) break;
      }
    }
    return results;
  }, [q, companyList, contacts]);

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    let list = [...contacts];

    if (selectedCompany) {
      list = list.filter((c) => c.company_name === selectedCompany);
    }

    if (timeFilter) {
      const now = new Date().getTime();
      list = list.filter((c) => {
        if (!c.created_at) return true;
        const contactTime = new Date(c.created_at).getTime();
        if (isNaN(contactTime)) return true;
        const diffMs = now - contactTime;
        if (timeFilter === "today") {
          return diffMs <= 24 * 60 * 60 * 1000;
        } else if (timeFilter === "7days") {
          return diffMs <= 7 * 24 * 60 * 60 * 1000;
        } else if (timeFilter === "30days") {
          return diffMs <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      });
    }

    if (customDateRange && customDateRange.startDate) {
      const startMs = new Date(
        `${customDateRange.startDate}T${customDateRange.startTime || "00:00"}:00`,
      ).getTime();
      const endMs = new Date(
        `${customDateRange.endDate || customDateRange.startDate}T${
          customDateRange.endTime || "23:59"
        }:59`,
      ).getTime();
      list = list.filter((c) => {
        if (!c.created_at) return true;
        const cTime = new Date(c.created_at).getTime();
        if (isNaN(cTime)) return true;
        return cTime >= startMs && cTime <= endMs;
      });
    }

    list.sort((a, b) => {
      if (sortBy === "date_desc") {
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      } else if (sortBy === "date_asc") {
        return (
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        );
      } else if (sortBy === "confidence_desc") {
        return (b.confidence_score || 0) - (a.confidence_score || 0);
      } else if (sortBy === "confidence_asc") {
        return (a.confidence_score || 0) - (b.confidence_score || 0);
      } else if (sortBy === "company_asc") {
        return (a.company_name || "").localeCompare(b.company_name || "");
      } else if (sortBy === "company_desc") {
        return (b.company_name || "").localeCompare(a.company_name || "");
      } else if (sortBy === "name_asc") {
        return (a.name || a.email || "").localeCompare(b.name || b.email || "");
      }
      return 0;
    });

    return list;
  }, [contacts, selectedCompany, timeFilter, customDateRange, sortBy]);

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
    minConfidence !== undefined ||
    timeFilter ||
    customDateRange !== null ||
    sortBy !== "date_desc",
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
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search company, name, email, or designation…"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Interactive Autocomplete Suggestions Popover */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Company Suggestions
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQ(sug.text);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-blue-50/70 dark:hover:bg-blue-950/40 flex items-center justify-between group transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {sug.text}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {sug.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setViewMode("grouped")}
              className={clsx(
                "inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer",
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
                "inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer",
                viewMode === "flat"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900",
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span>Flat View</span>
            </button>
            <button
              onClick={() => setViewMode("excel_preview")}
              className={clsx(
                "inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer",
                viewMode === "excel_preview"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900",
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              <span>Excel Preview</span>
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

          {/* Time Filter */}
          <div className="flex items-center space-x-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value);
                if (e.target.value) setCustomDateRange(null);
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">All Time</option>
              <option value="today">Today (Last 24h)</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>

          {/* Calendar & Time Between Range Picker */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setIsCalendarOpen(true)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-sm",
                customDateRange
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-600",
              )}
              title="Select custom date and time range with visual activity calendar"
            >
              <CalendarIcon
                className={clsx(
                  "h-3.5 w-3.5",
                  customDateRange
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400",
                )}
              />
              <span>
                {customDateRange
                  ? `${customDateRange.startDate} → ${
                      customDateRange.endDate || customDateRange.startDate
                    }`
                  : "Calendar & Time Range"}
              </span>
            </button>
            {customDateRange && (
              <button
                type="button"
                onClick={() => setCustomDateRange(null)}
                title="Clear custom date range"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort By Filter */}
          <div className="flex items-center space-x-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="date_desc">Date (Newest first)</option>
              <option value="date_asc">Date (Oldest first)</option>
              <option value="confidence_desc">Confidence (High → Low)</option>
              <option value="confidence_asc">Confidence (Low → High)</option>
              <option value="company_asc">Company (A → Z)</option>
              <option value="company_desc">Company (Z → A)</option>
              <option value="name_asc">Name / Email (A → Z)</option>
            </select>
          </div>

          {/* Timezone Selector */}
          <div className="flex items-center space-x-1.5">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
              title="Change display timezone"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
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
                setTimeFilter("");
                setCustomDateRange(null);
                setSortBy("date_desc");
              }}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Date & Time Range Calendar Modal */}
      <DateRangeCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        value={customDateRange}
        onChange={(range) => {
          setCustomDateRange(range);
          if (range) setTimeFilter("");
        }}
        activityDates={activityDates}
      />

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
      ) : viewMode === "excel_preview" ? (
        <ExcelPreviewTable
          contacts={filteredContacts}
          timezone={timezone}
          onRefresh={load}
        />
      ) : (
        <ContactsTable contacts={filteredContacts} timezone={timezone} />
      )}
    </div>
  );
}
