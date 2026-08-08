"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import AuthCard from "../../../components/auth/AuthCard";
import { api } from "../../../lib/api";

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword({ token, new_password: password });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Invalid reset link" subtitle="This link is missing its security token">
        <Link href="/forgot-password"
          className="block text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Your reset link is single-use">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">New password</label>
          <input type="password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="At least 8 characters" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Repeat new password</label>
          <input type="password" required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <button type="submit" disabled={busy}
          className="w-full inline-flex items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          <span>{busy ? "Updating…" : "Update password"}</span>
        </button>
      </form>
    </AuthCard>
  );
}
