"use client";

import React from "react";
import { CATEGORY_LABELS, Contact } from "../../lib/types";
import { clsx } from "clsx";

const CATEGORY_STYLES: Record<string, string> = {
  verified_hr:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  possible_hr:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  company_email:
    "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20",
  linkedin: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/25",
};

const VERIFICATION_STYLES: Record<string, string> = {
  verified: "text-emerald-600 dark:text-emerald-400",
  partially_verified: "text-amber-600 dark:text-amber-400",
  unverified: "text-slate-500 dark:text-slate-400",
};

const VERIFICATION_LABELS: Record<string, string> = {
  verified: "Verified",
  partially_verified: "Partially verified",
  unverified: "Unverified",
};

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        CATEGORY_STYLES[category] || CATEGORY_STYLES.company_email,
      )}
    >
      {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}
    </span>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx("text-xs font-semibold", VERIFICATION_STYLES[status])}
    >
      {VERIFICATION_LABELS[status] || status}
    </span>
  );
}

export function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 90
      ? "bg-emerald-500"
      : score >= 70
        ? "bg-amber-500"
        : "bg-slate-400";
  return (
    <div className="flex items-center space-x-2 min-w-[90px]">
      <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={clsx("h-full rounded-full", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
        {score}%
      </span>
    </div>
  );
}
