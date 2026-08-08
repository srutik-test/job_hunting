"use client";

import React from "react";
import DataTable from "../../components/results/DataTable";
import { Table2, ShieldCheck, Download, Sparkles } from "lucide-react";
import { getExcelExportUrl, getCsvExportUrl } from "../../lib/api";

export default function ResultsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Table2 className="h-6 w-6 text-emerald-600" />
            <span>Verified Public HR Contacts Intelligence</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Interactive multi-source intelligence table with confidence scoring,
            MX verification statuses, and instant exports.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href={getExcelExportUrl()}
            download
            className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-700 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Excel (.xlsx)</span>
          </a>

          <a
            href={getCsvExportUrl()}
            download
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </a>
        </div>
      </div>

      {/* Main TanStack-style Results Table */}
      <DataTable />
    </div>
  );
}
