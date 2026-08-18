"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Provider, ProviderTestResult } from "../../lib/types";

const STATUS_ICON: Record<string, React.ReactNode> = {
  connected: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  missing_key: <XCircle className="h-4 w-4 text-slate-400" />,
  not_tested: <Plug className="h-4 w-4 text-slate-400" />,
};

export default function ProviderCard({
  provider,
  onSaved,
}: {
  provider: Provider;
  onSaved: (p: Provider) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider.enabled);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const needsKey = !provider.is_free;

  async function save() {
    setSaving(true);
    setTestResult(null);
    try {
      const payload: Record<string, unknown> = { enabled };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const updated = await api.saveProvider(provider.provider_key, payload);
      setApiKey("");
      onSaved(updated);
    } catch (err) {
      setTestResult({
        ok: false,
        provider_key: provider.provider_key,
        latency_ms: 0,
        message: err instanceof Error ? err.message : "Save failed",
        details: {},
      });
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    setSaving(true);
    try {
      const updated = await api.saveProvider(provider.provider_key, {
        api_key: "CLEAR",
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      // Test the key from the input if the user just typed one; otherwise the
      // stored / env-configured key is used.
      const result = await api.testProvider(
        provider.provider_key,
        apiKey.trim() || undefined,
      );
      setTestResult(result);
      if (result.ok || !result.ok) onSaved(provider); // refresh status timestamp
    } catch (err) {
      setTestResult({
        ok: false,
        provider_key: provider.provider_key,
        latency_ms: 0,
        message: err instanceof Error ? err.message : "Test failed",
        details: {},
      });
    } finally {
      setTesting(false);
    }
  }

  const status = testResult
    ? testResult.ok
      ? "connected"
      : "failed"
    : provider.status;
  const message = testResult ? testResult.message : provider.status_detail;
  const canTest = !needsKey || provider.has_api_key || apiKey.trim().length > 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {provider.display_name}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {provider.is_free ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                FREE
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                PAID / API key required
              </span>
            )}
            {provider.signup_url && (
              <a
                href={provider.signup_url}
                target="_blank"
                rel="noreferrer"
                className="ml-2 inline-flex items-center space-x-0.5 text-blue-500 hover:underline"
              >
                <span>Get a key</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-1.5">
          {STATUS_ICON[status] || STATUS_ICON.not_tested}
          <span
            className={clsx(
              "text-[11px] font-bold capitalize",
              status === "connected"
                ? "text-emerald-500"
                : status === "failed"
                  ? "text-red-500"
                  : "text-slate-400",
            )}
          >
            {status.replace("_", " ")}
          </span>
        </div>
      </div>

      {needsKey && (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider.has_api_key
                  ? `Stored key ${provider.api_key_masked || ""} (type to replace)`
                  : "Paste API key…"
              }
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
            />
            {provider.has_api_key && !provider.configured_via_env && (
              <button
                onClick={clearKey}
                disabled={saving}
                title="Remove stored key"
                className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-400 hover:text-red-500 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {provider.configured_via_env && !provider.has_api_key && (
            <p className="text-[11px] text-slate-400">
              Key configured via server environment variable.
            </p>
          )}
          {provider.configured_via_env && provider.has_api_key && (
            <p className="text-[11px] text-slate-400">
              Using key stored in-app (overrides the server env key).
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className="group flex items-center gap-3 focus:outline-none cursor-pointer"
        >
          <div
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled
                ? "bg-emerald-500 shadow-sm shadow-emerald-500/20"
                : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
          <div className="flex flex-col text-left">
            <span
              className={`text-xs font-semibold ${
                enabled
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {enabled ? "Channel Enabled" : "Channel Disabled"}
            </span>
            <span className="text-[10px] text-slate-400">
              {enabled ? "Active in pipeline" : "Inactive in pipeline"}
            </span>
          </div>
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={test}
            disabled={testing || !canTest}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="h-3.5 w-3.5" />
            )}
            <span>Test Connection</span>
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={clsx(
            "rounded-lg px-3 py-2 text-xs",
            status === "connected"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              : status === "failed"
                ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300"
                : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400",
          )}
        >
          {status === "connected" ? "✓ " : status === "failed" ? "✕ " : ""}
          {message}
          {testResult?.latency_ms ? ` (${testResult.latency_ms} ms)` : ""}
          {testResult?.details &&
            Object.keys(testResult.details).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 opacity-80">
                {Object.entries(testResult.details).map(([k, v]) => (
                  <span key={k}>
                    <span className="font-semibold">
                      {k.replace(/_/g, " ")}:
                    </span>{" "}
                    {String(v)}
                  </span>
                ))}
              </div>
            )}
          {provider.last_tested_at && !testResult && (
            <span className="ml-2 opacity-70">
              (last tested {new Date(provider.last_tested_at).toLocaleString()})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
