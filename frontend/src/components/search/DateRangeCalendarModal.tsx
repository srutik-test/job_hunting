"use client";

import React, { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import { clsx } from "clsx";

export interface DateTimeRange {
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:mm
}

interface DateRangeCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: DateTimeRange | null;
  onChange: (range: DateTimeRange | null) => void;
  // ISO date strings of all available contacts/searches to calculate activity dates
  activityDates?: (string | null | undefined)[];
}

export default function DateRangeCalendarModal({
  isOpen,
  onClose,
  value,
  onChange,
  activityDates = [],
}: DateRangeCalendarModalProps) {
  // Current viewing month and year in the calendar
  const today = new Date();
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Internal draft state
  const [startDate, setStartDate] = useState<string>(value?.startDate || "");
  const [startTime, setStartTime] = useState<string>(
    value?.startTime || "00:00",
  );
  const [endDate, setEndDate] = useState<string>(value?.endDate || "");
  const [endTime, setEndTime] = useState<string>(value?.endTime || "23:59");

  // Map of activity dates (YYYY-MM-DD -> count)
  const activityDateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of activityDates) {
      if (!d) continue;
      try {
        const dateObj = new Date(d);
        if (!isNaN(dateObj.getTime())) {
          // Format as YYYY-MM-DD in local time
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, "0");
          const day = String(dateObj.getDate()).padStart(2, "0");
          const key = `${y}-${m}-${day}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      } catch {
        // ignore invalid date
      }
    }
    return map;
  }, [activityDates]);

  if (!isOpen) return null;

  // Calendar calculations
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDateClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      // Start a new range
      setStartDate(dateStr);
      setEndDate("");
    } else if (startDate && !endDate) {
      if (dateStr < startDate) {
        // Swapped range
        setEndDate(startDate);
        setStartDate(dateStr);
      } else {
        setEndDate(dateStr);
      }
    }
  };

  const handleApply = () => {
    if (!startDate) {
      onChange(null);
    } else {
      onChange({
        startDate,
        startTime: startTime || "00:00",
        endDate: endDate || startDate,
        endTime: endTime || "23:59",
      });
    }
    onClose();
  };

  const handleClear = () => {
    setStartDate("");
    setEndDate("");
    setStartTime("00:00");
    setEndTime("23:59");
    onChange(null);
    onClose();
  };

  // Quick Presets
  const applyPreset = (preset: "today" | "yesterday" | "7days" | "30days" | "thisMonth") => {
    const now = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (preset === "today") {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "yesterday") {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatYMD(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "7days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(now));
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "30days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(now));
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "thisMonth") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYMD(first));
      setEndDate(formatYMD(now));
      setStartTime("00:00");
      setEndTime("23:59");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Filter by Date & Time Range
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Green highlighted dates indicate search activity & discovered contacts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset("today")}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset("yesterday")}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => applyPreset("7days")}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset("30days")}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset("thisMonth")}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            This Month
          </button>
        </div>

        {/* Main Content Grid: Calendar on Left, Time Pickers on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Calendar Section */}
          <div className="md:col-span-7 space-y-3">
            {/* Month & Year Navigator */}
            <div className="flex items-center justify-between px-1">
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {monthNames[viewMonth]} {viewYear}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 uppercase py-1 border-b border-slate-100 dark:border-slate-800">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty leading days */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9" />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const mStr = String(viewMonth + 1).padStart(2, "0");
                const dStr = String(dayNum).padStart(2, "0");
                const fullDate = `${viewYear}-${mStr}-${dStr}`;

                const activityCount = activityDateMap.get(fullDate) || 0;
                const hasActivity = activityCount > 0;

                const isStart = startDate === fullDate;
                const isEnd = endDate === fullDate;
                const isInRange =
                  startDate && endDate && fullDate >= startDate && fullDate <= endDate;

                return (
                  <button
                    key={fullDate}
                    type="button"
                    onClick={() => handleDateClick(fullDate)}
                    title={
                      hasActivity
                        ? `${activityCount} contact/search activity on ${fullDate}`
                        : fullDate
                    }
                    className={clsx(
                      "h-9 rounded-xl flex flex-col items-center justify-center text-xs font-semibold relative transition cursor-pointer group",
                      // Selected Start / End
                      isStart || isEnd
                        ? "bg-blue-600 text-white font-bold shadow-md z-10"
                        : isInRange
                        ? "bg-blue-100/70 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 rounded-none first:rounded-l-xl last:rounded-r-xl"
                        : // Activity highlight (Light Green)
                        hasActivity
                        ? "bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/80 dark:border-emerald-700/60 hover:bg-emerald-200 dark:hover:bg-emerald-900"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                    )}
                  >
                    <span>{dayNum}</span>
                    {/* Activity indicator dot */}
                    {hasActivity && !isStart && !isEnd && (
                      <span className="h-1 w-1 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 border border-emerald-400 dark:border-emerald-700 inline-block" />
                <span>Search / Contact Activity</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-blue-600 inline-block" />
                <span>Selected Range</span>
              </div>
            </div>
          </div>

          {/* Time and Range Inputs on Right */}
          <div className="md:col-span-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 md:pl-6 pt-4 md:pt-0 space-y-4">
            <div className="space-y-4">
              {/* Start Date & Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <span>Start Date & Time</span>
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="col-span-7 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="col-span-5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  <span>End Date & Time</span>
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    value={endDate || startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="col-span-7 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="col-span-5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Current Selection summary */}
              {startDate && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Active Interval
                  </span>
                  <div className="font-mono text-slate-700 dark:text-slate-200">
                    <span>{startDate} {startTime}</span>
                    <span className="text-slate-400 mx-1.5">→</span>
                    <span>{endDate || startDate} {endTime}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
              >
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply Filter</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
