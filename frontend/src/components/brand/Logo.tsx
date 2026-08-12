"use client";

import React from "react";
import Link from "next/link";
import { clsx } from "clsx";

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="logo-grad-primary"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id="logo-grad-accent"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="#2563EB"
            floodOpacity="0.3"
          />
        </filter>
      </defs>

      {/* Rounded Hexagon / Shield Base */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill="url(#logo-grad-primary)"
        filter="url(#logo-glow)"
      />

      {/* Modern Inner Outreach Mail & Radar Grid */}
      <path
        d="M10 14.5C10 13.12 11.12 12 12.5 12H27.5C28.88 12 30 13.12 30 14.5V25.5C30 26.88 28.88 28 27.5 28H12.5C11.12 28 10 26.88 10 25.5V14.5Z"
        fill="#FFFFFF"
        fillOpacity="0.15"
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 13L20 20.5L29.5 13"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Verification Checkmark Pill / Sparkle */}
      <circle
        cx="28"
        cy="27"
        r="5"
        fill="url(#logo-grad-accent)"
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />
      <path
        d="M26 27L27.5 28.5L30.5 25.5"
        stroke="#FFFFFF"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({
  href = "/",
  size = "md",
  showText = true,
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}) {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const content = (
    <div
      className={clsx(
        "inline-flex items-center space-x-2.5 select-none",
        className,
      )}
    >
      <LogoIcon className={iconSizes[size]} />
      {showText && (
        <div className="flex flex-col">
          <span
            className={clsx(
              "font-extrabold tracking-tight text-slate-900 dark:text-white leading-none",
              textSizes[size],
            )}
          >
            Hunt<span className="text-blue-600 dark:text-blue-400">Reach</span>
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
            HR Contact Intelligence
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-95 transition">
        {content}
      </Link>
    );
  }

  return content;
}
