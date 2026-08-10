"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import type { CaptchaChallenge } from "../../lib/types";

export interface CaptchaValue {
  captcha_id?: string;
  captcha_answer?: string;
  captcha_token?: string;
}

interface Props {
  value: CaptchaValue;
  onChange: (v: CaptchaValue) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  }
}

const WIDGET_SCRIPTS: Record<string, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js",
  recaptcha: "https://www.google.com/recaptcha/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
};

const WIDGET_CLASSES: Record<string, string> = {
  turnstile: "cf-turnstile",
  recaptcha: "g-recaptcha",
  hcaptcha: "h-captcha",
};

export default function CaptchaChallenge({ value, onChange }: Props) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [error, setError] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const c = await api.fetchCaptcha();
      setChallenge(c);
      if (c.provider === "dev-math") {
        onChange({ captcha_id: c.captcha_id || undefined });
      }
    } catch {
      setError("Could not load captcha. Retry shortly.");
    }
  }, [onChange]);

  useEffect(() => {
    load();
  }, [load]);

  // Third-party widget rendering (Turnstile / reCAPTCHA / hCaptcha).
  useEffect(() => {
    if (!challenge) return;

    const provider = challenge.provider ?? "none";
    if (provider === "dev-math" || provider === "none") return;
    if (!challenge.site_key || renderedRef.current) return;

    const script = document.createElement("script");
    script.src = WIDGET_SCRIPTS[provider];
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!widgetRef.current || renderedRef.current) return;
      const opts = {
        sitekey: challenge.site_key,
        callback: (token: string) => onChange({ captcha_token: token }),
      };
      if (provider === "turnstile" && window.turnstile) {
        window.turnstile.render(widgetRef.current, opts);
      } else if (provider === "recaptcha" && window.grecaptcha) {
        window.grecaptcha.render(widgetRef.current, opts);
      } else if (provider === "hcaptcha" && window.hcaptcha) {
        window.hcaptcha.render(widgetRef.current, opts);
      }
      renderedRef.current = true;
    };
    document.body.appendChild(script);
  }, [challenge, onChange]);

  if (!challenge) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-500 dark:text-slate-400">
        {error || "Loading security check…"}
      </div>
    );
  }

  const provider = challenge.provider ?? "none";

  if (provider === "none" || challenge.enabled === false) return null;

  if (provider === "dev-math") {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Security check
            </span>
          </div>
          <button
            type="button"
            onClick={load}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="New question"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          {challenge.question}
        </p>
        <input
          type="text"
          inputMode="numeric"
          required
          value={value.captcha_answer || ""}
          onChange={(e) =>
            onChange({
              captcha_id: value.captcha_id,
              captcha_answer: e.target.value,
            })
          }
          placeholder="Your answer"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 capitalize">
          {provider} verification
        </span>
      </div>
      <div ref={widgetRef} className={WIDGET_CLASSES[provider]} />
      {!challenge.site_key && (
        <p className="text-xs text-amber-500">
          No site key configured on the server for {provider}.
        </p>
      )}
    </div>
  );
}
