'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  UploadCloud, 
  PenTool, 
  Table2, 
  Activity, 
  ArrowRight, 
  Building2, 
  Mail, 
  ShieldCheck, 
  FileSpreadsheet,
  Download,
  Sparkles
} from 'lucide-react';
import StatsCards from '../components/dashboard/StatsCards';
import PipelineDiagram from '../components/dashboard/PipelineDiagram';
import { fetchStats, fetchResults, getSampleExcelUrl } from '../lib/api';
import { GlobalStats, ExtractionResult } from '../types';
import ConfidenceBadge from '../components/results/ConfidenceBadge';
import StatusBadge from '../components/results/StatusBadge';

export default function DashboardPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [recentResults, setRecentResults] = useState<ExtractionResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      try {
        const [s, r] = await Promise.all([
          fetchStats().catch(() => null),
          fetchResults({ page_size: 5 }).catch(() => ({ items: [], total: 0 })),
        ]);
        if (s) setStats(s);
        if (r && r.items) setRecentResults(r.items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner / Welcome */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            <span>Public HR & Talent Acquisition Discovery Platform</span>
          </div>
          
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Discover Verified Public HR & Recruitment Contacts
          </h1>
          
          <p className="text-sm text-blue-100 leading-relaxed">
            Recursively crawls target company websites, extracts public career/recruitment mailboxes, locates publicly indexed HR LinkedIn profiles, and verifies every result with DNS MX records.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-md hover:bg-slate-100 transition"
            >
              <UploadCloud className="h-4 w-4 text-blue-600" />
              <span>Upload Company Excel / CSV</span>
            </Link>

            <Link
              href="/manual"
              className="inline-flex items-center space-x-2 rounded-xl bg-white/10 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20 transition"
            >
              <PenTool className="h-4 w-4" />
              <span>Enter Manually</span>
            </Link>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 pointer-events-none">
          <Building2 className="h-96 w-96 text-white" />
        </div>
      </div>

      {/* Global Stats Cards */}
      <StatsCards stats={stats} />

      {/* Pipeline Visualizer */}
      <PipelineDiagram />

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <Link
          href="/upload"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs hover:border-blue-500 hover:shadow-lg transition duration-150"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
            Batch Excel & CSV Upload
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Upload custom company files with automatic column detection and interactive preview.
          </p>
        </Link>

        <Link
          href="/manual"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs hover:border-indigo-500 hover:shadow-lg transition duration-150"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
            <PenTool className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition">
            Manual Single & Bulk Entry
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Directly input company names, headquarters, and websites using the live spreadsheet editor.
          </p>
        </Link>

        <Link
          href="/results"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs hover:border-emerald-500 hover:shadow-lg transition duration-150"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
            <Table2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
            Verified Results Intelligence
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            View, sort, filter, and export verified HR emails and LinkedIn profiles to Excel and CSV.
          </p>
        </Link>

      </div>

      {/* Recent Extraction Discoveries Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recently Discovered HR Contacts
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified public contacts from company websites and public indices
            </p>
          </div>

          <Link
            href="/results"
            className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>View All Results</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase">
              <tr>
                <th className="px-6 py-3.5">Company</th>
                <th className="px-6 py-3.5">HR / Recruitment Email</th>
                <th className="px-6 py-3.5">HR Representative</th>
                <th className="px-6 py-3.5">Confidence</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentResults.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No extractions run yet. Start by uploading an Excel/CSV file or manually entering a company.
                  </td>
                </tr>
              ) : (
                recentResults.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                      {r.company_name}
                    </td>
                    <td className="px-6 py-3 font-mono font-medium text-emerald-700 dark:text-emerald-400">
                      {r.hr_email !== 'Not Publicly Available' ? r.hr_email : r.recruitment_email}
                    </td>
                    <td className="px-6 py-3">
                      {r.hr_name !== 'Not Publicly Available' ? (
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{r.hr_name}</span>
                          <span className="text-[10px] text-slate-400 block">{r.hr_position}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Not Publicly Available</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <ConfidenceBadge score={r.confidence_score} />
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
