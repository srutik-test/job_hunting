"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { LogoIcon } from "../brand/Logo";

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex justify-center">
          <LogoIcon className="h-14 w-14" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        {children}
      </div>

      <p className="flex items-center justify-center space-x-1.5 text-xs text-slate-400 dark:text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>Evidence-first results – no generated or guessed emails.</span>
      </p>
    </div>
  );
}
