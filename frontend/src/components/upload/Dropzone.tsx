"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  Sparkles,
  Play,
  Settings2,
} from "lucide-react";
import {
  previewUploadFile,
  startExtractionFromFile,
  getSampleExcelUrl,
  getSampleCsvUrl,
} from "../../lib/api";
import { CompanyUploadPreview } from "../../types";

export default function Dropzone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CompanyUploadPreview | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Extraction Options
  const [crawlerEngine, setCrawlerEngine] = useState<string>("auto");
  const [enablePublicSearch, setEnablePublicSearch] = useState<boolean>(true);
  const [maxPages, setMaxPages] = useState<number>(20);
  const [concurrency, setConcurrency] = useState<number>(3);
  const [showOptions, setShowOptions] = useState<boolean>(false);

  const handleFile = async (file: File) => {
    setError(null);
    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls") &&
      !file.name.endsWith(".csv")
    ) {
      setError("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }

    setSelectedFile(file);
    setLoading(true);

    try {
      const p = await previewUploadFile(file);
      setPreview(p);
    } catch (err: any) {
      setError(err.message || "Failed to parse file.");
      setSelectedFile(null);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartExtraction = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    try {
      const res = await startExtractionFromFile(selectedFile, {
        crawler_engine: crawlerEngine,
        enable_public_search: enablePublicSearch,
        max_pages_per_company: maxPages,
        concurrency,
      });
      // Redirect to live processing screen with active job id
      router.push(`/processing?job_id=${res.job_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to start extraction.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
            : "border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-600"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-4 shadow-inner">
          <UploadCloud className="h-8 w-8" />
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {selectedFile ? selectedFile.name : "Upload Excel or CSV File"}
        </h3>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Drag and drop your spreadsheet here or click to browse. Supports
          .xlsx, .xls, and .csv with automatic column detection.
        </p>

        {/* Template download links */}
        <div
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href={getSampleExcelUrl()}
            download="sample_companies_template.xlsx"
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span>Download Sample Excel</span>
            <Download className="h-3 w-3 text-slate-400" />
          </a>

          <a
            href={getSampleCsvUrl()}
            download="sample_companies_template.csv"
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <FileText className="h-4 w-4 text-blue-500" />
            <span>Download Sample CSV</span>
            <Download className="h-3 w-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center space-x-2.5 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-950/20 p-4 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Validation and Preview Section */}
      {preview && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Validation Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                Total Parsed Rows
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {preview.total_parsed}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20 p-4">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-1">
                Valid Company Records
              </span>
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {preview.valid_count}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                Detected Columns
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {preview.detected_columns.map((c, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                Preview of Uploaded Companies (First 10 Rows)
              </h4>
              <span className="text-[11px] text-slate-500">
                Ready for automated discovery
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Company Name</th>
                    <th className="px-4 py-2.5">Location</th>
                    <th className="px-4 py-2.5">Website</th>
                    <th className="px-4 py-2.5">LinkedIn URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.preview_items.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {item.location || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                        {item.website}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-[11px] truncate max-w-[200px]">
                        {item.linkedin_url || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advanced Extraction Settings Toggle */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <div className="flex items-center space-x-2">
                <Settings2 className="h-4 w-4 text-blue-500" />
                <span>Advanced Crawler & Research Engine Settings</span>
              </div>
              <span className="text-slate-400">
                {showOptions ? "Hide" : "Configure"}
              </span>
            </button>

            {showOptions && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">
                    Crawler Preference
                  </label>
                  <select
                    value={crawlerEngine}
                    onChange={(e) => setCrawlerEngine(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs"
                  >
                    <option value="auto">
                      Auto Multi-Engine (Fast & Recursive)
                    </option>
                    <option value="crawl4ai">
                      Crawl4AI Protocol (Careers & Sitemaps)
                    </option>
                    <option value="firecrawl">Firecrawl Fallback API</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">
                    Max Pages per Company
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">
                    Worker Concurrency
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <div className="flex justify-end">
            <button
              onClick={handleStartExtraction}
              disabled={loading || preview.valid_count === 0}
              className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Start Extraction ({preview.valid_count} Companies)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
