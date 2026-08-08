"use client";

import React from "react";
import { clsx } from "clsx";
import { ShieldCheck, Check, AlertCircle, HelpCircle } from "lucide-react";

interface ConfidenceBadgeProps {
  score: number;
}

export default function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  let colorClasses =
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  let Icon = HelpCircle;

  if (score >= 95) {
    colorClasses =
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    Icon = ShieldCheck;
  } else if (score >= 85) {
    colorClasses =
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
    Icon = Check;
  } else if (score >= 70) {
    colorClasses =
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
    Icon = AlertCircle;
  } else if (score > 0) {
    colorClasses =
      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
    Icon = Check;
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border",
        colorClasses,
      )}
      title={`Confidence Score: ${score}%`}
    >
      <Icon className="h-3 w-3" />
      <span>{score}%</span>
    </span>
  );
}
