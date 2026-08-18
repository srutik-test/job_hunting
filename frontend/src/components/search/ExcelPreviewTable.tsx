"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckSquare,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Square,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { Contact } from "../../lib/types";
import { api, exportExcelUrl } from "../../lib/api";
import { DEFAULT_TIMEZONE, formatDateWithTz } from "../../lib/timezones";
import {
  CategoryBadge,
  ConfidenceBar,
  VerificationBadge,
} from "./ContactBadges";
import { clsx } from "clsx";

interface ExcelPreviewTableProps {
  contacts: Contact[];
  timezone?: string;
  onRefresh?: () => void;
}

export default function ExcelPreviewTable({
  contacts,
  timezone = DEFAULT_TIMEZONE,
  onRefresh,
}: ExcelPreviewTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: string[];
    title: string;
    description: string;
  } | null>(null);

  // Get unique list of companies
  const companyList = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) {
      if (c.company_name) set.add(c.company_name);
    }
    return Array.from(set).sort();
  }, [contacts]);

  // Filter contacts by internal search / company filter
  const filteredContacts = useMemo(() => {
    let list = [...contacts];

    if (selectedCompanyFilter) {
      list = list.filter((c) => c.company_name === selectedCompanyFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => {
        const comp = (c.company_name || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const site = (c.company_website || "").toLowerCase();
        const loc = (c.company_location || "").toLowerCase();
        const name = (c.name || "").toLowerCase();
        const des = (c.designation || "").toLowerCase();
        return (
          comp.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          site.includes(q) ||
          loc.includes(q) ||
          name.includes(q) ||
          des.includes(q)
        );
      });
    }

    return list;
  }, [contacts, selectedCompanyFilter, searchQuery]);

  // Selection handlers
  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.has(c.id));

  const someFilteredSelected =
    filteredContacts.some((c) => selectedIds.has(c.id)) && !allFilteredSelected;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Unselect all filtered
      const next = new Set(selectedIds);
      filteredContacts.forEach((c) => next.delete(c.id));
      setSelectedIds(next);
    } else {
      // Select all filtered
      const next = new Set(selectedIds);
      filteredContacts.forEach((c) => next.add(c.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectContact = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAllForCompany = (compName: string) => {
    const next = new Set(selectedIds);
    contacts
      .filter((c) => c.company_name === compName)
      .forEach((c) => next.add(c.id));
    setSelectedIds(next);
  };

  // Copy helpers
  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copySelectedEmails = () => {
    const emails = contacts
      .filter((c) => selectedIds.has(c.id) && c.email)
      .map((c) => c.email!)
      .join(", ");
    if (emails) {
      navigator.clipboard.writeText(emails).catch(() => {});
      alert(`Copied ${selectedIds.size} email address(es) to clipboard!`);
    }
  };

  // Delete handlers
  const executeDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.ids.length === 1) {
        await api.deleteContact(confirmDelete.ids[0]);
      } else {
        await api.bulkDeleteContacts(confirmDelete.ids);
      }
      // Remove deleted ids from selection
      const next = new Set(selectedIds);
      confirmDelete.ids.forEach((id) => next.delete(id));
      setSelectedIds(next);
      setConfirmDelete(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to delete contacts: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Excel Preview Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Excel Export Preview & Manipulation
              </h2>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Live Spreadsheet View
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Exact workbook format (`.xlsx`) with selective row export and deletion.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {selectedIds.size > 0 && (
            <>
              <button
                type="button"
                onClick={copySelectedEmails}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-sm"
              >
                <Copy className="h-3.5 w-3.5 text-blue-500" />
                <span>Copy Emails ({selectedIds.size})</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setConfirmDelete({
                    ids: Array.from(selectedIds),
                    title: `Delete ${selectedIds.size} Selected Contact(s)`,
                    description: `Are you sure you want to permanently delete ${selectedIds.size} selected contact(s)? This action cannot be undone.`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition cursor-pointer shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            </>
          )}

          <a
            href={exportExcelUrl(
              selectedIds.size > 0
                ? { contact_ids: Array.from(selectedIds) }
                : {
                    company_name: selectedCompanyFilter || undefined,
                    q: searchQuery || undefined,
                  }
            )}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition shadow-sm cursor-pointer ml-auto md:ml-0"
          >
            <Download className="h-4 w-4" />
            <span>
              {selectedIds.size > 0
                ? `Download Selected (${selectedIds.size})`
                : `Download Excel (${filteredContacts.length})`}
            </span>
          </a>
        </div>
      </div>

      {/* Filter and Selection bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* In-table search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter preview rows by any field..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-7 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Select by Company */}
          {companyList.length > 1 && (
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">All Companies ({companyList.length})</option>
              {companyList.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selection count and quick actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
          >
            {allFilteredSelected ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : someFilteredSelected ? (
              <div className="h-4 w-4 rounded border-2 border-blue-600 bg-blue-600/20 flex items-center justify-center">
                <span className="h-1.5 w-1.5 bg-blue-600 rounded-sm" />
              </div>
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
            <span>
              {allFilteredSelected
                ? "Deselect All"
                : `Select All (${filteredContacts.length})`}
            </span>
          </button>

          {selectedIds.size > 0 && (
            <span className="rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 text-[11px] border border-blue-200 dark:border-blue-800">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {/* Excel Header with column coordinates */}
            <thead>
              {/* Coordinate indicator row (A, B, C, D...) */}
              <tr className="bg-slate-100 dark:bg-slate-950 text-[10px] font-mono text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="w-10 text-center py-1 px-2 border-r border-slate-200 dark:border-slate-800">
                  {/* Checkbox col */}
                </th>
                <th className="w-12 text-center py-1 px-2 border-r border-slate-200 dark:border-slate-800">
                  #
                </th>
                <th className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 font-bold">
                  COL A
                </th>
                <th className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 font-bold">
                  COL B
                </th>
                <th className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 font-bold">
                  COL C
                </th>
                <th className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 font-bold">
                  COL D
                </th>
                <th className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 font-bold">
                  COL E
                </th>
                <th className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 font-bold">
                  COL F
                </th>
                <th className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 font-bold">
                  EXTRA
                </th>
                <th className="w-20 text-center py-1 px-2 font-bold">
                  ACTION
                </th>
              </tr>

              {/* Real Excel Column Title Row */}
              <tr className="bg-[#1E3A8A] text-white font-bold text-xs uppercase tracking-wider">
                <th className="text-center py-2.5 px-2 border-r border-blue-900/60">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-white/40 text-blue-600 focus:ring-blue-400 cursor-pointer"
                  />
                </th>
                <th className="text-center py-2.5 px-2 border-r border-blue-900/60 font-mono text-[11px]">
                  Row
                </th>
                <th className="py-2.5 px-3 border-r border-blue-900/60 min-w-[180px]">
                  Company Name
                </th>
                <th className="py-2.5 px-3 border-r border-blue-900/60 min-w-[200px]">
                  HR Mails
                </th>
                <th className="py-2.5 px-3 border-r border-blue-900/60 min-w-[140px]">
                  Phone Number
                </th>
                <th className="py-2.5 px-3 border-r border-blue-900/60 min-w-[160px]">
                  Status & Score
                </th>
                <th className="py-2.5 px-3 border-r border-blue-900/60 min-w-[160px]">
                  LinkedIn URL
                </th>
                <th className="py-2.5 px-3 border-r border-blue-900/60 min-w-[130px]">
                  Location
                </th>
                <th className="py-2.5 px-3 border-r border-blue-900/60 min-w-[180px]">
                  Company Website
                </th>
                <th className="text-center py-2.5 px-2 min-w-[70px]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-12 text-slate-400 italic"
                  >
                    No contacts match the current preview filter.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((c, idx) => {
                  const isSelected = selectedIds.has(c.id);

                  return (
                    <tr
                      key={c.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.closest("button") ||
                          target.closest("a") ||
                          target.closest("input")
                        ) {
                          return;
                        }
                        toggleSelectContact(c.id);
                      }}
                      className={clsx(
                        "hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition group font-sans cursor-pointer select-none",
                        isSelected && "bg-blue-50/80 dark:bg-blue-950/30",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="text-center py-2.5 px-2 border-r border-slate-100 dark:border-slate-800">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectContact(c.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Row Index */}
                      <td className="text-center py-2.5 px-2 border-r border-slate-100 dark:border-slate-800 font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Company Name (Col A) */}
                      <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{c.company_name || "—"}</span>
                        </div>
                      </td>

                      {/* HR Mails (Col B) */}
                      <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 font-mono text-xs">
                        {c.email ? (
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <a
                                href={`mailto:${c.email}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold truncate"
                              >
                                {c.email}
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyText(c.email!, c.id)}
                              title="Copy email"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer shrink-0"
                            >
                              {copiedId === c.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">
                            No email evidence
                          </span>
                        )}
                        {(c.name || c.designation) && (
                          <div className="text-[11px] text-slate-500 font-sans mt-0.5 truncate">
                            {c.name} {c.designation && `· ${c.designation}`}
                          </div>
                        )}
                      </td>

                      {/* Phone Number (Col C) */}
                      <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 font-mono text-xs">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                            <Phone className="h-3 w-3" />
                            <span>{c.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status & Score (Col D - Swapped with Company Website) */}
                      <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <CategoryBadge category={c.contact_category} />
                            <VerificationBadge status={c.verification_status} />
                          </div>
                          {c.confidence_score > 0 && (
                            <ConfidenceBar score={c.confidence_score} />
                          )}
                          {c.created_at && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {formatDateWithTz(c.created_at, timezone, false)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* LinkedIn URL (Col E) */}
                      <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800">
                        {c.linkedin_url ? (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline truncate max-w-[150px]"
                          >
                            <span className="truncate">{c.linkedin_url}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Location (Col F) */}
                      <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                        {c.company_location ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{c.company_location}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Company Website (EXTRA - Moved here) */}
                      <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800">
                        {c.company_website ? (
                          <a
                            href={c.company_website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[170px]"
                          >
                            <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{c.company_website}</span>
                            <ExternalLink className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Row Action (Delete single contact) */}
                      <td className="text-center py-2.5 px-2">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              ids: [c.id],
                              title: "Delete Contact",
                              description: `Are you sure you want to delete ${
                                c.email || c.name || "this contact"
                              } (${c.company_name})?`,
                            })
                          }
                          title="Delete contact"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Statistics */}
        <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Displaying {filteredContacts.length} rows (Workbook matches export contract)
          </span>
          <span>{selectedIds.size} rows selected for export / deletion</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {confirmDelete.title}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {confirmDelete.description}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={deleting}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>{deleting ? "Deleting…" : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
