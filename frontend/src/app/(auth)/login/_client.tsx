"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Loader2,
  LogIn,
  X,
} from "lucide-react";
import AuthCard from "../../../components/auth/AuthCard";
import CaptchaChallenge, {
  CaptchaValue,
} from "../../../components/auth/CaptchaChallenge";
import { api, googleLoginUrl } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Google sign-in failed. Please try again.",
  oauth_state: "Google sign-in session expired. Please try again.",
  oauth_exchange: "Could not complete Google sign-in.",
  oauth_claims: "Google account could not be verified.",
  oauth_unconfigured:
    "Google OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are not yet configured in your backend .env file.",
};

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const oauthError = params.get("error");
  const oauthSuccess = params.get("oauth");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaValue>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOAuthHelp, setShowOAuthHelp] = useState(
    oauthError === "oauth_unconfigured",
  );

  React.useEffect(() => {
    if (oauthSuccess === "success") router.replace("/");
  }, [oauthSuccess, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await api.login({ email, password, ...captcha });
      setUser(user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your HR Contact Intelligence account"
    >
      {oauthError && ERROR_MESSAGES[oauthError] && (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">{ERROR_MESSAGES[oauthError]}</p>
              {oauthError === "oauth_unconfigured" && (
                <button
                  type="button"
                  onClick={() => setShowOAuthHelp(true)}
                  className="font-bold underline text-blue-600 dark:text-blue-400 mt-1 block"
                >
                  View Google OAuth Setup Instructions
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google OAuth Button - Always Prominent */}
      <div className="space-y-3 mb-5">
        <button
          type="button"
          onClick={() => (window.location.href = googleLoginUrl())}
          className="w-full inline-flex items-center justify-center space-x-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition group"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-medium">
              or sign in with email
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Email address
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <CaptchaChallenge value={captcha} onChange={setCaptcha} />

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          <span>{loading ? "Signing in…" : "Sign in"}</span>
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
        No account yet?{" "}
        <Link
          href="/register"
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Create one
        </Link>
      </p>

      {/* Google OAuth Setup Guide Modal */}
      {showOAuthHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 text-left">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-blue-600 dark:text-blue-400">
                <KeyRound className="h-5 w-5" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Google OAuth Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowOAuthHelp(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              To enable 1-click Google Sign-in, add your Google Cloud
              credentials to your <code>backend/.env</code> file:
            </p>

            <div className="rounded-xl bg-slate-950 p-3.5 text-xs text-emerald-400 font-mono space-y-1">
              <p>GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com</p>
              <p>GOOGLE_CLIENT_SECRET=your_client_secret</p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-500 space-y-1 border border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Authorized Redirect URI in Google Cloud:
              </p>
              <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400 select-all">
                http://localhost:8000/api/v1/auth/google/callback
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                See docs/google_oauth_setup_guide.md for full guide.
              </span>
              <button
                onClick={() => setShowOAuthHelp(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthCard>
  );
}
