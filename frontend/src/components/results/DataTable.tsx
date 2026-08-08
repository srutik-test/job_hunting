'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  Check, 
  ExternalLink, 
  FileSpreadsheet, 
  Download, 
  SlidersHorizontal, 
  Eye, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Info,
  Trash2
} from 'lucide-react';
import { ExtractionResult, ResultListResponse } from '../../types';
import { fetchResults, deleteResult, getExcelExportUrl, getCsvExportUrl } from '../../lib/api';
import ConfidenceBadge from './ConfidenceBadge';
import StatusBadge from './StatusBadge';
import DetailModal from './DetailModal';

const ALL_COLUMNS = [
  { key: 'company_name', label: 'Company', defaultVisible: true },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'website', label: 'Website', defaultVisible: true },
  { key: 'linkedin_url', label: 'LinkedIn', defaultVisible: false },
  { key: 'hr_email', label: 'HR Email', defaultVisible: true },
  { key: 'recruitment_email', label: 'Recruitment Email', defaultVisible: true },
  { key: 'careers_email', label: 'Careers Email', defaultVisible: false },
  { key: 'general_email', label: 'General Email', defaultVisible: false },
  { key: 'hr_name', label: 'HR Name', defaultVisible: true },
  { key: 'hr_position', label: 'HR Position', defaultVisible: true },
  { key: 'linkedin_profile', label: 'LinkedIn Profile', defaultVisible: true },
  { key: 'confidence_score', label: 'Confidence', defaultVisible: true },
  { key: 'source', label: 'Source', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
];

