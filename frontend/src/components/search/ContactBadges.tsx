"use client";

import React from "react";
import { CATEGORY_LABELS, Contact, ContactCategory } from "../../lib/types";
import { clsx } from "clsx";
import {
  ShieldCheck,
  AlertTriangle,
  Mail,
  UserCircle,
} from "lucide-react";

<<<<<<< HEAD
const CATEGORY_STYLES: Record<string, string> = {
  verified_hr:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  possible_hr:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  company_email:
    "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20",
  linkedin: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/25",
=======
// =============================================================================
// Category Badge Component
// =============================================================================
const CATEGORY_STYLES: Record<string, { bg: string; icon: React.ElementType }> = {
  verified_hr: {
    bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: ShieldCheck,
  },
  possible_hr: {
    bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  company_email: {
    bg: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
    icon: Mail,
  },
  linkedin: {
    bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: UserCircle,
  },
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
};

export function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_STYLES[category] || CATEGORY_STYLES.company_email;
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ring-transparent",
        config.bg
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}
    </span>
  );
}

// =============================================================================
// Verification Badge Component
// =============================================================================
const VERIFICATION_STYLES: Record<string, string> = {
  verified: "text-emerald-600 dark:text-emerald-400",
  partially_verified: "text-amber-600 dark:text-amber-400",
  unverified: "text-slate-500 dark:text-slate-400",
};

const VERIFICATION_LABELS: Record<string, string> = {
  verified: "Verified",
  partially_verified: "Partial",
  unverified: "Unverified",
};

export function VerificationBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx("text-xs font-semibold", VERIFICATION_STYLES[status])}
    >
      {VERIFICATION_LABELS[status] || status}
    </span>
  );
}

// =============================================================================
// Confidence Bar Component
// =============================================================================
export function ConfidenceBar({ score }: { score: number }) {
<<<<<<< HEAD
  const color =
    score >= 90
      ? "bg-emerald-500"
      : score >= 70
        ? "bg-amber-500"
        : "bg-slate-400";
=======
  const colorClass =
    score >= 90
      ? "bg-emerald-500"
      : score >= 75
        ? "bg-emerald-400"
        : score >= 50
          ? "bg-amber-500"
          : "bg-slate-400";

>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
<<<<<<< HEAD
          className={clsx("h-full rounded-full", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
=======
          className={clsx("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${Math.max(score, 5)}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
        {score}%
      </span>
    </div>
  );
}

// =============================================================================
// Confidence Badge (compact version)
// =============================================================================
export function ConfidenceBadge({ score }: { score: number }) {
  const colorClass =
    score >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 75
        ? "text-emerald-500 dark:text-emerald-300"
        : score >= 50
          ? "text-amber-500 dark:text-amber-400"
          : "text-slate-400";

  return (
    <span className={clsx("text-xs font-bold tabular-nums", colorClass)}>
      {score}%
    </span>
  );
}
