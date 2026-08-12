"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  MailCheck,
  Save,
  Send,
  ShieldCheck,
  User as UserIcon,
  Workflow,
  X,
} from "lucide-react";
import { api } from "../../../lib/api";
import type { Provider } from "../../../lib/types";
import { CAPABILITY_LABELS } from "../../../lib/types";
import ProviderCard from "../../../components/settings/ProviderCard";
import { useAuth } from "../../../contexts/AuthContext";

const CAPABILITY_ORDER = [
  "crawler",
  "search",
  "email_finder",
  "email_verifier",
  "people",
] as const;

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
];

function AccountTab() {
  const { user, refresh } = useAuth();
  const [msg, setMsg] = useState<{ message: string; devLink?: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [profilePic, setProfilePic] = useState(user?.profile_picture || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // n8n Webhook States
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setProfilePic(user.profile_picture || "");
    }
    const saved = localStorage.getItem("n8n_webhook_url");
    if (saved) setWebhookUrl(saved);
  }, [user]);

  if (!user) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess(false);
    try {
      await api.updateProfile({
        name: name.trim(),
        profile_picture: profilePic.trim() || undefined,
      });
      setProfileSuccess(true);
      setIsEditing(false);
      await refresh();
      setTimeout(() => setProfileSuccess(false), 2500);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = webhookUrl.trim();
    localStorage.setItem("n8n_webhook_url", trimmed);
    setWebhookStatus(
      "Webhook URL saved successfully in your local browser settings.",
    );
    setTimeout(() => setWebhookStatus(null), 3000);
  }

  async function testWebhookPing() {
    const trimmed = webhookUrl.trim();
    if (!trimmed) {
      setWebhookStatus("Please enter an n8n webhook URL first.");
      return;
    }
    setTestingWebhook(true);
    setWebhookStatus(null);
    try {
      const res = await api.sendToN8nWebhook(trimmed, [
        {
          id: "test-contact-id",
          search_id: "test-search-id",
          company_id: "test-company-id",
          company_name: "Test Company Inc",
          company_website: "https://example.com",
          company_location: "New York, USA",
          name: "Test Recruiter",
          email: "recruiter@example.com",
          designation: "Head of Talent Acquisition",
          linkedin_url: "https://linkedin.com",
          source_type: "company_website",
          source_url: "https://example.com/careers",
          verification_status: "verified",
          confidence_score: 98,
          contact_category: "verified_hr",
          discovery_method: "website_crawl",
        },
      ]);
      setWebhookStatus(
        res.message || "Test payload delivered to n8n successfully!",
      );
    } catch (err) {
      setWebhookStatus(
        err instanceof Error
          ? `Ping failed: ${err.message}`
          : "Ping failed. Check your n8n webhook URL.",
      );
    } finally {
      setTestingWebhook(false);
    }
  }

  async function resend() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.resendVerification();
      setMsg({ message: res.message, devLink: res.dev_link || undefined });
    } catch (err) {
      setMsg({
        message: err instanceof Error ? err.message : "Failed to resend.",
      });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Card with Edit Button */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {user.profile_picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.profile_picture}
                alt="avatar"
                className="h-16 w-16 rounded-2xl object-cover ring-2 ring-blue-500/30"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 text-xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {user.name}
              </h2>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            {isEditing ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Edit3 className="h-3.5 w-3.5 text-blue-500" />
                <span>Edit Profile</span>
              </>
            )}
          </button>
        </div>

        {/* Profile Editing Form */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in duration-150"
          >
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Update Profile Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Profile Picture URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={profilePic}
                  onChange={(e) => setProfilePic(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quick Avatar Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-2">
                Or choose from avatar presets:
              </label>
              <div className="flex items-center space-x-2">
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProfilePic(preset)}
                    className={`h-9 w-9 rounded-xl overflow-hidden ring-2 transition hover:scale-105 ${
                      profilePic === preset
                        ? "ring-blue-500 scale-105"
                        : "ring-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preset}
                      alt="preset"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {profileError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-2.5 text-xs text-red-700 dark:text-red-300">
                {profileError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-1.5 text-xs font-bold text-white transition shadow-sm disabled:opacity-50"
              >
                {savingProfile ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{savingProfile ? "Saving…" : "Save Profile"}</span>
              </button>
            </div>
          </form>
        )}

        {profileSuccess && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-bold">Profile updated successfully!</span>
          </div>
        )}

        {/* Account Metadata Details */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-2">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
            <dt className="text-xs text-slate-400">Auth provider</dt>
            <dd className="font-semibold capitalize mt-0.5">
              {user.auth_provider}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
            <dt className="text-xs text-slate-400">Account status</dt>
            <dd className="font-semibold capitalize mt-0.5">
              {user.account_status}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
            <dt className="text-xs text-slate-400">Email verified</dt>
            <dd className="font-semibold mt-0.5">
              {user.is_email_verified ? "Yes" : "No"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
            <dt className="text-xs text-slate-400">Member since</dt>
            <dd className="font-semibold mt-0.5">
              {user.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "—"}
            </dd>
          </div>
        </dl>

        {!user.is_email_verified && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <MailCheck className="inline h-4 w-4 mr-1" />
              Your email is not verified. Searches stay disabled until you
              verify.
            </p>
            <button
              onClick={resend}
              disabled={busy}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-50"
            >
              {busy ? "Sending…" : "Resend verification email"}
            </button>
          </div>
        )}
        {msg && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-3 text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>{msg.message}</p>
            {msg.devLink && (
              <a
                href={msg.devLink}
                className="block text-xs text-blue-500 underline break-all"
              >
                {msg.devLink}
              </a>
            )}
          </div>
        )}
      </div>

      {/* n8n / Railway Webhook Outreach Integration Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 dark:bg-emerald-400/10">
            <Workflow className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              n8n Automated Outreach Webhook
            </h3>
            <p className="text-xs text-slate-500">
              Configure your Railway n8n endpoint for 1-click email campaign
              dispatch
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveWebhook} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Production Webhook URL
            </label>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://n8n-production-xxxx.up.railway.app/webhook/hr-outreach"
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm shrink-0"
              >
                Save URL
              </button>
              <button
                type="button"
                onClick={testWebhookPing}
                disabled={testingWebhook || !webhookUrl}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50 shrink-0"
              >
                {testingWebhook ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span>Test Ping</span>
              </button>
            </div>
          </div>

          {webhookStatus && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 text-xs text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
              {webhookStatus}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Check <code>docs/n8n_integration_guide.md</code> in your project
            repository for workflow mapping, Google Sheets logging, and email
            node setup.
          </p>
        </form>
      </div>

      {/* Data Isolation Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Data Isolation & Privacy</span>
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          All searches, companies, contacts, and provider keys belong strictly
          to your account. Other users cannot access or view your discovered HR
          intelligence records.
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateOne(updated: Provider) {
    setProviders((prev) =>
      prev.map((p) =>
        p.provider_key === updated.provider_key ? { ...p, ...updated } : p,
      ),
    );
    api
      .listProviders()
      .then(setProviders)
      .catch(() => {});
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
                <ProviderCard
                  key={p.provider_key}
                  provider={p}
                  onSaved={updateOne}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"providers" | "account">("account");
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your account profile, n8n integrations, and external API
          providers.
        </p>
      </div>

      <div className="flex space-x-2">
        {(["account", "providers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition capitalize ${
              tab === t
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {t === "providers" ? "API Providers" : "Account & Integrations"}
          </button>
        ))}
      </div>

      {tab === "providers" ? <ProvidersTab /> : <AccountTab />}
    </div>
  );
}
