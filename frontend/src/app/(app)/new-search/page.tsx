"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  UploadCloud,
} from "lucide-react";
import { api } from "../../../lib/api";
import { sampleTemplateUrl } from "../../../lib/api";

export default function NewSearchPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"single" | "upload">("single");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [industry, setIndustry] = useState("");
  const [bulk, setBulk] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function runSingle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const searches = await api.startSearch([
        {
          name,
          website,
          location,
          linkedin_url: linkedin,
          industry,
        },
      ]);
      router.push(`/searches/${searches[0].id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start search.");
      setBusy(false);
    }
  }

  async function runUpload(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Choose an .xlsx or .csv file first.");
      return;
    }
    setBusy(true);
    try {
      await api.uploadSearch(file);
      router.push("/searches");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setBusy(false);
    }
  }

  async function runBulk(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const companies = bulk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[;,]/).map((p) => p.trim());
        return {
          name: parts[0] || "",
          website: parts[1] || "",
          location: parts[2] || "",
        };
      })
      .filter((c) => c.name && c.website);
    if (companies.length === 0) {
      setError(
        "Enter at least one line like: Company Name, https://company.com[, Location]",
      );
      return;
    }
    setBusy(true);
    try {
      await api.startSearch(companies.slice(0, 50));
      router.push("/searches");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start searches.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          New search
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The platform will crawl the official website first (
          {`contact / careers / team / people / HR pages`}), extract real emails
          only, classify HR context, and verify before showing results.
        </p>
      </div>

      <div className="flex space-x-2">
        {(["single", "upload"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === t
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {t === "single"
              ? "Single company / bulk paste"
              : "Excel / CSV upload"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {tab === "single" ? (
        <div className="space-y-6">
          <form
            onSubmit={runSingle}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span>Single company</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Company name *
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Software"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Website *
                </label>
                <input
                  required
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://acme-software.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Location
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ahmedabad"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  LinkedIn URL
                </label>
                <input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://linkedin.com/company/acme"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Industry
                </label>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="IT Services"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              <span>{busy ? "Starting…" : "Run discovery"}</span>
            </button>
          </form>

          <form
            onSubmit={runBulk}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-3"
          >
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Bulk paste (up to 50)
            </div>
            <p className="text-xs text-slate-400">
              One per line:{" "}
              <code className="text-blue-500">
                Company Name, https://website.com, Location
              </code>
            </p>
            <textarea
              rows={5}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                "Acme Software, https://acme-software.com, Ahmedabad\nBeta Consulting, https://beta.io, Berlin"
              }
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              <span>Run bulk searches</span>
            </button>
          </form>
        </div>
      ) : (
        <form
          onSubmit={runUpload}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span>Batch upload</span>
            </div>
            <a
              href={sampleTemplateUrl()}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Download template
            </a>
          </div>
          <p className="text-xs text-slate-400">
            Required columns:{" "}
            <code className="text-blue-500">Company Name</code> and{" "}
            <code className="text-blue-500">Website</code>. Optional: Location,
            LinkedIn URL, Industry.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-8 text-center hover:border-blue-400 transition"
          >
            <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {file ? file.name : "Click to select .xlsx or .csv"}
            </p>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            <span>{busy ? "Uploading…" : "Start searches"}</span>
          </button>
        </form>
      )}

      <p className="text-xs text-slate-400">
        After starting, you can watch live progress on{" "}
        <Link
          href="/searches"
          className="text-blue-500 font-semibold hover:underline"
        >
          Searches
        </Link>
        .
      </p>
    </div>
  );
}
