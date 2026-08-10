"use client";

import React from "react";
import Link from "next/link";
import {
  AlertOctagon,
  CheckCircle2,
  Loader2,
  MinusCircle,
  SearchX,
  Timer,
  XCircle,
} from "lucide-react";
import type { Search, SearchStatus } from "../../lib/types";
import { clsx } from "clsx";

export const STATUS_META: Record<
  SearchStatus,
  { label: string; cls: string; Icon: typeof Timer }
> = {
  pending: {
    label: "Pending",
    cls: "bg-slate-500/10 text-slate-500 ring-slate-500/20",
    Icon: Timer,
  },
  processing: {
    label: "Processing",
    cls: "bg-blue-500/10 text-blue-500 ring-blue-500/25",
    Icon: Loader2,
  },
  completed: {
    label: "Completed",
    cls: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/25",
    Icon: CheckCircle2,
  },
  no_results: {
    label: "No results",
    cls: "bg-slate-500/10 text-slate-500 ring-slate-500/20",
    Icon: SearchX,
  },
  failed: {
    label: "Failed",
    cls: "bg-red-500/10 text-red-500 ring-red-500/25",
    Icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-slate-500/10 text-slate-500 ring-slate-500/20",
    Icon: MinusCircle,
  },
};

export function StatusChip({ status }: { status: SearchStatus }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span
      className={clsx(
        "inline-flex items-center space-x-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        meta.cls,
      )}
    >
      <meta.Icon
        className={clsx(
          "h-3.5 w-3.5",
          status === "processing" && "animate-spin",
        )}
      />
      <span>{meta.label}</span>
    </span>
  );
}

export default function SearchCard({ search }: { search: Search }) {
  return (
    <Link
      href={`/searches/${search.id}`}
      className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white truncate">
            {search.company?.name || "Unknown company"}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {search.company?.website}
          </p>
        </div>
        <StatusChip status={search.status} />
      </div>

      {(search.status === "processing" || search.status === "pending") && (
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${search.progress_pct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {search.current_step}
          </p>
        </div>
      )}

      {search.summary &&
        (search.status === "completed" || search.status === "no_results") && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {search.summary}
          </p>
        )}
      {search.error_message && search.status === "failed" && (
        <p className="mt-2 text-xs text-red-500 line-clamp-2">
          {search.error_message}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {search.pages_crawled} pages · {search.emails_found} emails ·{" "}
          {search.profiles_found} profiles
        </span>
        <span>
          {search.created_at
            ? new Date(search.created_at).toLocaleString()
            : ""}
        </span>
      </div>
    </Link>
  );
}

export function FailureHint({ search }: { search: Search }) {
  if (search.status !== "failed") return null;
  return (
    <div className="mt-3 flex items-start space-x-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-600 dark:text-red-300">
      <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{search.error_message || "Search failed."}</span>
    </div>
  );
}
