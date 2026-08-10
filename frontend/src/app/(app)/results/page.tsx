"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { api, exportExcelUrl } from "../../../lib/api";
import type { Contact } from "../../../lib/types";
import ContactsTable from "../../../components/search/ContactsTable";
import { CATEGORY_LABELS } from "../../../lib/types";

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "verified_hr", label: CATEGORY_LABELS.verified_hr },
  { value: "possible_hr", label: CATEGORY_LABELS.possible_hr },
  { value: "company_email", label: CATEGORY_LABELS.company_email },
  { value: "linkedin", label: CATEGORY_LABELS.linkedin },
];

const VERIFICATION_OPTIONS = [
  { value: "", label: "Any verification" },
  { value: "verified", label: "Verified" },
  { value: "partially_verified", label: "Partially verified" },
  { value: "unverified", label: "Unverified" },
];

export default function ResultsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [verification, setVerification] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listContacts({
        q,
        category,
        verification_status: verification,
      });
      setContacts(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [q, category, verification]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          All contacts
        </h1>
        {contacts.length > 0 && (
          <a
            href={exportExcelUrl()}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            <Download className="h-4 w-4" />
            <span>Export to Excel</span>
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, name or email…"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={verification}
          onChange={(e) => setVerification(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          {VERIFICATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center text-sm text-slate-500">
          No contacts match your filters.
        </div>
      ) : (
        <ContactsTable contacts={contacts} />
      )}
    </div>
  );
}
