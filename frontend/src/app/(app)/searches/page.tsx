"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { Search, SearchStatus } from "../../../lib/types";
import SearchCard, { SearchListRow } from "../../../components/search/SearchCard";
import { Loader2, LayoutGrid, List, PlusCircle } from "lucide-react";
import Link from "next/link";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "no_results", label: "No results" },
  { value: "failed", label: "Failed" },
];

export default function SearchesPage() {
  const [searches, setSearches] = useState<Search[]>([]);
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      api
        .listSearches()
        .then(setSearches)
        .catch(() => {})
        .finally(() => setLoading(false));

    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  const visible = filter
    ? searches.filter((s) => s.status === (filter as SearchStatus))
    : searches;

  // Count by status for badges
  const counts = {
    all: searches.length,
    processing: searches.filter((s) => s.status === "processing").length,
    completed: searches.filter((s) => s.status === "completed").length,
    no_results: searches.filter((s) => s.status === "no_results").length,
    failed: searches.filter((s) => s.status === "failed").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Searches
        </h1>
        <Link
          href="/new-search"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
        >
          <PlusCircle className="h-4 w-4" />
          New Search
        </Link>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count =
              f.value === "" ? counts.all : counts[f.value as keyof typeof counts] || 0;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  filter === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      filter === f.value
                        ? "bg-white/20 text-white"
                        : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded-md p-1.5 transition ${
              viewMode === "grid"
                ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-md p-1.5 transition ${
              viewMode === "list"
                ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center text-sm text-slate-500">
          No searches found.
          <br />
          <Link
            href="/new-search"
            className="mt-2 inline-block text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Start a new search
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((s) => (
            <SearchCard key={s.id} search={s} />
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-2">
            <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span className="w-4" />
              <span className="flex-1">Company</span>
              <span className="hidden md:block w-32">Pages</span>
              <span className="hidden md:block w-24">Emails</span>
              <span className="hidden md:block w-24">Profiles</span>
              <span className="w-20">Date</span>
            </div>
          </div>
          {visible.map((s) => (
            <SearchListRow key={s.id} search={s} />
          ))}
        </div>
      )}
    </div>
  );
}
