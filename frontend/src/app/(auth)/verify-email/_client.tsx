"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import AuthCard from "../../../components/auth/AuthCard";
import { api } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";

export default function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { setUser } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "invalid">(
    token ? "loading" : "invalid",
  );
  const [error, setError] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    async function run() {
      try {
        const user = await api.verifyEmail(token);
        setUser(user);
        setState("ok");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed.");
        setState("invalid");
      }
    }
    run();
  }, [token, setUser]);

  if (state === "loading") {
    return (
      <AuthCard title="Verifying your email" subtitle="One moment…">
        <div className="flex justify-center py-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AuthCard>
    );
  }

  if (state === "ok") {
    return (
      <AuthCard
        title="Email verified"
        subtitle="Your account is now fully active"
      >
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <Link
            href="/"
            className="block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition"
          >
            Open dashboard
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verification failed"
      subtitle={error || "This link is invalid or has expired"}
    >
      <div className="space-y-3 text-center">
        <XCircle className="mx-auto h-10 w-10 text-red-500" />
        <Link
          href="/login"
          className="block rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
