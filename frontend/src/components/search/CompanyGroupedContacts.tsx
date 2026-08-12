"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Mail,
  MapPin,
  Square,
  Trash2,
  User as UserIcon,
  Workflow,
  X,
} from "lucide-react";
import { api, exportExcelUrl } from "../../lib/api";
import type { Contact } from "../../lib/types";
import {
  CategoryBadge,
  ConfidenceBar,
  VerificationBadge,
} from "./ContactBadges";
import N8nWebhookModal from "./N8nWebhookModal";
import { clsx } from "clsx";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.62 1.62 0 0 0-1.62 1.62 1.62 1.62 0 0 0 1.62 1.62 1.62 1.62 0 0 0 1.62-1.62 1.62 1.62 0 0 0-1.62-1.62Z" />
    </svg>
  );
}

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
      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
      title="Copy email to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

interface CompanyGroup {
  companyName: string;
  website?: string;
  location?: string;
  contacts: Contact[];
  stats: {
    verifiedHr: number;
    possibleHr: number;
    companyEmails: number;
    linkedin: number;
    total: number;
  };
}

export default function CompanyGroupedContacts({
  contacts,
  onRefresh,
}: {
  contacts: Contact[];
  onRefresh?: () => void;
}) {
  const [expandedCompanies, setExpandedCompanies] = useState<
    Record<string, boolean>
  >({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showN8nModal, setShowN8nModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: string[];
    title: string;
    description: string;
  } | null>(null);

  // Group contacts by company
  const companyGroups = useMemo(() => {
    const map = new Map<string, CompanyGroup>();
    for (const c of contacts) {
      const name = c.company_name || "Unknown Company";
      if (!map.has(name)) {
        map.set(name, {
          companyName: name,
          website: c.company_website,
          location: c.company_location,
          contacts: [],
          stats: {
            verifiedHr: 0,
            possibleHr: 0,
            companyEmails: 0,
            linkedin: 0,
            total: 0,
          },
        });
      }
      const group = map.get(name)!;
      group.contacts.push(c);
      group.stats.total += 1;
      if (c.contact_category === "verified_hr") group.stats.verifiedHr += 1;
      else if (c.contact_category === "possible_hr")
        group.stats.possibleHr += 1;
      else if (c.contact_category === "company_email")
        group.stats.companyEmails += 1;
      else if (c.contact_category === "linkedin") group.stats.linkedin += 1;
      if (!group.website && c.company_website)
        group.website = c.company_website;
      if (!group.location && c.company_location)
        group.location = c.company_location;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName),
    );
  }, [contacts]);

  // Initial expand: all expanded by default
  const isExpanded = (name: string) =>
    expandedCompanies[name] !== undefined ? expandedCompanies[name] : true;

  const toggleCompany = (name: string) => {
    setExpandedCompanies((prev) => ({
      ...prev,
      [name]: !isExpanded(name),
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    for (const g of companyGroups) all[g.companyName] = true;
    setExpandedCompanies(all);
  };

  const collapseAll = () => {
    const none: Record<string, boolean> = {};
    for (const g of companyGroups) none[g.companyName] = false;
    setExpandedCompanies(none);
  };

  const toggleDetails = (id: string) => {
    setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Selection handlers
  const allIds = useMemo(() => contacts.map((c) => c.id), [contacts]);
  const isAllSelected =
    contacts.length > 0 && selectedIds.size === contacts.length;
  const isSomeSelected =
    selectedIds.size > 0 && selectedIds.size < contacts.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelectContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCompanySelected = (group: CompanyGroup) => {
    return (
      group.contacts.length > 0 &&
      group.contacts.every((c) => selectedIds.has(c.id))
    );
  };

  const isCompanyPartiallySelected = (group: CompanyGroup) => {
    const count = group.contacts.filter((c) => selectedIds.has(c.id)).length;
    return count > 0 && count < group.contacts.length;
  };

  const toggleSelectCompany = (group: CompanyGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const groupContactIds = group.contacts.map((c) => c.id);
    const currentlyAllSelected = isCompanySelected(group);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (currentlyAllSelected) {
        for (const id of groupContactIds) next.delete(id);
      } else {
        for (const id of groupContactIds) next.add(id);
      }
      return next;
    });
  };

  // Delete actions
  async function executeDelete(ids: string[]) {
    setDeleting(true);
    try {
      if (ids.length === 1) {
        await api.deleteContact(ids[0]);
      } else {
        await api.bulkDeleteContacts(ids);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setConfirmDelete(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to delete contact(s).",
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleExportSelected() {
    if (selectedIds.size === 0) return;
    const url = exportExcelUrl({ contact_ids: Array.from(selectedIds) });
    window.location.href = url;
  }

  if (companyGroups.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Global Select All + Expand Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center space-x-3">
          <label className="inline-flex items-center space-x-2 cursor-pointer select-none font-bold text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = isSomeSelected;
              }}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>
              {isAllSelected
                ? "Deselect all contacts"
                : `Select all (${contacts.length})`}
            </span>
          </label>
          {selectedIds.size > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={expandAll}
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Expand all
          </button>
          <span>·</span>
          <button
            onClick={collapseAll}
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Grouped Company Cards */}
      <div className="space-y-4">
        {companyGroups.map((group) => {
          const expanded = isExpanded(group.companyName);
          const compSelected = isCompanySelected(group);
          const compPartial = isCompanyPartiallySelected(group);

          return (
            <div
              key={group.companyName}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all duration-200"
            >
              {/* Company Header */}
              <div
                onClick={() => toggleCompany(group.companyName)}
                className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 cursor-pointer select-none transition border-b border-slate-200/60 dark:border-slate-800"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Select Company Checkbox */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center"
                  >
                    <input
                      type="checkbox"
                      checked={compSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = compPartial;
                      }}
                      onChange={(e) =>
                        toggleSelectCompany(
                          group,
                          e as unknown as React.MouseEvent,
                        )
                      }
                      title="Select all contacts in this company"
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {group.companyName}
                      </h2>
                      <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {group.stats.total}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {group.website && (
                        <a
                          href={group.website}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Globe className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">
                            {group.website.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {group.location && (
                        <span className="inline-flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{group.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badge Breakdown & Toggle */}
                <div className="flex items-center space-x-3">
                  <div className="hidden sm:flex items-center space-x-1.5 text-[11px] font-semibold">
                    {group.stats.verifiedHr > 0 && (
                      <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 ring-1 ring-inset ring-emerald-500/25">
                        {group.stats.verifiedHr} Verified HR
                      </span>
                    )}
                    {group.stats.possibleHr > 0 && (
                      <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 ring-1 ring-inset ring-amber-500/25">
                        {group.stats.possibleHr} Possible HR
                      </span>
                    )}
                    {group.stats.companyEmails > 0 && (
                      <span className="rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 ring-1 ring-inset ring-slate-500/20">
                        {group.stats.companyEmails} Company
                      </span>
                    )}
                    {group.stats.linkedin > 0 && (
                      <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 ring-1 ring-inset ring-blue-500/25">
                        {group.stats.linkedin} Profile
                        {group.stats.linkedin === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400">
                    {expanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Company Contacts List */}
              {expanded && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {group.contacts.map((c) => {
                    const hasDetails = openDetails[c.id];
                    const isSelected = selectedIds.has(c.id);

                    return (
                      <div
                        key={c.id}
                        className={clsx(
                          "p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition space-y-2",
                          isSelected && "bg-blue-50/40 dark:bg-blue-950/20",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          {/* Left: Checkbox + Contact Info */}
                          <div className="flex items-start space-x-3 min-w-0 max-w-xl">
                            <div className="pt-0.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectContact(c.id)}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {c.email ? (
                                  <div className="flex items-center space-x-1.5 min-w-0">
                                    <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                                    <a
                                      href={`mailto:${c.email}`}
                                      className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate"
                                    >
                                      {c.email}
                                    </a>
                                    <CopyButton text={c.email} />
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                    <UserIcon className="h-4 w-4" />
                                    <span>{c.name || "HR Professional"}</span>
                                    <span className="text-xs text-slate-400">
                                      (No email address)
                                    </span>
                                  </div>
                                )}
                                <CategoryBadge category={c.contact_category} />
                              </div>

                              {(c.name || c.designation) && (
                                <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                                  {c.name && (
                                    <span className="font-bold">{c.name}</span>
                                  )}
                                  {c.name && c.designation && (
                                    <span className="text-slate-400">·</span>
                                  )}
                                  {c.designation && (
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                                      {c.designation}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Verification, Confidence & Single Delete */}
                          <div className="flex items-center space-x-4 shrink-0 text-xs">
                            <div className="space-y-0.5 text-right">
                              <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                                Verification
                              </span>
                              <VerificationBadge
                                status={c.verification_status}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                                Confidence
                              </span>
                              <ConfidenceBar score={c.confidence_score} />
                            </div>

                            {/* Delete single button */}
                            <button
                              onClick={() =>
                                setConfirmDelete({
                                  ids: [c.id],
                                  title: "Delete contact?",
                                  description: `Are you sure you want to delete ${
                                    c.email || c.name || "this contact"
                                  }? This cannot be undone.`,
                                })
                              }
                              className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                              title="Delete contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Provenance & Action Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400 pl-7">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="inline-flex items-center space-x-1">
                              <span className="text-slate-400">Source:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                                {c.source_type.replace(/_/g, " ")}
                                {c.provider_name ? ` · ${c.provider_name}` : ""}
                              </span>
                            </span>

                            {c.linkedin_url && (
                              <a
                                href={c.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <LinkedinIcon className="h-3.5 w-3.5" />
                                <span>LinkedIn Profile</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}

                            {c.source_url && (
                              <a
                                href={c.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 text-slate-500 hover:text-blue-500 hover:underline truncate max-w-[280px]"
                              >
                                <span>{c.source_url}</span>
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              </a>
                            )}
                          </div>

                          <button
                            onClick={() => toggleDetails(c.id)}
                            className="inline-flex items-center space-x-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition text-[11px]"
                          >
                            <Info className="h-3.5 w-3.5" />
                            <span>
                              {hasDetails ? "Hide details" : "More details"}
                            </span>
                          </button>
                        </div>

                        {/* Extended Details Drawer */}
                        {hasDetails && (
                          <div className="ml-7 mt-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-400 block text-[11px]">
                                  Discovery Method
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {c.discovery_method || "Website Crawl"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[11px]">
                                  Discovered Date
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {c.created_at
                                    ? new Date(c.created_at).toLocaleString()
                                    : "—"}
                                </span>
                              </div>
                              {c.source_url && (
                                <div className="sm:col-span-2">
                                  <span className="text-slate-400 block text-[11px]">
                                    Exact Source URL
                                  </span>
                                  <a
                                    href={c.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
                                  >
                                    {c.source_url}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Sticky Batch Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-3 rounded-2xl border border-slate-700 bg-slate-900/95 dark:bg-slate-950/95 px-5 py-3 text-white shadow-2xl backdrop-blur animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center space-x-2 border-r border-slate-700 pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold">selected</span>
          </div>

          <button
            onClick={handleExportSelected}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export selected</span>
          </button>

          <button
            onClick={() => setShowN8nModal(true)}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm"
            title="Send selected contacts to your n8n workflow on Railway"
          >
            <Workflow className="h-3.5 w-3.5" />
            <span>Send to n8n</span>
          </button>

          <button
            onClick={() =>
              setConfirmDelete({
                ids: Array.from(selectedIds),
                title: `Delete ${selectedIds.size} selected contact(s)?`,
                description: `This will permanently delete ${selectedIds.size} selected contact record(s) from your database.`,
              })
            }
            className="inline-flex items-center space-x-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete selected</span>
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            title="Deselect all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* n8n Webhook Modal */}
      {showN8nModal && (
        <N8nWebhookModal
          contacts={contacts.filter((c) => selectedIds.has(c.id))}
          onClose={() => setShowN8nModal(false)}
        />
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {confirmDelete.title}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {confirmDelete.description}
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => executeDelete(confirmDelete.ids)}
                className="inline-flex items-center space-x-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{deleting ? "Deleting…" : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
