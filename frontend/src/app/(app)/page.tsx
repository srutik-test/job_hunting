"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Building2, CheckCircle2, Users, ListChecks, Mail,
  PlusCircle, SearchX, ShieldCheck, Sparkles, Table2, XCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import type { DashboardStats, Search } from "../../lib/types";
import SearchCard from "../../components/search/SearchCard";

const STATS = [
  { key: "total_companies", label: "Companies searched", Icon: Building2, tint: "text-blue-500" },
  { key: "verified_contacts", label: "Verified HR contacts", Icon: CheckCircle2, tint: "text-emerald-500" },
  { key: "possible_contacts", label: "Possible HR contacts", Icon: Mail, tint: "text-amber-500" },
  { key: "company_emails", label: "Company emails found", Icon: Table2, tint: "text-slate-500" },
  { key: "linkedin_profiles", label: "HR profiles found", Icon: Users, tint: "text-sky-500" },
  { key: "total_searches", label: "Total searches", Icon: ListChecks, tint: "text-indigo-500" },
  { key: "searches_no_results", label: "No-results searches", Icon: SearchX, tint: "text-slate-400" },
  { key: "searches_failed", label: "Failed searches", Icon: XCircle, tint: "text-red-500" },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [searches, setSearches] = useState<Search[]>([]);

  useEffect(() => {
    api.dashboard().then(setStats).catch(() => {});
    api.listSearches().then((s) => setSearches(s.slice(0, 6))).catch(() => {});
    const interval = setInterval(() => {
      api.listSearches().then((s) => setSearches(s.slice(0, 6))).catch(() => {});
      api.dashboard().then(setStats).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            <span>Evidence → Extraction → Context → Verification → Result</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Real, verified HR contacts. Never fabricated.
          </h1>
          <p className="text-sm text-blue-100 leading-relaxed">
            The platform crawls the company's own website, extracts real
            addresses only, identifies genuine HR context, and verifies every
            result. If no reliable HR email exists, you will see{" "}
            <span className="font-semibold text-white">“No verified HR contact found”</span>{" "}
            instead of a made-up address.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link href="/new-search"
              className="inline-flex items-center space-x-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-md hover:bg-slate-100 transition">
              <PlusCircle className="h-4 w-4 text-blue-600" />
              <span>Start a search</span>
            </Link>
            <Link href="/settings"
              className="inline-flex items-center space-x-2 rounded-xl bg-white/10 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20 transition">
              <ShieldCheck className="h-4 w-4" />
              <span>Configure providers</span>
            </Link>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 pointer-events-none">
          <Building2 className="h-96 w-96 text-white" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map(({ key, label, Icon, tint }) => (
          <div key={key}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <Icon className={`h-5 w-5 ${tint}`} />
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              {stats ? stats[key] : "—"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent searches</h2>
          <Link href="/searches" className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            <span>View all</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {searches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
            No searches yet.{" "}
            <Link href="/new-search" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Start your first search
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {searches.map((s) => (
              <SearchCard key={s.id} search={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
