'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Play, Sparkles, AlertCircle, Building2, Globe, MapPin } from 'lucide-react';
import { LinkedInIcon } from '../ui/icons';
import { CompanyInput } from '../../types';
import { startManualExtraction } from '../../lib/api';

const DEFAULT_SAMPLE_COMPANIES: CompanyInput[] = [
  {
    name: 'Aspire Softserv',
    location: 'Ahmedabad',
    website: 'https://aspiresoftserv.com',
    linkedin_url: 'https://linkedin.com/company/aspire-softserv',
  },
  {
    name: 'Simform',
    location: 'Ahmedabad',
    website: 'https://simform.com',
    linkedin_url: 'https://linkedin.com/company/simform',
  },
  {
    name: 'Bacancy Technology',
    location: 'Ahmedabad',
    website: 'https://bacancytechnology.com',
    linkedin_url: 'https://linkedin.com/company/bacancy-technology',
  },
  {
    name: 'Radixweb',
    location: 'Ahmedabad',
    website: 'https://radixweb.com',
    linkedin_url: 'https://linkedin.com/company/radixweb',
  },
  {
    name: 'TatvaSoft',
    location: 'Ahmedabad',
    website: 'https://tatvasoft.com',
    linkedin_url: 'https://linkedin.com/company/tatvasoft',
  },
];

export default function ManualEntryGrid() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyInput[]>([
    { name: '', location: '', website: '', linkedin_url: '' },
  ]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => {
    setCompanies([...companies, { name: '', location: '', website: '', linkedin_url: '' }]);
  };

  const removeRow = (index: number) => {
    if (companies.length <= 1) {
      setCompanies([{ name: '', location: '', website: '', linkedin_url: '' }]);
      return;
    }
    setCompanies(companies.filter((_, i) => i !== index));
  };

  const updateCell = (index: number, field: keyof CompanyInput, value: string) => {
    const next = [...companies];
    next[index][field] = value;
    setCompanies(next);
  };

  const loadSamples = () => {
    setCompanies(DEFAULT_SAMPLE_COMPANIES);
  };

  const handleStart = async () => {
    setError(null);
    const valid = companies.filter((c) => c.name.trim() && c.website.trim());
    if (valid.length === 0) {
      setError('Please enter at least one company with a Name and Website.');
      return;
    }

    setLoading(true);
    try {
      const res = await startManualExtraction(valid, {
        crawler_engine: 'auto',
        enable_public_search: true,
        max_pages_per_company: 20,
      });
      router.push(`/processing?job_id=${res.job_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start extraction.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Manual Company Entry</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter one or more target companies directly into the data entry grid.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadSamples}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
          >
            <Sparkles className="h-4 w-4" />
            <span>Load Sample Companies</span>
          </button>

          <button
            onClick={addRow}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2.5 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-950/20 p-4 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Spreadsheet Input Grid */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase">
            <tr>
              <th className="px-4 py-3.5 w-12 text-center">#</th>
              <th className="px-4 py-3.5">
                <div className="flex items-center space-x-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  <span>Company Name *</span>
                </div>
              </th>
              <th className="px-4 py-3.5">
                <div className="flex items-center space-x-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-500" />
                  <span>Location</span>
                </div>
              </th>
              <th className="px-4 py-3.5">
                <div className="flex items-center space-x-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Website URL *</span>
                </div>
              </th>
              <th className="px-4 py-3.5">
                <div className="flex items-center space-x-1.5">
                  <LinkedInIcon className="h-3.5 w-3.5 text-indigo-500" />
                  <span>LinkedIn URL (Optional)</span>
                </div>
              </th>
              <th className="px-4 py-3.5 w-16 text-center">Delete</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {companies.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 text-center font-mono text-slate-400">
                  {idx + 1}
                </td>
                
                {/* Company Name */}
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    placeholder="e.g. Aspire Softserv"
                    value={row.name}
                    onChange={(e) => updateCell(idx, 'name', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                {/* Location */}
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    placeholder="e.g. Ahmedabad"
                    value={row.location || ''}
                    onChange={(e) => updateCell(idx, 'location', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                {/* Website */}
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    placeholder="https://aspiresoftserv.com"
                    value={row.website}
                    onChange={(e) => updateCell(idx, 'website', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono text-blue-600 dark:text-blue-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                {/* LinkedIn */}
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    placeholder="https://linkedin.com/company/aspire-softserv"
                    value={row.linkedin_url || ''}
                    onChange={(e) => updateCell(idx, 'linkedin_url', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                {/* Delete */}
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => removeRow(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>

              </tr>
            ))}
          </tbody>

        </table>
      </div>

      {/* Bottom Launch Button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {companies.filter((c) => c.name.trim() && c.website.trim()).length} of {companies.length} rows ready
        </span>

        <button
          onClick={handleStart}
          disabled={loading || companies.filter((c) => c.name.trim() && c.website.trim()).length === 0}
          className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Launch HR Extraction</span>
        </button>
      </div>

    </div>
  );
}
