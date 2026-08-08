"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  KeyRound, Loader2, MailCheck, ShieldCheck, User as UserIcon,
} from "lucide-react";
import { api } from "../../../lib/api";
import type { Provider } from "../../../lib/types";
import { CAPABILITY_LABELS } from "../../../lib/types";
import ProviderCard from "../../../components/settings/ProviderCard";
import { useAuth } from "../../../contexts/AuthContext";

const CAPABILITY_ORDER = [
  "crawler", "search", "email_finder", "email_verifier", "people",
] as const;

function AccountTab() {
  const { user, refresh } = useAuth();
  const [msg, setMsg] = useState<{ message: string; devLink?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function resend() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.resendVerification();
      setMsg({ message: res.message, devLink: res.dev_link || undefined });
    } catch (err) {
      setMsg({ message: err instanceof Error ? err.message : "Failed to resend." });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-3">
          {user.profile_picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profile_picture} alt="avatar" className="h-12 w-12 rounded-full" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600">
              <UserIcon className="h-6 w-6" />
            </div>
          )}
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
            <dt className="text-xs text-slate-400">Auth provider</dt>
            <dd className="font-semibold capitalize">{user.auth_provider}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
            <dt className="text-xs text-slate-400">Account status</dt>
            <dd className="font-semibold capitalize">{user.account_status}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
            <dt className="text-xs text-slate-400">Email verified</dt>
            <dd className="font-semibold">{user.is_email_verified ? "Yes" : "No"}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
            <dt className="text-xs text-slate-400">Member since</dt>
            <dd className="font-semibold">
              {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
            </dd>
          </div>
        </dl>

        {!user.is_email_verified && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <MailCheck className="inline h-4 w-4 mr-1" />
              Your email is not verified. Searches stay disabled until you verify.
            </p>
            <button onClick={resend} disabled={busy}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-50">
              {busy ? "Sending…" : "Resend verification email"}
            </button>
          </div>
        )}
        {msg && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-3 text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>{msg.message}</p>
            {msg.devLink && (
              <a href={msg.devLink} className="block text-xs text-blue-500 underline break-all">
                {msg.devLink}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Data isolation</span>
        </h3>
        <p>
          All searches, companies, contacts and provider keys belong to your
          account only. Other users cannot read or modify them (enforced on
          every request by the API).
        </p>
      </div>
    </div>
  );
}

function ProvidersTab() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setProviders(await api.listProviders());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateOne(updated: Provider) {
    setProviders((prev) =>
      prev.map((p) => (p.provider_key === updated.provider_key ? { ...p, ...updated } : p)),
    );
    // also refresh silently to pick up new status timestamps
    api.listProviders().then(setProviders).catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-4 text-xs text-blue-700 dark:text-blue-300">
        <KeyRound className="inline h-3.5 w-3.5 mr-1" />
        API keys are stored encrypted and are never included in API responses or
        frontend code. You can also provide keys as server environment variables
        (see <code>.env.example</code>); keys saved here take precedence.
      </div>
      {CAPABILITY_ORDER.map((cap) => {
        const entries = providers.filter((p) => p.capability === cap);
        if (entries.length === 0) return null;
        return (
          <section key={cap} className="space-y-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {CAPABILITY_LABELS[cap]}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {entries.map((p) => (
                <ProviderCard key={p.provider_key} provider={p} onSaved={updateOne} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"providers" | "account">("providers");
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your account and the providers used during discovery.
        </p>
      </div>

      <div className="flex space-x-2">
        {(["providers", "account"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition capitalize ${
              tab === t
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}>
            {t === "providers" ? "API Providers" : "Account"}
          </button>
        ))}
      </div>

      {tab === "providers" ? <ProvidersTab /> : <AccountTab />}
    </div>
  );
}
