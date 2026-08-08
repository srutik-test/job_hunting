'use client';

import React from 'react';
import { 
  Building2, 
  MailCheck, 
  ShieldCheck, 
  Activity, 
  TrendingUp 
} from 'lucide-react';
import { LinkedInIcon } from '../ui/icons';
import { GlobalStats } from '../../types';

interface StatsCardsProps {
  stats: GlobalStats | null;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Companies Processed',
      value: stats?.total_companies_processed ?? 0,
      icon: Building2,
      color: 'from-blue-600 to-indigo-600',
      badge: 'Aggregated',
      subtitle: `${stats?.total_jobs ?? 0} batches executed`,
    },
    {
      title: 'Verified Public HR Emails',
      value: stats?.total_verified_hr_emails ?? 0,
      icon: MailCheck,
      color: 'from-emerald-600 to-teal-600',
      badge: `${stats?.overall_hr_discovery_rate ?? 0}% Rate`,
      subtitle: 'Official & MX verified',
    },
    {
      title: 'Public LinkedIn Profiles',
      value: stats?.total_linkedin_profiles ?? 0,
      icon: LinkedInIcon,
      color: 'from-indigo-600 to-violet-600',
      badge: 'Public Roles',
      subtitle: 'HR & Recruiters identified',
    },
    {
      title: 'Average Confidence Rating',
      value: `${stats?.average_confidence_score ?? 0}%`,
      icon: ShieldCheck,
      color: 'from-amber-500 to-orange-600',
      badge: 'High Integrity',
      subtitle: 'Zero fabricated emails',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{c.title}</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr ${c.color} text-white shadow-xs`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {c.value}
              </span>
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                {c.badge}
              </span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {c.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
