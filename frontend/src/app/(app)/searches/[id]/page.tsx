"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Download,
  Loader2,
  Terminal,
  XCircle,
} from "lucide-react";
import { api } from "../../../../lib/api";
import { exportExcelUrl } from "../../../../lib/api";
import type { Contact, Search, SearchLog } from "../../../../lib/types";
import ContactsTable from "../../../../components/search/ContactsTable";
import { StatusChip } from "../../../../components/search/SearchCard";
import { clsx } from "clsx";

const LOG_ICONS: Record<string, string> = {
  info: "text-slate-400",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

export default function SearchDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [search, setSearch] = useState<Search | null>(null);
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const running = search
    ? search.status === "pending" || search.status === "processing"
    : false;

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

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  async function cancel() {
    setCancelBusy(true);
    try {
      const s = await api.cancelSearch(id);
      setSearch(s);
    } catch {
      /* ignore */
    } finally {
      setCancelBusy(false);
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <Link
            href="/searches"
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
              {search.company?.name}
            </h1>
            <p className="text-xs text-slate-400 truncate">
              {search.company?.website}
            </p>
          </div>
          <StatusChip status={search.status} />
        </div>
        <div className="flex items-center space-x-2">
          {running && (
            <button
              onClick={cancel}
              disabled={cancelBusy}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-60"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>{cancelBusy ? "Cancelling…" : "Cancel"}</span>
            </button>
          )}
          {finished && contacts.length > 0 && (
            <a
              href={exportExcelUrl(search.id)}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
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
              style={{ width: `${search.progress_pct}%` }}
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

      {/* Live logs */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 shadow-sm">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 mb-2">
          <Terminal className="h-4 w-4 text-blue-400" />
          <span>Progress log</span>
        </div>
        <div
          ref={logRef}
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
                {log.created_at
                  ? new Date(log.created_at).toLocaleTimeString()
                  : ""}
              </span>
              {log.message}
            </p>
          ))}
          {running && <p className="text-blue-400 animate-pulse">▍</p>}
        </div>
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
