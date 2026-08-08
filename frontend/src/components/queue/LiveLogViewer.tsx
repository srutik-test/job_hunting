"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Search,
  Trash2,
  ArrowDownCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { JobLog } from "../../types";

interface LiveLogViewerProps {
  logs: JobLog[];
  onClear?: () => void;
}

export default function LiveLogViewer({ logs, onClear }: LiveLogViewerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((l) => {
    if (filterLevel !== "ALL" && l.level !== filterLevel) return false;
    if (
      searchQuery.trim() &&
      !l.message.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-200 overflow-hidden shadow-2xl font-mono text-xs">
      {/* Terminal Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 bg-slate-900/80">
        {/* Terminal Title */}
        <div className="flex items-center space-x-2.5">
          <div className="flex space-x-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <div className="flex items-center space-x-1.5 text-slate-400 font-semibold pl-2">
            <Terminal className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] uppercase tracking-wider text-slate-300">
              Live Crawl & Extraction Terminal
            </span>
            <span className="text-[10px] text-slate-500">
              ({filteredLogs.length} events)
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1.5 h-3 w-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800/80 pl-7 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
          >
            <option value="ALL">ALL</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[11px] font-medium border ${
              autoScroll
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-slate-700 bg-slate-800 text-slate-400"
            }`}
            title="Auto-scroll on new log entries"
          >
            Auto-scroll: {autoScroll ? "ON" : "OFF"}
          </button>

          {onClear && (
            <button
              onClick={onClear}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
              title="Clear terminal buffer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Log Stream Window */}
      <div
        ref={terminalRef}
        className="h-80 overflow-y-auto p-4 space-y-1 bg-slate-950 font-mono text-[11px] leading-relaxed selection:bg-blue-600 selection:text-white"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-600 italic">
            Waiting for live crawl and discovery events...
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const timeStr = log.timestamp
              ? log.timestamp.substring(11, 19)
              : "--:--:--";
            let badgeColor = "text-blue-400";
            if (log.level === "WARNING") badgeColor = "text-amber-400";
            if (log.level === "ERROR") badgeColor = "text-red-400";

            return (
              <div
                key={idx}
                className="flex items-start space-x-2.5 hover:bg-slate-900/60 px-1 py-0.5 rounded transition"
              >
                <span className="text-slate-600 select-none shrink-0">
                  {timeStr}
                </span>
                <span
                  className={`font-bold shrink-0 text-[10px] ${badgeColor}`}
                >
                  [{log.level}]
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
