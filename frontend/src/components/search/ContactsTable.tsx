"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  Mail,
  Phone,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
} from "lucide-react";
import type { Contact } from "../../lib/types";
import { exportExcelUrl } from "../../lib/api";
import { DEFAULT_TIMEZONE, formatDateWithTz } from "../../lib/timezones";
import {
  CategoryBadge,
  ConfidenceBar,
  VerificationBadge,
} from "./ContactBadges";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copy to clipboard"
      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function ContactCard({
  contact,
  timezone = DEFAULT_TIMEZONE,
}: {
  contact: Contact;
  timezone?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          {contact.email ? (
            <>
              <Mail className="h-4 w-4 text-blue-500 shrink-0" />
              <a
                href={`mailto:${contact.email}`}
                className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate"
              >
                {contact.email}
              </a>
              <CopyButton text={contact.email} />
            </>
          ) : (
            <span className="text-sm font-semibold text-slate-500">
              {contact.name || "HR profile"} – no email evidence
            </span>
          )}
        </div>
        <CategoryBadge category={contact.contact_category} />
      </div>

      {(contact.name || contact.designation || contact.phone) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          {contact.name && (
            <span className="font-semibold">{contact.name}</span>
          )}
          {contact.name && contact.designation && (
            <span className="text-slate-400">·</span>
          )}
          {contact.designation && <span>{contact.designation}</span>}
          {contact.phone && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Phone className="h-3 w-3" />
              <span>{contact.phone}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="flex items-center space-x-1">
          <span className="text-slate-400">Verification:</span>
          <VerificationBadge status={contact.verification_status} />
        </span>
        <span className="flex items-center space-x-2">
          <span className="text-slate-400">Confidence:</span>
          <ConfidenceBar score={contact.confidence_score} />
        </span>
        <span className="text-slate-400">
          Company:{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {contact.company_name || "—"}
          </span>
        </span>
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <Info className="h-3.5 w-3.5" />
        <span>Source & provenance</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
          <div className="flex space-x-2">
            <span className="w-28 shrink-0 text-slate-400">Source:</span>
            <span className="font-medium text-slate-700 dark:text-slate-200 capitalize">
              {contact.source_type.replace(/_/g, " ")}
              {contact.provider_name ? ` · ${contact.provider_name}` : ""}
            </span>
          </div>
          <div className="flex space-x-2">
            <span className="w-28 shrink-0 text-slate-400">Source URL:</span>
            {contact.source_url ? (
              <a
                href={contact.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                <span>{contact.source_url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </div>
          <div className="flex space-x-2">
            <span className="w-28 shrink-0 text-slate-400">Discovery:</span>
            <span className="text-slate-600 dark:text-slate-300">
              {contact.discovery_method}
            </span>
          </div>
          {contact.linkedin_url && (
            <div className="flex space-x-2">
              <span className="w-28 shrink-0 text-slate-400">LinkedIn:</span>
              <a
                href={contact.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                <span>{contact.linkedin_url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}
          <div className="flex space-x-2">
            <span className="w-28 shrink-0 text-slate-400">Found:</span>
            <span className="text-slate-600 dark:text-slate-300">
              {contact.created_at
                ? formatDateWithTz(contact.created_at, timezone)
                : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactsTable({
  contacts,
  timezone = DEFAULT_TIMEZONE,
}: {
  contacts: Contact[];
  timezone?: string;
}) {
  const hr = contacts.filter((c) => c.contact_category === "verified_hr");
  const possible = contacts.filter((c) => c.contact_category === "possible_hr");
  const companyEmails = contacts.filter(
    (c) => c.contact_category === "company_email",
  );
  const linkedin = contacts.filter((c) => c.contact_category === "linkedin");

  if (contacts.length === 0) return null;

  const sections: {
    title: string;
    shortTitle: string;
    category: string;
    entries: Contact[];
    hint?: string;
  }[] = [
    {
      title: "Verified HR Emails",
      shortTitle: "Verified HR",
      category: "verified_hr",
      entries: hr,
    },
    {
      title: "Possible HR Contacts",
      shortTitle: "Possible HR",
      category: "possible_hr",
      entries: possible,
    },
    {
      title: "Company Emails (real, but not confirmed HR)",
      shortTitle: "Company Emails",
      category: "company_email",
      entries: companyEmails,
      hint: "Generic mailboxes found on the site – use with care, they are not HR contacts.",
    },
    {
      title: "HR People Without Email Evidence",
      shortTitle: "HR Profiles",
      category: "linkedin",
      entries: linkedin,
      hint: "Identified HR/recruiting people. No email address was found for them, so none is shown – we never guess addresses.",
    },
  ];

  return (
    <div className="space-y-8">
      {sections.map(
        (s) =>
          s.entries.length > 0 && (
            <section key={s.title} className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {s.title}
                    </h3>
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {s.entries.length}
                    </span>
                  </div>
                  {s.hint && (
                    <p className="text-xs text-slate-400 mt-0.5">{s.hint}</p>
                  )}
                </div>

                <a
                  href={exportExcelUrl({
                    category: s.category,
                    contact_ids: s.entries.map((e) => e.id),
                  })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-800 shadow-sm transition cursor-pointer"
                  title={`Download ${s.title} as Excel`}
                >
                  <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Download {s.shortTitle} ({s.entries.length})</span>
                </a>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {s.entries.map((c) => (
                  <ContactCard key={c.id} contact={c} timezone={timezone} />
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}
