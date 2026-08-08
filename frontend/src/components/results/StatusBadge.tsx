'use client';

import React from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, UserCheck, Briefcase, Mail, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  let color = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  let Icon = Mail;
  let label = status || 'Not Publicly Available';

  switch (status) {
    case 'Verified Public HR Email':
      color = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      Icon = CheckCircle2;
      break;
    case 'Verified Recruitment Email':
      color = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
      Icon = UserCheck;
      break;
    case 'Verified Careers Email':
      color = 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
      Icon = Briefcase;
      break;
    case 'General Contact Email':
      color = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
      Icon = Mail;
      break;
    case 'Not Publicly Available':
    default:
      color = 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      Icon = XCircle;
      label = 'Not Publicly Available';
      break;
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center space-x-1.5 rounded-md px-2.5 py-1 text-xs font-medium border shadow-xs',
        color
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
