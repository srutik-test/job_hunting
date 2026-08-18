"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import type { Search, SearchStatus } from "../../../lib/types";
import SearchCard from "../../../components/search/SearchCard";
import {
  Clock,
  Filter,
  Globe,
  Loader2,
  RotateCw,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  getSavedTimezone,
  saveTimezone,
} from "../../../lib/timezones";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "no_results", label: "No results" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

type SortOption = "date_desc" | "date_asc" | "name_asc" | "name_desc";

export default function SearchesPage() {
  const [searches, setSearches] = useState<Search[]>([]);
  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [timezone, setTimezoneState] = useState(DEFAULT_TIMEZONE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setTimezoneState(getSavedTimezone());
  }, []);

  const handleTimezoneChange = (newTz: string) => {
    setTimezoneState(newTz);
    saveTimezone(newTz);
  };

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const data = await api.listSearches();
      setSearches(data);
    } catch {
      // Ignore poll errors
    } finally {
      setLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(false), 3500);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = async (searchId: string) => {
    try {
      const updated = await api.restartSearch(searchId);
      setSearches((prev) =>
        prev.map((s) => (s.id === searchId ? updated : s)),
      );
    } catch (err: any) {
      alert(`Could not restart search: ${err?.message || err}`);
    }
  };

  // Filter and sort searches
  const visible = useMemo(() => {
    let list = [...searches];

    // Status filter
    if (filter) {
      list = list.filter((s) => s.status === (filter as SearchStatus));
    }

    // Text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const name = (s.company?.name || "").toLowerCase();
        const site = (s.company?.website || "").toLowerCase();
        const loc = (s.company?.location || "").toLowerCase();
        const ind = (s.company?.industry || "").toLowerCase();
        return (
          name.includes(q) ||
          site.includes(q) ||
          loc.includes(q) ||
          ind.includes(q)
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "name_asc") {
        return (a.company?.name || "").localeCompare(b.company?.name || "");
      }
      if (sortBy === "name_desc") {
        return (b.company?.name || "").localeCompare(a.company?.name || "");
      }
      if (sortBy === "date_asc") {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      }
      // date_desc (default)
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [searches, filter, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header with Title & Timezone selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Company Searches
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor real-time HR & recruitment discovery pipelines
          </p>
        </div>

        {/* Global Controls: Refresh & Timezone */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            title="Refresh searches"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RotateCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 shadow-sm">
            <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              title="Select display timezone (Default: IST)"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option
                  key={tz.value}
                  value={tz.value}
                  className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Search Bar and Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies by name, website domain, location..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-9 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-200">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 font-normal">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option
                value="date_desc"
                className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                Date: Newest first
              </option>
              <option
                value="date_asc"
                className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                Date: Oldest first
              </option>
              <option
                value="name_asc"
                className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                Company: A → Z
              </option>
              <option
                value="name_desc"
                className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                Company: Z → A
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {FILTERS.map((f) => {
          const count = f.value
            ? searches.filter((s) => s.status === f.value).length
            : searches.length;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shrink-0 cursor-pointer ${
                active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/30"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs text-slate-400">Loading searches...</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 p-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
            <SearchIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No matching company searches
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No companies matched "${searchQuery}". Try adjusting your keywords or clearing the filter.`
              : "No searches found in this category. Start a new search from the dashboard or upload an Excel file."}
          </p>
          {(filter || searchQuery) && (
            <button
              onClick={() => {
                setFilter("");
                setSearchQuery("");
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Showing {visible.length} of {searches.length} companies
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {visible.map((s) => (
              <SearchCard
                key={s.id}
                search={s}
                timezone={timezone}
                activeFilter={filter}
                onRestart={handleRestart}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
