"use client";

import React from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  getExcelExportUrl,
  getCsvExportUrl,
  getSampleExcelUrl,
  getSampleCsvUrl,
} from "../../lib/api";

export default function ExportPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
          <Download className="h-6 w-6 text-blue-600" />
          <span>Export Center & Import Templates</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Download formatted results in Excel (.xlsx) and CSV formats, or grab
          official sample import templates.
        </p>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Results Intelligence Export */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Export Discovered Results
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download all verified public HR contacts
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Includes all 14 structured columns: Company Name, Location, Website,
            LinkedIn URL, HR Email, Recruitment Email, Careers Email, General
            Email, HR Name, HR Position, LinkedIn Profile URL, Confidence Score,
            Verification Status, and Extraction Date.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={getExcelExportUrl()}
              download
              className="inline-flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-700 transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Download Excel (.xlsx)</span>
            </a>

            <a
              href={getCsvExportUrl()}
              download
              className="inline-flex items-center space-x-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Download CSV</span>
            </a>
          </div>
        </div>

        {/* Card 2: Sample Import Templates */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sample Import Templates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download formatted upload templates with examples
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Pre-formatted with the exact columns recognized by our parser
            (Company Name, Location, Website, LinkedIn URL) with pre-filled
            examples like Aspire Softserv, Simform, Bacancy Technology,
            Radixweb, and TatvaSoft.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={getSampleExcelUrl()}
              download="sample_companies_template.xlsx"
              className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Sample Excel Template (.xlsx)</span>
            </a>

            <a
              href={getSampleCsvUrl()}
              download="sample_companies_template.csv"
              className="inline-flex items-center space-x-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <FileText className="h-4 w-4 text-emerald-500" />
              <span>Sample CSV Template (.csv)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Schema / Columns Reference Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Exported Schema & Column Definitions
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All fields guaranteed strictly public and traceable
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase">
              <tr>
                <th className="px-6 py-3">Column Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Example Value</th>
                <th className="px-6 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="px-6 py-2.5 font-semibold text-slate-900 dark:text-white">
                  Company Name
                </td>
                <td className="px-6 py-2.5 font-mono text-[10px]">String</td>
                <td className="px-6 py-2.5">Aspire Softserv</td>
                <td className="px-6 py-2.5">
                  Target company organization name
                </td>
              </tr>
              <tr>
                <td className="px-6 py-2.5 font-semibold text-slate-900 dark:text-white">
                  Location
                </td>
                <td className="px-6 py-2.5 font-mono text-[10px]">String</td>
                <td className="px-6 py-2.5">Ahmedabad</td>
                <td className="px-6 py-2.5">Headquarters or branch city</td>
              </tr>
              <tr>
                <td className="px-6 py-2.5 font-semibold text-slate-900 dark:text-white">
                  Website
                </td>
                <td className="px-6 py-2.5 font-mono text-[10px]">URL</td>
                <td className="px-6 py-2.5 font-mono text-blue-500">
                  https://aspiresoftserv.com
                </td>
                <td className="px-6 py-2.5">Official company domain</td>
              </tr>
              <tr>
                <td className="px-6 py-2.5 font-semibold text-slate-900 dark:text-white">
                  HR Email
                </td>
                <td className="px-6 py-2.5 font-mono text-[10px]">Email</td>
                <td className="px-6 py-2.5 font-mono text-emerald-500">
                  hr@aspiresoftserv.com
                </td>
                <td className="px-6 py-2.5">
                  Direct public HR inbox or "Not Publicly Available"
                </td>
              </tr>
              <tr>
                <td className="px-6 py-2.5 font-semibold text-slate-900 dark:text-white">
                  Recruitment Email
                </td>
                <td className="px-6 py-2.5 font-mono text-[10px]">Email</td>
                <td className="px-6 py-2.5 font-mono text-blue-500">
                  recruitment@aspiresoftserv.com
                </td>
                <td className="px-6 py-2.5">Talent acquisition inbox</td>
              </tr>
              <tr>
                <td className="px-6 py-2.5 font-semibold text-slate-900 dark:text-white">
                  Confidence Score
                </td>
                <td className="px-6 py-2.5 font-mono text-[10px]">Integer</td>
                <td className="px-6 py-2.5">95%</td>
                <td className="px-6 py-2.5">
                  Traceable confidence metric (95%, 90%, 85%, 70%, 0%)
                </td>
              </tr>
              <tr>
                <td className="px-6 py-2.5 font-semibold text-slate-900 dark:text-white">
                  Verification Status
                </td>
                <td className="px-6 py-2.5 font-mono text-[10px]">Enum</td>
                <td className="px-6 py-2.5">Verified Public HR Email</td>
                <td className="px-6 py-2.5">
                  Official verification classification
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
