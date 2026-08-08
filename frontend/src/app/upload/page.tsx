"use client";

import React from "react";
import Dropzone from "../../components/upload/Dropzone";
import {
  UploadCloud,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
} from "lucide-react";

export default function UploadPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
          <UploadCloud className="h-6 w-6 text-blue-600" />
          <span>Upload Company File (Excel / CSV)</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Upload your target company list to automatically discover verified
          public HR emails and LinkedIn profiles.
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <Dropzone />

      {/* Guidelines info card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <span className="font-semibold text-slate-900 dark:text-white block">
            Required Columns
          </span>
          <p>
            Company Name and Website URL are required. Location and LinkedIn
            Company URL are optional but recommended.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <span className="font-semibold text-slate-900 dark:text-white block">
            Fuzzy Header Detection
          </span>
          <p>
            Our parser automatically maps aliases like "Company",
            "Organization", "Domain", "Site", and "LinkedIn Link".
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <span className="font-semibold text-slate-900 dark:text-white block">
            Zero Guessed Emails
          </span>
          <p>
            All emails extracted are guaranteed to originate from verified
            public web pages, sitemaps, or official listings.
          </p>
        </div>
      </div>
    </div>
  );
}
