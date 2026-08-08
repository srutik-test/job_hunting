"use client";

import React from "react";
import {
  Building2,
  Globe,
  Layers,
  Mail,
  UserCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Play,
} from "lucide-react";
import { JobProgress } from "../../types";

interface LiveProgressBarProps {
  progress: JobProgress | null;
  onCancel?: () => void;
}

export default function LiveProgressBar({
  progress,
  onCancel,
}: LiveProgressBarProps) {
  if (!progress) return null;

  const pct = Math.min(100, Math.max(0, progress.progress_percentage || 0));
  const isRunning = progress.status === "running";
  const isCompleted = progress.status === "completed";
  const isCancelled = progress.status === "cancelled";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
      {/* Top Header Status & ETA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shadow-lg ${
              isCompleted
                ? "bg-emerald-500 shadow-emerald-500/25"
                : isCancelled
                  ? "bg-red-500 shadow-red-500/25"
                  : "bg-blue-600 shadow-blue-500/25 animate-pulse"
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isCancelled ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 fill-white" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isCompleted
                  ? "Public Extraction Pipeline Completed"
                  : isCancelled
                    ? "Extraction Run Cancelled"
                    : "Multi-Source Contact Discovery in Progress"}
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                  isCompleted
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : isCancelled
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}
              >
                {progress.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Job ID: <span className="font-mono">{progress.id}</span>
            </p>
          </div>
        </div>

        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
          >
            Cancel Pipeline Run
          </button>
        )}
      </div>

      {/* Progress Bar & Percentage */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>
            Processing {progress.processed_companies} of{" "}
            {progress.total_companies} Companies
          </span>
          <span>{pct}%</span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        {/* Current Company */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <Building2 className="h-3.5 w-3.5 text-blue-500" />
            <span>Active Target</span>
          </div>
          <p className="font-semibold text-slate-900 dark:text-white truncate">
            {progress.current_company_name || "Standby"}
          </p>
        </div>

        {/* Current URL being crawled */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <Globe className="h-3.5 w-3.5 text-emerald-500" />
            <span>Pages Crawled</span>
          </div>
          <p className="font-bold text-slate-900 dark:text-white">
            {progress.pages_crawled_count} pages
          </p>
        </div>

        {/* Verified Emails */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <Mail className="h-3.5 w-3.5 text-indigo-500" />
            <span>HR Contacts Found</span>
          </div>
          <p className="font-bold text-slate-900 dark:text-white">
            {progress.emails_found_count} contacts
          </p>
        </div>

        {/* Estimated Time Remaining */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>Est. Remaining Time</span>
          </div>
          <p className="font-bold text-slate-900 dark:text-white">
            {isCompleted
              ? "0s (Finished)"
              : `${progress.estimated_remaining_seconds || 0}s`}
          </p>
        </div>
      </div>
    </div>
  );
}
