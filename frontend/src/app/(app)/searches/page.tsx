"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { Search, SearchStatus } from "../../../lib/types";
import SearchCard from "../../../components/search/SearchCard";
import { Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Searches</h1>
        <div className="flex space-x-2">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center text-sm text-slate-500">
          No searches found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((s) => (
            <SearchCard key={s.id} search={s} />
          ))}
        </div>
      )}
    </div>
  );
}
