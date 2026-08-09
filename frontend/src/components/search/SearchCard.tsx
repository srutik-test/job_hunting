"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Mail,
  MinusCircle,
  SearchX,
  Timer,
  User,
  XCircle,
} from "lucide-react";
import type { Search, SearchStatus } from "../../lib/types";
import { clsx } from "clsx";

// =============================================================================
// Status Configuration
// =============================================================================
const STATUS_META: Record<
  SearchStatus,
  {
    label: string;
    cls: string;
    Icon: typeof Timer;
  }
> = {
  pending: {
    label: "Pending",
    cls: "bg-slate-500/10 text-slate-500 ring-slate-500/20",
    Icon: Clock,
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
    label: "No Results",
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

// =============================================================================
// Status Chip Component
// =============================================================================
export function StatusChip({ status }: { status: SearchStatus }) {
  const meta = STATUS_META[status] || STATUS_META.pending;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        meta.cls
      )}
    >
      <meta.Icon
        className={clsx(
          "h-3.5 w-3.5",
          status === "processing" && "animate-spin"
        )}
      />
      <span>{meta.label}</span>
    </span>
  );
}

// =============================================================================
// Search Card Component (Compact List Style)
// =============================================================================
interface SearchCardProps {
  search: Search;
}

export default function SearchCard({ search }: SearchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[search.status] || STATUS_META.pending;

  const isRunning = search.status === "processing" || search.status === "pending";

  return (
    <Link
      href={`/searches/${search.id}`}
      className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition"
    >
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Company Name */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <p className="font-semibold text-slate-900 dark:text-white truncate">
                {search.company?.name || "Unknown company"}
              </p>
            </div>
            {/* Website */}
            <p className="text-xs text-slate-400 truncate ml-6 mt-0.5">
              {search.company?.website}
            </p>
          </div>

          <StatusChip status={search.status} />
        </div>

        {/* Summary (for completed searches) */}
        {search.summary && !isRunning && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 ml-6">
            {search.summary}
          </p>
        )}

        {/* Progress Bar (for running searches) */}
        {isRunning && (
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

        {/* Stats Row */}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {search.pages_crawled}
            </span>
            pages
          </span>
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {search.emails_found}
            </span>
            emails
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {search.profiles_found}
            </span>
            profiles
          </span>
        </div>
      </div>

      {/* Error Message */}
      {search.error_message && search.status === "failed" && (
        <div className="px-4 pb-4">
          <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-600 dark:text-red-300">
            <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{search.error_message}</span>
          </div>
        </div>
      )}
    </Link>
  );
}

// =============================================================================
// Search List Row Component (Alternative compact view)
// =============================================================================
interface SearchListRowProps {
  search: Search;
}

export function SearchListRow({ search }: SearchListRowProps) {
  const meta = STATUS_META[search.status] || STATUS_META.pending;
  const isRunning = search.status === "processing" || search.status === "pending";

  return (
    <Link
      href={`/searches/${search.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 transition"
    >
      {/* Status Icon */}
      <meta.Icon
        className={clsx(
          "h-5 w-5 shrink-0",
          meta.cls.split(" ")[1], // text color
          isRunning && "animate-spin"
        )}
      />

      {/* Company Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900 dark:text-white truncate">
            {search.company?.name || "Unknown company"}
          </p>
          <span className="text-xs text-slate-400 truncate">
            {search.company?.website}
          </span>
        </div>
        {search.summary && !isRunning && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {search.summary}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-4 text-[11px] text-slate-400 shrink-0">
        <span>{search.pages_crawled} pages</span>
        <span>{search.emails_found} emails</span>
        <span>{search.profiles_found} profiles</span>
      </div>

      {/* Date */}
      <span className="text-xs text-slate-400 shrink-0">
        {search.created_at
          ? new Date(search.created_at).toLocaleDateString()
          : ""}
      </span>
    </Link>
  );
}

// =============================================================================
// Failure Hint Component
// =============================================================================
export function FailureHint({ search }: { search: Search }) {
  if (search.status !== "failed") return null;

  return (
    <div className="mt-3 flex items-start space-x-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-600 dark:text-red-300">
      <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{search.error_message || "Search failed."}</span>
    </div>
  );
}
