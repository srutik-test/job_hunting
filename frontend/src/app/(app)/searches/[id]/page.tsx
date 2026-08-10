"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  SearchX,
  Terminal,
  User,
  XCircle,
} from "lucide-react";
import { api, exportExcelUrl } from "../../../../lib/api";
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

// =============================================================================
// Count Summary Component
// =============================================================================
function CountSummary({ search }: { search: Search }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs">
      <span className="flex items-center gap-1.5 text-slate-500">
        <Globe className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {search.pages_crawled}
        </span>
        pages crawled
      </span>
      <span className="flex items-center gap-1.5 text-slate-500">
        <Mail className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {search.emails_found}
        </span>
        emails found
      </span>
      <span className="flex items-center gap-1.5 text-slate-500">
        <User className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {search.profiles_found}
        </span>
        profiles found
      </span>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================
export default function SearchDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [search, setSearch] = useState<Search | null>(null);
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showRawContacts, setShowRawContacts] = useState(false);
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
          setError(err instanceof Error ? err.message : "Could not load search.");
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
  }, [id, running, search]);

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

  // Count contacts by category
  const verifiedHR = contacts.filter((c) => c.contact_category === "verified_hr");
  const possibleHR = contacts.filter((c) => c.contact_category === "possible_hr");
  const linkedinProfiles = contacts.filter((c) => c.contact_category === "linkedin");
  const companyEmails = contacts.filter((c) => c.contact_category === "company_email");

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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/searches"
            className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-400 shrink-0" />
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
                {search.company?.name}
              </h1>
              <StatusChip status={search.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5 ml-7">
              {search.company?.website}
              {search.duration_seconds && (
                <span className="ml-2">
                  • {search.duration_seconds}s
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {running && (
            <button
              onClick={cancel}
              disabled={cancelBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-60"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>{cancelBusy ? "Cancelling…" : "Cancel"}</span>
            </button>
          )}
          {finished && contacts.length > 0 && (
            <a
              href={exportExcelUrl(search.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </a>
          )}
        </div>
      </div>

      {/* Progress Section (for running searches) */}
      {running && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-sm">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-slate-600 dark:text-slate-300 truncate">
              {search.current_step || "Starting…"}
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              {search.progress_pct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${search.progress_pct}%` }}
            />
          </div>
          <CountSummary search={search} />
        </div>
      )}

      {/* Error Message */}
      {search.error_message && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-3 text-sm text-red-600 dark:text-red-300">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{search.error_message}</span>
        </div>
      )}

      {/* Summary Banner */}
      {search.summary && finished && (
        <div
          className={clsx(
            "rounded-xl border p-4 text-sm font-semibold",
            search.status === "completed"
              ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              : search.status === "no_results"
                ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
          )}
        >
          {search.status === "completed" && (
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-xs">
                {verifiedHR.length} verified HR emails
              </span>
              {possibleHR.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs">
                  {possibleHR.length} possible
                </span>
              )}
              {linkedinProfiles.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs">
                  {linkedinProfiles.length} profiles
                </span>
              )}
            </div>
          )}
          {search.summary}
        </div>
      )}

      {/* Progress Logs (Collapsible) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Terminal className="h-4 w-4 text-blue-500" />
            <span>Progress Log</span>
            <span className="text-xs text-slate-400">({logs.length} entries)</span>
          </div>
          {showLogs ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showLogs && (
          <div
            ref={logRef}
            className="max-h-64 overflow-y-auto border-t border-slate-100 dark:border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-5"
          >
            {logs.length === 0 && (
              <p className="text-slate-500">Waiting for the worker to start…</p>
            )}
            {logs.map((log) => (
              <p key={log.id} className={LOG_ICONS[log.level] || "text-slate-400"}>
                <span className="text-slate-600 mr-2">
                  {log.created_at
                    ? new Date(log.created_at).toLocaleTimeString()
                    : ""}
                </span>
                {log.message}
              </p>
            ))}
            {running && (
              <p className="text-blue-400 animate-pulse">▍</p>
            )}
          </div>
        )}
      </div>

      {/* Results Section */}
      {finished && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Discovered Contacts
            </h2>
            {contacts.length > 0 && (
              <span className="text-sm text-slate-500">
                {contacts.length} total
              </span>
            )}
          </div>

          {/* Empty State */}
          {contacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              {search.status === "no_results" ? (
                <>
                  <SearchX className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    No verified HR contact found
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    The website and available providers yielded no reliable HR email.
                    We prefer showing "no result" over showing a guessed address.
                  </p>
                </>
              ) : search.status === "failed" ? (
                <>
                  <XCircle className="mx-auto h-10 w-10 text-red-300 dark:text-red-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    The search failed before producing results
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">No contacts were recorded for this search.</p>
              )}
            </div>
          ) : (
            /* Contacts Table */
            <ContactsTable contacts={contacts} />
          )}
        </div>
      )}
    </div>
  );
}
