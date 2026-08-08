"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import AuthCard from "../../../components/auth/AuthCard";
import CaptchaChallenge, {
  CaptchaValue,
} from "../../../components/auth/CaptchaChallenge";
import { api } from "../../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaValue>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ message: string; devLink?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.forgotPassword({ email, ...captcha });
      setDone({ message: res.message, devLink: res.dev_link || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Reset link sent" subtitle="Follow the instructions to pick a new password">
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>{done.message}</p>
          {done.devLink && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs">
              <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                Development mode (no SMTP configured)
              </p>
              <a href={done.devLink}
                className="text-blue-600 dark:text-blue-400 underline break-all">
                {done.devLink}
              </a>
            </div>
          )}
          <Link href="/login"
            className="block text-center rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?"
      subtitle="Enter your account email – we'll send you a secure reset link">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Email address</label>
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@company.com"
          />
        </div>
        <CaptchaChallenge value={captcha} onChange={setCaptcha} />
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <button type="submit" disabled={busy}
          className="w-full inline-flex items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          <span>{busy ? "Sending…" : "Send reset link"}</span>
        </button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
        Remembered after all?{" "}
        <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
