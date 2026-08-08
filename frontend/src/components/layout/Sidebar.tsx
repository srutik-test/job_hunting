"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  PenTool,
  Activity,
  Table2,
  Download,
  FileText,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Upload Excel / CSV",
    href: "/upload",
    icon: UploadCloud,
    badge: "Batch",
  },
  {
    name: "Manual Entry",
    href: "/manual",
    icon: PenTool,
    badge: null,
  },
  {
    name: "Processing Queue",
    href: "/processing",
    icon: Activity,
    badge: "Live",
  },
  {
    name: "Results Intelligence",
    href: "/results",
    icon: Table2,
    badge: null,
  },
  {
    name: "Export & Templates",
    href: "/export",
    icon: Download,
    badge: null,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 min-h-[calc(100vh-4rem)] hidden md:block">
      <div className="flex flex-col h-full p-4 space-y-6">
        {/* Navigation links */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60",
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={clsx(
                      "h-4 w-4",
                      isActive
                        ? "text-white"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      isActive
                        ? "bg-white/20 text-white"
                        : item.badge === "Live"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Ethical Standards Card */}
        <div className="mt-auto rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-semibold mb-1.5">
            <ShieldCheck className="h-4 w-4" />
            <span>Ethical Public Data</span>
          </div>
          <p className="leading-relaxed">
            Extracts only 100% verified publicly available contacts. Zero login
            bypass or guessed email generation.
          </p>
        </div>
      </div>
    </aside>
  );
}
