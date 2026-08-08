# System Architecture (v2)

## Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                Next.js 16 Frontend (route groups)                     │
│  (auth): login · register · forgot/reset · verify-email               │
│  (app):  dashboard · new-search · searches/[id] live · results ·      │
│          settings (providers + account)                               │
│  ── same-origin proxy: /api/v1/* → backend (httpOnly JWT cookies) ──  │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                        FastAPI Backend (/api/v1)                      │
│                                                                       │
│  /auth        register · login · google/oauth · captcha · verify ·    │
│               reset (Argon2id, JWT-cookie, rate limited)              │
│  /searches    start (form/upload) · status · logs · contacts · cancel │
│  /contacts    global contact browser (per-user scoped)                │
│  /companies   saved companies                                         │
│  /providers   capability overview · encrypted key save · TEST CONN.   │
│  /dashboard   per-user statistics                                     │
│  /export      Excel export (evidence columns) · upload template       │
│  /health      capabilities & config sanity                            │
└──────┬─────────────────────────────────────────────┬──────────────────┘
       │                                             │
┌──────▼─────────────────┐                 ┌────────▼──────────────────┐
│ Background worker      │                 │ Alembic-managed database  │
│ (asyncio search jobs;  │                 │ PostgreSQL 16 (compose) / │
│ cancellable; state in  │                 │ SQLite local fallback     │
│ DB for progress/logs)  │                 └────────▲──────────────────┘
└──────┬─────────────────┘                          │
       │                                             │
┌──────▼──────────────────────────────────────────────────────────────────┐
│                        Search Orchestrator (per company)                │
│                                                                         │
│  1. Website crawl        HTTP crawler (robots.txt, sitemap, domain-     │
│                          restricted, dedupe, redirect/error handling)   │
│  1b. JS fallback         Playwright (optional) → Firecrawl (optional)   │
│  2. Email extraction     mailto · visible text · obfuscation ·          │
│                          data-email attrs · JSON-LD `email` fields      │
│  3. Context analysis     HR classifier (local part + page type +        │
│                          surrounding text) — generic emails never HR    │
│  4. Person ID            JSON-LD Person · "Name – HR Title" patterns ·  │
│                          LinkedIn URL matching                          │
│  5. Verification         syntax → domain → MX (free) (+ Hunter/SMTP)    │
│  7. External search      DDG (free) / Google CSE — public snippets only │
│  8. Email discovery      Hunter.io Domain Search (real found addresses) │
│  9. Professional data    Apollo.io people (HR titles @ the domain)      │
│                                                                         │
│  → evidence scoring (95+ verified, 90+ provider-verified, 70–89 strong, │
│    <70 weak, 0 → no email shown) → persist HRContact rows → status      │
└──────┬──────────────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────────────┐
│                          Provider Manager                               │
│                                                                         │
│  ProviderRegistry (pluggable interfaces):                               │
│      crawler    → http_crawler ★free · playwright ★free · firecrawl $   │
│      search     → duckduckgo ★free · google_search $                    │
│      email_finder → hunter $                                            │
│      email_verifier → local_mx ★free · hunter $                         │
│      people     → apollo $ (public-index snippets are free)             │
│                                                                         │
│  Resolution per user: DB key (encrypted) → env key → free default.      │
│  /providers/{key}/test performs REAL API calls (latency, credits, plan).│
└─────────────────────────────────────────────────────────────────────────┘
```

## Database schema

| Table | Purpose |
|---|---|
| `users` | email, name, Argon2 hash (null for OAuth), provider, google_sub, picture, is_email_verified, account_status, created/last_login |
| `auth_tokens` | fingerprints of single-use verification/reset tokens |
| `companies` | per-user: name, website, location, linkedin_url, industry, meta |
| `searches` | per-user per-company run: status, progress %, step, counters, error, summary |
| `search_logs` | structured progress lines (the live log stream) |
| `hr_contacts` | evidence-backed contact: name, title, email (nullable!), linkedin, source_type + source_url + provider, verification_status, confidence, category, discovery_method |
| `api_providers` | per-user provider config: encrypted key, masked tail, enabled, test status |

Every row carries `user_id`; every endpoint validates ownership.

## Key design decisions

1. **Zero fabrication by construction** — there is simply no code path that
   synthesizes an email address. `email` is a nullable column; absence of
   evidence ⇒ no row with an email.
2. **Confidence = evidence** — computed deterministically from
   (where found × which verification stage passed), never from model opinion.
3. **Graceful degradation** — provider failures log, never abort:
   HTTP crawl → Playwright → Firecrawl; search/email-finder steps skip when
   unconfigured; `no_results` is a *successful* honest outcome.
4. **Progress transparency** — `search_logs` rows are written at every stage
   and polled live by the UI (2s refresh), making debugging trivial.
5. **JW** sessions are httpOnly cookies (CSRF-mitigation: requests must carry a
   SameSite=Lax cookie; all browser traffic stays
   same-origin via the Next proxy).
6. **Rate limiting** is a sliding-window guard on auth/search endpoints;
   swap to Redis for multi-instance deployments.
