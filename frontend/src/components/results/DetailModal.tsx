"use client";

import React from "react";
import {
  X,
  Globe,
  Mail,
  User,
  ShieldCheck,
  Check,
  Layers,
  ExternalLink,
  Calendar,
  Info,
} from "lucide-react";
import { LinkedInIcon } from "../ui/icons";
import { ExtractionResult } from "../../types";
import ConfidenceBadge from "./ConfidenceBadge";
import StatusBadge from "./StatusBadge";

interface DetailModalProps {
  result: ExtractionResult | null;
  onClose: () => void;
}

export default function DetailModal({ result, onClose }: DetailModalProps) {
  if (!result) return null;

  const raw: any = result.raw_details || {};
  const verification: any = raw.verification || {};
  const allEmails: any[] = verification.all_emails_discovered || [];
  const allProfiles: any[] = verification.all_profiles_discovered || [];
  const crawledPages: any[] = verification.pages_summary || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
              {result.company_name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>{result.company_name}</span>
                {result.location && (
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    ({result.location})
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comprehensive Public Contact Audit & Verification Trace
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Top Verification Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20">
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Status
              </span>
              <StatusBadge status={result.status} />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Confidence Score
              </span>
              <ConfidenceBadge score={result.confidence_score} />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Primary Public Source
              </span>
              <span
                className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate block"
                title={result.source}
              >
                {result.source}
              </span>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Discovered Public Emails */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/30">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <span>Extracted Public Email Contacts</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">HR Specific Email:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {result.hr_email}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Recruitment Email:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {result.recruitment_email}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Careers Email:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {result.careers_email}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">General Email:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {result.general_email}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Public HR & Recruiter Profiles */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/30">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <User className="h-4 w-4 text-indigo-500" />
                <span>Discovered HR & Recruiter Profiles</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">HR Representative:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {result.hr_name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Position / Job Title:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {result.hr_position}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Public LinkedIn:</span>
                  {result.linkedin_profile !== "Not Publicly Available" ? (
                    <a
                      href={result.linkedin_profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1"
                    >
                      <span className="truncate max-w-[200px]">
                        {result.linkedin_profile}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-slate-400">
                      Not Publicly Available
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Discovered Emails Audit List */}
          {allEmails.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                All Categorized Public Email Mailboxes ({allEmails.length})
              </h4>
              <div className="space-y-2">
                {allEmails.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {item.email}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                        {item.category}
                      </span>
                    </div>
                    <span
                      className="text-slate-400 text-[11px] truncate max-w-[250px]"
                      title={item.source_url}
                    >
                      {item.source_url}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crawled Web Pages Diagnostics */}
          {crawledPages.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Discovered Website Subpages ({crawledPages.length})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                {crawledPages.map((page: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/80"
                  >
                    <div className="flex items-center space-x-2 truncate max-w-[450px]">
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">
                        {page.type}
                      </span>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-700 dark:text-slate-300 hover:text-blue-600 truncate"
                      >
                        {page.url}
                      </a>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {page.emails_found?.length || 0} emails found
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 dark:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