export default function DataTable() {
  const [data, setData] = useState<ResultListResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    total_pages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [minConfidence, setMinConfidence] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((c) => (init[c.key] = c.defaultVisible));
    return init;
  });
  const [showColMenu, setShowColMenu] = useState<boolean>(false);

  // Copy feedback toast
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Detail Modal
  const [selectedResult, setSelectedResult] = useState<ExtractionResult | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchResults({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        min_confidence: minConfidence,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      });
      setData(res);
    } catch (e) {
      console.error('Error fetching results:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, statusFilter, minConfidence, sortBy, sortOrder, page, pageSize]);

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  const copyToClipboard = (text: string, keyId: string) => {
    if (!text || text === 'Not Publicly Available') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this result?')) return;
    try {
      await deleteResult(id);
      loadData();
    } catch (err) {
      alert('Failed to delete item');
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Top Filter and Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search company, domain, email, recruiter..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Verification Statuses</option>
            <option value="Verified Public HR Email">Verified Public HR Email</option>
            <option value="Verified Recruitment Email">Verified Recruitment Email</option>
            <option value="Verified Careers Email">Verified Careers Email</option>
            <option value="General Contact Email">General Contact Email</option>
            <option value="Not Publicly Available">Not Publicly Available</option>
          </select>

          {/* Min Confidence */}
          <select
            value={minConfidence === undefined ? 'all' : minConfidence}
            onChange={(e) => {
              const val = e.target.value === 'all' ? undefined : Number(e.target.value);
              setMinConfidence(val);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Confidence Scores</option>
            <option value="90">90%+ (Official HR Verified)</option>
            <option value="85">85%+ (Recruitment / Careers)</option>
            <option value="70">70%+ (Public Contacts)</option>
          </select>

          {/* Column Visibility Button */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Columns</span>
            </button>

            {showColMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl z-30 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Toggle Columns
                </p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none py-0.5">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key] ?? true}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <a
            href={getExcelExportUrl(undefined, statusFilter, minConfidence)}
            download
            className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </a>

          <a
            href={getCsvExportUrl(undefined, statusFilter)}
            download
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </a>

        </div>

      </div>

      {/* Main Results Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-collapse">
          
          {/* Header */}
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider select-none">
            <tr>
              {ALL_COLUMNS.filter((col) => visibleColumns[col.key]).map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    {sortBy === col.key ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-500" /> : <ArrowDown className="h-3 w-3 text-blue-500" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-50" />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
            {loading ? (
              <tr>
                <td colSpan={ALL_COLUMNS.length + 1} className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                  <span>Loading public contact intelligence...</span>
                </td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={ALL_COLUMNS.length + 1} className="py-12 text-center text-slate-400">
                  No company records found matching your filters.
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedResult(row)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition"
                >
                  
                  {/* Company Name */}
                  {visibleColumns['company_name'] && (
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {row.company_name}
                    </td>
                  )}

                  {/* Location */}
                  {visibleColumns['location'] && (
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {row.location || '—'}
                    </td>
                  )}

                  {/* Website */}
                  {visibleColumns['website'] && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <a
                        href={row.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1 font-mono text-[11px]"
                      >
                        <span className="truncate max-w-[140px]">{row.website.replace('https://', '').replace('http://', '')}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                  )}

                  {/* LinkedIn */}
                  {visibleColumns['linkedin_url'] && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.linkedin_url ? (
                        <a
                          href={row.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1 text-[11px]"
                        >
                          <span>Company Page</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}

                  {/* HR Email */}
                  {visibleColumns['hr_email'] && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.hr_email !== 'Not Publicly Available' ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                            {row.hr_email}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(row.hr_email, `${row.id}-hr`);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Copy HR email"
                          >
                            {copiedKey === `${row.id}-hr` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not Publicly Available</span>
                      )}
                    </td>
                  )}

                  {/* Recruitment Email */}
                  {visibleColumns['recruitment_email'] && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.recruitment_email !== 'Not Publicly Available' ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-500/20">
                            {row.recruitment_email}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(row.recruitment_email, `${row.id}-rec`);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Copy recruitment email"
                          >
                            {copiedKey === `${row.id}-rec` ? <Check className="h-3.5 w-3.5 text-blue-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not Publicly Available</span>
                      )}
                    </td>
                  )}

                  {/* Careers Email */}
                  {visibleColumns['careers_email'] && (
                    <td className="px-4 py-3 whitespace-nowrap font-mono">
                      {row.careers_email}
                    </td>
                  )}

                  {/* General Email */}
                  {visibleColumns['general_email'] && (
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500">
                      {row.general_email}
                    </td>
                  )}

                  {/* HR Name */}
                  {visibleColumns['hr_name'] && (
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      {row.hr_name !== 'Not Publicly Available' ? row.hr_name : <span className="text-slate-400">Not Publicly Available</span>}
                    </td>
                  )}

                  {/* HR Position */}
                  {visibleColumns['hr_position'] && (
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {row.hr_position !== 'Not Publicly Available' ? row.hr_position : <span className="text-slate-400">Not Publicly Available</span>}
                    </td>
                  )}

                  {/* LinkedIn Profile */}
                  {visibleColumns['linkedin_profile'] && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.linkedin_profile !== 'Not Publicly Available' ? (
                        <a
                          href={row.linkedin_profile}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1"
                        >
                          <span className="truncate max-w-[130px] font-mono text-[11px]">
                            {row.linkedin_profile.replace('https://www.linkedin.com/in/', 'in/')}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not Publicly Available</span>
                      )}
                    </td>
                  )}

                  {/* Confidence Score */}
                  {visibleColumns['confidence_score'] && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ConfidenceBadge score={row.confidence_score} />
                    </td>
                  )}

                  {/* Source */}
                  {visibleColumns['source'] && (
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400 max-w-[160px] truncate" title={row.source}>
                      {row.source}
                    </td>
                  )}

                  {/* Status */}
                  {visibleColumns['status'] && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>
                  )}

                  {/* Actions */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedResult(row);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition"
                        title="View Full Diagnostics"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(row.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition"
                        title="Delete Result"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
        <div>
          Showing {data.items.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(page * pageSize, data.total)} of {data.total} companies
        </div>

        <div className="flex items-center space-x-3">
          
          <div className="flex items-center space-x-1.5">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-medium">
              Page {page} of {data.total_pages || 1}
            </span>
            <button
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Full Audit Detail Modal */}
      <DetailModal result={selectedResult} onClose={() => setSelectedResult(null)} />

    </div>
  );
}
