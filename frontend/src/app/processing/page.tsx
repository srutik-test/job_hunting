'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Activity, 
  ArrowRight, 
  RefreshCw, 
  Table2, 
  AlertCircle, 
  CheckCircle2,
  Play
} from 'lucide-react';
import LiveProgressBar from '../../components/queue/LiveProgressBar';
import LiveLogViewer from '../../components/queue/LiveLogViewer';
import { fetchJobProgress, fetchJobLogs, cancelJob, fetchStats } from '../../lib/api';
import { JobProgress, JobLog } from '../../types';

function ProcessingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialJobId = searchParams.get('job_id');

  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // If no job_id in URL, try to discover active job from stats
  useEffect(() => {
    async function findActive() {
      if (!activeJobId) {
        try {
          const stats = await fetchStats();
          if (stats.active_job_id) {
            setActiveJobId(stats.active_job_id);
          }
        } catch (e) {
          // ignore
        }
      }
    }
    findActive();
  }, [activeJobId]);

  // Polling loop for progress and logs
  useEffect(() => {
    if (!activeJobId) {
      setLoading(false);
      return;
    }

    let intervalId: any;
    let isCancelled = false;

    async function poll() {
      try {
        const [prog, logData] = await Promise.all([
          fetchJobProgress(activeJobId!),
          fetchJobLogs(activeJobId!),
        ]);

        if (!isCancelled) {
          setProgress(prog);
          setLogs(logData.logs || []);
          setError(null);
          setLoading(false);

          if (prog.status === 'completed' || prog.status === 'failed' || prog.status === 'cancelled') {
            clearInterval(intervalId);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Error polling job progress');
          setLoading(false);
        }
      }
    }

    poll();
    intervalId = setInterval(poll, 1500);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [activeJobId]);

  const handleCancel = async () => {
    if (!activeJobId) return;
    try {
      await cancelJob(activeJobId);
      const updated = await fetchJobProgress(activeJobId);
      setProgress(updated);
    } catch (e: any) {
      alert(e.message || 'Failed to cancel job');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Activity className="h-6 w-6 text-blue-600 animate-pulse" />
            <span>Live Extraction & Verification Queue</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Real-time multi-threaded crawl progress, subpage navigation, and DNS MX verification trace.
          </p>
        </div>

        {progress?.status === 'completed' && (
          <Link
            href="/results"
            className="inline-flex items-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 transition"
          >
            <Table2 className="h-4 w-4" />
            <span>View Verified Results</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-2.5 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-950/20 p-4 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
          <p className="text-sm font-medium">Connecting to live extraction queue...</p>
        </div>
      ) : !activeJobId || !progress ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 mx-auto">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Active Extraction Running</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Upload a company list or manually enter companies to start discovering verified public HR contacts.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-700"
            >
              <span>Upload Excel / CSV</span>
            </Link>
            <Link
              href="/manual"
              className="inline-flex items-center space-x-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <span>Enter Manually</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Live Progress Bar Card */}
          <LiveProgressBar progress={progress} onCancel={handleCancel} />

          {/* Live Log Terminal Stream */}
          <LiveLogViewer logs={logs} onClear={() => setLogs([])} />
        </div>
      )}

    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading live queue...</div>}>
      <ProcessingContent />
    </Suspense>
  );
}
