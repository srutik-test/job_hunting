'use client';

import React from 'react';
import ManualEntryGrid from '../../components/manual/ManualEntryGrid';
import { PenTool, ShieldCheck } from 'lucide-react';

export default function ManualPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
          <PenTool className="h-6 w-6 text-indigo-600" />
          <span>Manual Company Entry</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Enter company information directly into the grid or use pre-filled sample companies to launch the pipeline immediately.
        </p>
      </div>

      <ManualEntryGrid />

    </div>
  );
}
