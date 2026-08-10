"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  User,
  UserCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Globe,
  ShieldCheck,
} from "lucide-react";
import type { Contact, ContactCategory } from "../../lib/types";
import { clsx } from "clsx";

// =============================================================================
// Copy Button Component
// =============================================================================
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
      title="Copy email"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

// =============================================================================
// Category Badge Component
// =============================================================================
const CATEGORY_CONFIG: Record<ContactCategory, {
  label: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
}> = {
  verified_hr: {
    label: "Verified HR Email",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-600 dark:text-emerald-400",
    icon: ShieldCheck,
  },
  possible_hr: {
    label: "Possible HR Email",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  company_email: {
    label: "Company Email",
    bgClass: "bg-slate-500/10",
    textClass: "text-slate-500 dark:text-slate-400",
    icon: Mail,
  },
  linkedin: {
    label: "HR Profile",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-600 dark:text-blue-400",
    icon: UserCircle,
  },
};

function CategoryBadge({ category }: { category: ContactCategory }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.company_email;
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        config.bgClass,
        config.textClass
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// =============================================================================
// Confidence Score Badge
// =============================================================================
function ConfidenceBadge({ score }: { score: number }) {
  const colorClass =
    score >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 75
        ? "text-emerald-500 dark:text-emerald-300"
        : score >= 50
          ? "text-amber-500 dark:text-amber-400"
          : "text-slate-400";

  return (
    <span className={clsx("text-xs font-bold tabular-nums", colorClass)}>
      {score}%
    </span>
  );
}

// =============================================================================
// Verification Badge
// =============================================================================
function VerificationBadge({ status }: { status: string }) {
  const config = {
    verified: { label: "Verified", class: "text-emerald-600" },
    partially_verified: { label: "Partial", class: "text-amber-500" },
    unverified: { label: "Unverified", class: "text-slate-400" },
  }[status] || { label: status, class: "text-slate-400" };

  return (
    <span className={clsx("text-[11px] font-medium", config.class)}>
      {config.label}
    </span>
  );
}

// =============================================================================
// Single Contact Row Component
// =============================================================================
function ContactRow({ contact }: { contact: Contact }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      {/* Main Row */}
      <div
        className={clsx(
          "flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer",
          expanded && "bg-slate-50 dark:bg-slate-800/50"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Email/Name with Icon */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {contact.email ? (
            <>
              <Mail className="h-4 w-4 text-blue-500 shrink-0" />
              <a
                href={`mailto:${contact.email}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate"
              >
                {contact.email}
              </a>
              <CopyButton text={contact.email} />
            </>
          ) : contact.name ? (
            <>
              <User className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {contact.name}
              </span>
              <span className="text-xs text-slate-400">
                — no email found
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-500">No contact info</span>
          )}
        </div>

        {/* Name & Title (if email exists) */}
        {(contact.name || contact.designation) && contact.email && (
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            {contact.name && (
              <span className="font-medium truncate max-w-[150px]">
                {contact.name}
              </span>
            )}
            {contact.designation && (
              <span className="text-slate-400 truncate max-w-[200px]">
                — {contact.designation}
              </span>
            )}
          </div>
        )}

        {/* Confidence Score */}
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceBadge score={contact.confidence_score} />
        </div>

        {/* Category Badge */}
        <CategoryBadge category={contact.contact_category} />

        {/* Expand Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
          <div className="pt-3 space-y-3">
            {/* LinkedIn Profile */}
            {contact.linkedin_url && (
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-blue-500" />
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  LinkedIn Profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Designation if not shown inline */}
            {contact.designation && !contact.email && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">Title: </span>
                {contact.designation}
              </div>
            )}

            {/* Source Information */}
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                <span className="capitalize">
                  {contact.source_type.replace(/_/g, " ")}
                  {contact.provider_name && ` via ${contact.provider_name}`}
                </span>
              </div>
              {contact.source_url && (
                <a
                  href={contact.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-500 hover:underline truncate max-w-md"
                >
                  {contact.source_url}
                </a>
              )}
            </div>

            {/* Discovery Method */}
            <div className="text-xs text-slate-400">
              <span className="text-slate-500">Discovery: </span>
              {contact.discovery_method}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Contacts Table Component
// =============================================================================
interface ContactsTableProps {
  contacts: Contact[];
  compact?: boolean;
}

export default function ContactsTable({ contacts, compact = false }: ContactsTableProps) {
  // Separate contacts by category
  const verifiedHR = contacts.filter((c) => c.contact_category === "verified_hr");
  const possibleHR = contacts.filter((c) => c.contact_category === "possible_hr");
  const companyEmails = contacts.filter((c) => c.contact_category === "company_email");
  const linkedinProfiles = contacts.filter((c) => c.contact_category === "linkedin");

  if (contacts.length === 0) return null;

  // =================================================================
  // VERIFIED HR EMAILS SECTION (Primary Results)
  // =================================================================
  const hasVerifiedHR = verifiedHR.length > 0;

  return (
    <div className="space-y-4">
      {/* Verified HR Emails - THE MAIN RESULTS */}
      {hasVerifiedHR && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                Verified HR Emails
              </h3>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                {verifiedHR.length}
              </span>
            </div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
              High-confidence HR/recruitment contacts with strong evidence
            </p>
          </div>
          <div>
            {verifiedHR.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}

      {/* Possible HR Contacts */}
      {possibleHR.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-amber-50/50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                Possible HR Contacts
              </h3>
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
                {possibleHR.length}
              </span>
            </div>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
              Contacts with partial evidence — may be HR-related but verification incomplete
            </p>
          </div>
          <div>
            {possibleHR.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}

      {/* LinkedIn Profiles Without Emails */}
      {linkedinProfiles.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">
                HR Profiles Found
              </h3>
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                {linkedinProfiles.length}
              </span>
            </div>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-0.5">
              Identified HR/recruiting professionals — no email found, we never guess
            </p>
          </div>
          <div>
            {linkedinProfiles.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}

      {/* Company Emails (collapsed by default in compact mode) */}
      {companyEmails.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Company Emails
              </h3>
              <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {companyEmails.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real company emails found — NOT HR contacts. Use with caution.
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {companyEmails.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Export helper components for use elsewhere
// =============================================================================
export { CategoryBadge, ConfidenceBadge, VerificationBadge };
