"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Send,
  Workflow,
  X,
} from "lucide-react";
import type { Contact } from "../../lib/types";
import { api } from "../../lib/api";

export default function N8nWebhookModal({
  contacts,
  onClose,
  onSuccess,
}: {
  contacts: Contact[];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("n8n_webhook_url");
    if (saved) setWebhookUrl(saved);
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const trimmed = webhookUrl.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setError("Please enter a valid HTTP or HTTPS webhook URL.");
      return;
    }
    localStorage.setItem("n8n_webhook_url", trimmed);

    setBusy(true);
    try {
      const res = await api.sendToN8nWebhook(trimmed, contacts);
      setSuccessMsg(
        res.message || `Dispatched ${contacts.length} contacts to n8n!`,
      );
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to dispatch payload to n8n webhook.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 dark:bg-blue-400/10">
              <Workflow className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Send to n8n Outreach Workflow
              </h3>
              <p className="text-xs text-slate-500">
                Trigger your Railway n8n automated email sequence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selected contacts preview badge */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-2 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
            <span>Payload Summary</span>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400 font-bold">
              {contacts.length} Contact{contacts.length === 1 ? "" : "s"}{" "}
              Selected
            </span>
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {contacts.slice(0, 5).map((c) => (
              <div key={c.id} className="truncate flex items-center space-x-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {c.company_name}
                </span>
                <span>·</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {c.email || c.name || "HR Profile"}
                </span>
                {c.designation && (
                  <span className="text-slate-400">({c.designation})</span>
                )}
              </div>
            ))}
            {contacts.length > 5 && (
              <p className="italic text-slate-400">
                + {contacts.length - 5} more contact(s)…
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              n8n Webhook URL (Railway / Self-Hosted)
            </label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://n8n-production-xxxx.up.railway.app/webhook/hr-outreach"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              The webhook URL will be saved locally in your browser for 1-click
              future dispatches.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{busy ? "Dispatching…" : "Dispatch to n8n"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
