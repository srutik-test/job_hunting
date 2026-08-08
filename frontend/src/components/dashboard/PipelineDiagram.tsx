"use client";

import React from "react";
import {
  Globe,
  Mail,
  Search,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { LinkedInIcon } from "../ui/icons";

export default function PipelineDiagram() {
  const steps = [
    {
      num: "Step 1",
      title: "Recursive Website Crawl",
      icon: Globe,
      desc: "Discovers careers, jobs, hiring, leadership, team, and sitemap pages.",
      color:
        "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400",
    },
    {
      num: "Step 2",
      title: "Public Email Extraction",
      icon: Mail,
      desc: "Classifies emails into HR, Recruitment, Careers; filters generic info@ mailboxes.",
      color:
        "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400",
    },
    {
      num: "Step 3",
      title: "LinkedIn HR Research",
      icon: LinkedInIcon,
      desc: "Identifies publicly indexed HR Managers, Recruiters, and Talent Specialists.",
      color:
        "border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400",
    },
    {
      num: "Step 4",
      title: "Multi-Source Search",
      icon: Search,
      desc: "Cross-references company careers, public directories, and indexed metadata.",
      color:
        "border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400",
    },
    {
      num: "Step 5",
      title: "Verification & Scoring",
      icon: ShieldCheck,
      desc: "Validates DNS MX mail records and assigns traceable 0–95% confidence score.",
      color:
        "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Automated 5-Step Intelligence & Verification Pipeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-source discovery architecture ensuring 100% public, verifiable
            contact intelligence with zero guess logic.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 flex flex-col justify-between space-y-2 relative ${s.color}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    {s.num}
                  </span>
                  <Icon className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold mt-1 text-slate-900 dark:text-slate-100">
                  {s.title}
                </h4>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                {s.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
