"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Ban,
  Download,
  Loader2,
  RotateCw,
  Terminal,
  XCircle,
} from "lucide-react";
import { api } from "../../../../lib/api";
import { exportExcelUrl } from "../../../../lib/api";
import type { Contact, Search, SearchLog } from "../../../../lib/types";
import ContactsTable from "../../../../components/search/ContactsTable";
import { StatusChip } from "../../../../components/search/SearchCard";
import { formatDateWithTz, getSavedTimezone } from "../../../../lib/timezones";
import { clsx } from "clsx";

const LOG_ICONS: Record<string, string> = {
  info: "text-slate-400",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

export default function SearchDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = String(params.id);

  const [search, setSearch] = useState<Search | null>(null);
  const [allSearches, setAllSearches] = useState<Search[]>([]);
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [timezone, setTimezone] = useState(getSavedTimezone());

  const logRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const running = search
    ? search.status === "pending" || search.status === "processing"
    : false;

  // Load all searches to enable Next/Prev navigation
  useEffect(() => {
    setTimezone(getSavedTimezone());
    api.listSearches().then(setAllSearches).catch(() => {});
  }, []);

  // Active filter from query param or fallback to current search status
  const activeFilter = searchParams.get("filter") || (search ? search.status : "");

  // Filter searches so Next/Prev ONLY cycle through matching companies with same filter/status
  const filteredSearches = React.useMemo(() => {
    if (!activeFilter || activeFilter === "all") return allSearches;
    return allSearches.filter((s) => s.status === activeFilter);
  }, [allSearches, activeFilter]);

  // Compute Next and Previous search IDs within the filtered set
  const currentIndex = filteredSearches.findIndex((s) => s.id === id);
  const prevSearch = currentIndex > 0 ? filteredSearches[currentIndex - 1] : null;
  const nextSearch =
    currentIndex >= 0 && currentIndex < filteredSearches.length - 1
      ? filteredSearches[currentIndex + 1]
      : null;

  const goToSearch = (targetId: string) => {
    const url = `/searches/${targetId}${
      activeFilter ? `?filter=${encodeURIComponent(activeFilter)}` : ""
    }`;
    router.push(url);
  };

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const s = await api.getSearch(id);
        if (stopped) return;
        setSearch(s);
        if (s.status === "pending" || s.status === "processing") {
          const l = await api.getSearchLogs(id);
          if (!stopped) setLogs(l);
        } else {
          const [l, c] = await Promise.all([
            api.getSearchLogs(id),
            api.getSearchContacts(id),
          ]);
          if (!stopped) {
            setLogs(l);
            setContacts(c);
          }
        }
      } catch (err) {
        if (!stopped)
          setError(
            err instanceof Error ? err.message : "Could not load search.",
          );
      }
    }
    load();
    const interval = setInterval(() => {
      if (!stopped && (running || !search)) load();
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, running]);

  // Handle scroll events inside log container to prevent snapping when scrolled up
  const handleLogScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceToBottom < 30;
    setIsAtBottom(atBottom);
    setUserScrolledUp(!atBottom);
  };

  const scrollToBottom = () => {
    if (logRef.current) {
      logRef.current.scrollTo({
        top: logRef.current.scrollHeight,
        behavior: "smooth",
      });
      setUserScrolledUp(false);
      setIsAtBottom(true);
    }
  };

  // Only auto-scroll down if user was already at the bottom or on initial load
  useEffect(() => {
    if (logRef.current && (isInitialLoad.current || isAtBottom)) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
      if (logs.length > 0) {
        isInitialLoad.current = false;
      }
    }
  }, [logs, isAtBottom]);

  async function cancel() {
    setCancelBusy(true);
    try {
      const updated = await api.cancelSearch(id);
      setSearch(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function restart() {
    setRestarting(true);
    try {
      const s = await api.restartSearch(id);
      setSearch(s);
      setLogs([]);
      setContacts([]);
      isInitialLoad.current = true;
    } catch (err: any) {
      alert(`Could not restart search: ${err?.message || err}`);
    } finally {
      setRestarting(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-6 text-sm text-red-600 dark:text-red-300">
        {error}
      </div>
    );
  }
  if (!search) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const finished = !running;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Breadcrumb Context */}
      <nav className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
        <Link
          href="/searches"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition font-medium"
        >
          Searches
        </Link>
        <span>/</span>
        <Link
          href={
            activeFilter && activeFilter !== "all"
              ? `/searches?filter=${encodeURIComponent(activeFilter)}`
              : "/searches"
          }
          className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition uppercase text-[11px] tracking-wider"
        >
          {activeFilter && activeFilter !== "all"
            ? activeFilter.replace("_", " ")
            : "All Statuses"}
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[260px]">
          {search.company?.name || "Company Profile"}
        </span>
      </nav>

      {/* Top Bar with Back, Next/Prev Arrows, Counter, Title, and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3 min-w-0">
          <Link
            href={
              activeFilter && activeFilter !== "all"
                ? `/searches?filter=${encodeURIComponent(activeFilter)}`
                : "/searches"
            }
            className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Back to searches list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Filter-Scoped Next / Previous Company Arrows & Counter */}
          <div className="flex items-center space-x-1.5 border-r border-slate-200 dark:border-slate-800 pr-3">
            <button
              type="button"
              onClick={() => prevSearch && goToSearch(prevSearch.id)}
              disabled={!prevSearch}
              title={
                prevSearch
                  ? `Previous (${activeFilter || "all"}): ${prevSearch.company?.name}`
                  : `No previous company in ${activeFilter || "all"}`
              }
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>

            {filteredSearches.length > 0 && currentIndex >= 0 && (
              <span
                title={`Company ${currentIndex + 1} of ${filteredSearches.length} in ${activeFilter || "all"}`}
                className="text-xs font-mono font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap"
              >
                {currentIndex + 1} of {filteredSearches.length}
              </span>
            )}

            <button
              type="button"
              onClick={() => nextSearch && goToSearch(nextSearch.id)}
              disabled={!nextSearch}
              title={
                nextSearch
                  ? `Next (${activeFilter || "all"}): ${nextSearch.company?.name}`
                  : `No next company in ${activeFilter || "all"}`
              }
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
                {search.company?.name}
              </h1>
              <StatusChip status={search.status} />
            </div>
            <p className="text-xs text-slate-400 truncate">
              {search.company?.website}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Again Search button */}
          <button
            onClick={restart}
            disabled={restarting || running}
            title="Restart and re-crawl HR contacts for this company"
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RotateCw
              className={clsx(
                "h-3.5 w-3.5",
                (restarting || running) && "animate-spin text-blue-500",
              )}
            />
            <span>{restarting ? "Restarting..." : "Again search"}</span>
          </button>

          {running && (
            <button
              onClick={cancel}
              disabled={cancelBusy}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-60 cursor-pointer"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>{cancelBusy ? "Cancelling…" : "Cancel"}</span>
            </button>
          )}

          {finished && contacts.length > 0 && (
            <a
              href={exportExcelUrl(search.id)}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </a>
          )}
        </div>
      </div>

      {running && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2 shadow-sm">
          <div className="flex justify-between text-xs font-semibold text-slate-500">
            <span className="truncate">
              {search.current_step || "Starting…"}
            </span>
            <span>{search.progress_pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.max(search.progress_pct, 5)}%` }}
            />
          </div>
          <div className="flex space-x-4 text-[11px] text-slate-400">
            <span>{search.pages_crawled} pages crawled</span>
            <span>{search.emails_found} emails found</span>
            <span>{search.profiles_found} profiles found</span>
          </div>
        </div>
      )}

      {search.error_message && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex items-start space-x-2 text-sm text-red-600 dark:text-red-300">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{search.error_message}</span>
        </div>
      )}

      {search.summary && finished && (
        <div
          className={clsx(
            "rounded-xl border p-4 text-sm font-semibold",
            search.status === "completed"
              ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300",
          )}
        >
          {search.summary}
        </div>
      )}

      {/* Live logs with FREE SCROLLING support */}
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-blue-400" />
            <span>Progress log</span>
          </div>
          {logs.length > 0 && (
            <span className="text-[11px] font-normal text-slate-500">
              {logs.length} events logged
            </span>
          )}
        </div>

        <div
          ref={logRef}
          onScroll={handleLogScroll}
          className="max-h-72 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-5 space-y-0.5"
        >
          {logs.length === 0 && (
            <p className="text-slate-500">Waiting for the worker to start…</p>
          )}
          {logs.map((log) => (
            <p
              key={log.id}
              className={LOG_ICONS[log.level] || "text-slate-400"}
            >
              <span className="text-slate-600 mr-2">
                {formatDateWithTz(log.created_at, timezone)}
              </span>
              {log.message}
            </p>
          ))}
          {running && <p className="text-blue-400 animate-pulse">▍</p>}
        </div>

        {/* Scroll to bottom pill when user scrolled up */}
        {userScrolledUp && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-6 right-6 inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-[11px] font-bold shadow-lg transition animate-bounce cursor-pointer"
          >
            <ArrowDown className="h-3 w-3" />
            <span>Jump to latest</span>
          </button>
        )}
      </div>

      {finished && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Discovered contacts ({contacts.length})
          </h2>
          {contacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
              {search.status === "no_results"
                ? "No verified HR contact found. The website and available providers yielded no reliable HR email – no email is shown instead of guessing one."
                : search.status === "failed"
                  ? "The search failed before producing results."
                  : "No contacts were recorded for this search."}
            </div>
          ) : (
            <ContactsTable contacts={contacts} />
          )}
        </div>
      )}
    </div>
  );
}
