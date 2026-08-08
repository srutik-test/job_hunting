# HR & Recruitment Contact Intelligence Platform (v2)

A full-stack, production-grade platform that discovers **real, verified HR and
recruitment contacts** — and *never* generates, guesses, or fabricates email
addresses.

> **Core principle:** `Evidence → Extraction → Context → Verification → Result`
>
> If no reliable HR email exists for a company, the platform honestly reports
> **"No verified HR email found."** instead of returning a made-up address.

---

## What this platform does

1. **Crawls the company's own website** (domain-restricted, robots.txt-aware,
   sitemap-aware, prioritized: `/contact`, `/careers`, `/jobs`, `/team`,
   `/people`, `/leadership`, `/hr`, `/human-resources`, `/recruitment`,
   `/work-with-us`…).
2. **Extracts only real emails** found in page content: `mailto:` links,
   visible text, obfuscated patterns (`name [at] domain [dot] io`),
   `data-email` attributes, and JSON-LD structured data.
3. **Analyses HR context** — an email is only "HR" when there is actual HR
   evidence (HR-style local part, HR page type, HR wording in the surrounding
   text). `support@company.com` is *always* reported as a generic company
   email, never as HR.
4. **Identifies people** — HR/recruiter names, titles, LinkedIn URLs from
   JSON-LD and team/careers page text.
5. **Verifies** every address: syntax → domain → DNS MX (free), optional SMTP
   probing, or via configured third-party verifiers.
6. **Falls back** only then to external search indexes and professional-data
   providers (LinkedIn discovery via *public* search snippets, Apollo; email
   discovery via Hunter — all returning only data actually returned by those
   services).
7. **Scores by evidence**, not by guesswork (see confidence tiers below).

## What it will never do

- 🚫 Generate random HR emails or guess address patterns
- 🚫 Present `hr@domain.com`-style inferences as real unless literally found
- 🚫 Assign high confidence to unverified addresses
- 🚫 Call syntax validation "verification"
- 🚫 Hide the source of any result
- 🚫 Scrape LinkedIn behind authentication or bypass access controls
- 🚫 Silently fail — every failure surfaces in the search log

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, route groups `(auth)`/`(app)` |
| Backend | FastAPI (async), SQLAlchemy 2.0, Alembic migrations |
| Database | PostgreSQL 16 (Docker default) — SQLite fallback for quick local runs |
| Auth | Email/password (Argon2id), Google OAuth 2.0, JWT in httpOnly cookies, email verification, single-use password reset |
| CAPTCHA | Cloudflare Turnstile / reCAPTCHA / hCaptcha / built-in dev CAPTCHA |
| Crawling | httpx + BeautifulSoup (light), optional Playwright Chromium (JS sites), optional Firecrawl API |
| Verification | dnspython (MX), email-validator (RFC), optional SMTP, Hunter |
| Providers | Pluggable registry: crawler, search, email finder, verifier, professional data |

---

## Quick start

### A. Docker Compose (recommended — includes PostgreSQL)

```bash
cp .env.example .env            # set SECRET_KEY at minimum
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000 (Swagger: http://localhost:8000/docs)
- PostgreSQL persists in the `postgres_data` volume (survives restarts)
- Migrations run automatically because `RUN_MIGRATIONS=true`

### B. Local development (SQLite, zero dependencies)

```bash
# 1. Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
python run.py                       # -> http://localhost:8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                         # -> http://localhost:3000
```

The Next.js server proxies `/api/v1/*` to the backend, so the browser hits
same-origin URLs and the httpOnly session cookie keeps working.

### Registering your first account

1. **Register** — complete the CAPTCHA (the default `dev-math` CAPTCHA asks an
   arithmetic question).
2. **Verify email** — in dev mode (no SMTP configured) the verification link
   is printed in the backend log **and returned in the API response/UI**.
3. Start a search from **New Search**.

---

## Providers: free vs paid

| Capability | Free options | Paid options |
|---|---|---|
| Website crawling | Built-in HTTP crawler; Playwright Chromium (self-hosted, optional) | Firecrawl |
| Web search | DuckDuckGo public search | Google Custom Search (100 free queries/day) |
| Email discovery | Website extraction only (always free) | Hunter.io Domain Search |
| Email verification | Syntax → domain → DNS MX (built-in); optional SMTP | Hunter.io Email Verifier |
| Professional / LinkedIn data | Public search-index snippets | Apollo.io |

**Selection logic** (per capability, per user):
`user-configured provider key (DB)` → `environment variable key` →
`free built-in default`. One provider failing never aborts a search — the
orchestrator degrades gracefully and logs the reason.

### API key management (Settings → API Providers)

- Keys entered in the UI are **Fernet-encrypted at rest**, only a masked tail
  (`••••••••ab12`) ever comes back.
- Keys can also be provided as env vars (`FIRECRAWL_API_KEY`, `HUNTER_API_KEY`,
  `APOLLO_API_KEY`, `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`).
- Every provider has a real **Test Connection** button that actually calls the
  vendor API (latency + result, e.g. Hunter account plan/usage, Firecrawl
  remaining credits). It never just checks the field is non-empty.

> Tip: the DB-stored key (entered in the UI) always wins over the env var
> fallback, so different users can use different accounts of the same vendor.

---

## CAPTCHA configuration

`CAPTCHA_PROVIDER` supports:

| Value | Behavior | Required env vars |
|---|---|---|
| `dev-math` (default) | Built-in arithmetic challenge | — |
| `turnstile` | Cloudflare Turnstile widget | `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET_KEY` |
| `recaptcha` | Google reCAPTCHA v2 widget | `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET_KEY` |
| `hcaptcha` | hCaptcha widget | `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET_KEY` |
| `none` | disabled (**testing only**) | — |

Secret verification is always server-side against the vendor's `siteverify`
endpoint.

## Google OAuth setup

1. Google Cloud Console → Credentials → Create OAuth client (Web).
2. Authorized redirect URI: `{BACKEND_PUBLIC_URL}/api/v1/auth/google/callback`
   (e.g. `http://localhost:8000/api/v1/auth/google/callback`).
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. The "Continue with Google" button then works end-to-end; Google accounts
   with a verified email are auto-verified.

## Optional: Playwright browser crawler

Many modern sites render content only with JavaScript. Two fallbacks exist:

```bash
pip install playwright && playwright install chromium
ENABLE_PLAYWRIGHT=true
```

With Docker, rebuild the backend with `INSTALL_PLAYWRIGHT=true` and set
`ENABLE_PLAYWRIGHT=true`. If neither Playwright nor Firecrawl is available,
the platform reports `JavaScript rendering required` in the search log
*instead of silently returning nothing*.

---

## Confidence & verification tiers (evidence-based)

| Tier | Meaning |
|---|---|
| **95–100% · Verified** | Real email found on the official company website **and** MX records valid |
| **90% · Verified** | Returned by a reliable provider **and** verified (provider-side or MX) |
| **70–89% · Partially verified / Possible** | Strong evidence, incomplete verification (e.g. MX inconclusive) |
| **<70% · Possible / Company email** | Real but weakly evidenced; generic mailboxes live here |
| **0 / hidden** | No evidence — no email is produced at all |

`verification_status` values: `verified` · `partially_verified` · `unverified`.
Contact categories: `verified_hr` · `possible_hr` · `company_email` · `linkedin`
(person identified without email evidence). The UI and Excel export always
separate these four.

## Search pipeline priority

```
User enters company (+ website, location, LinkedIn URL)
  → official website crawl (HTTP; robots.txt + sitemap + domain restriction)
  → JS/anti-bot fallback: Playwright → Firecrawl
  → relevant pages discovered (contact/careers/team/people/leadership/hr…)
  → real emails extracted with context
  → HR-context classification (support@ ≠ HR; hr@/careers@/talent@ = HR)
  → local verification (syntax → domain → MX)
  → if no verified HR email:
        external search providers (DDG/Google public index incl. LinkedIn snippets)
        professional-data providers (Apollo)
        email-discovery providers (Hunter)
  → evidence-scored, source-labeled results
  → else: "No verified HR contact found."
```

Every search streams a **live progress log** to the UI
(`✓ Company website loaded`, `✓ 37 internal pages discovered`, `✕ Website
crawler failed – falling back to browser crawler`…).

## Excel export columns

`Company Name · Website · Location · HR Name · Designation · HR Email ·
LinkedIn Profile · Source · Source URL · Discovery Method ·
Verification Status · Confidence · Date Found`

Contacts without email evidence are explicitly marked *"No email evidence"* —
never fabricated.

---

## Security checklist

- Argon2id password hashing (OWASP recommended parameters via pwdlib)
- JWT sessions in httpOnly + SameSite cookies; Bearer tokens supported too
- Email verification required before searching; single-use reset links
- CAPTCHA on register/login/forgot-password
- Per-IP sliding-window rate limiting on auth and search endpoints
- SQL injection-proof (SQLAlchemy parameterization), strict Pydantic input
  validation, XSS-safe React rendering, scoped CORS
- API keys encrypted at rest; only masked tails in API responses
- Strict per-user data isolation on every endpoint (tested)

## Testing

```bash
cd backend
PYTHONPATH=. pytest -v
```

40 tests cover: auth flows (registration, login, CAPTCHA, reset, isolation),
HR classification rules (support@ never HR), evidence scoring
(no high confidence without evidence), crawler extraction (mailto/obfuscation/
JSON-LD/LinkedIn), person identification, provider registry & key encryption,
and two end-to-end orchestrator runs against realistic fake websites —
including the "no HR email anywhere ⇒ no_results" honesty path.

---

## Repository layout

```
backend/
  alembic/                 # DB migrations
  app/
    api/endpoints/         # auth, searches, contacts, providers, export, dashboard, health
    core/                  # config, security (JWT/passwords), crypto, deps, rate limiting
    models/                # users, companies, searches, search_logs, hr_contacts, api_providers, auth_tokens
    services/
      crawler/             # http_crawler, browser_crawler (Playwright), sitemap, page_classifier
      extraction/          # HR context classifier, people identification, LinkedIn snippets
      verification/        # free local verifier (syntax/domain/MX/SMTP)
      providers/           # builtin, firecrawl, google/ddg search, hunter, apollo + registry/manager
      orchestrator.py      # evidence-first pipeline
      worker.py            # background search jobs
      excel.py             # import (fuzzy columns) + styled export
frontend/
  src/app/(auth)/          # login, register, forgot/reset, verify-email
  src/app/(app)/           # dashboard, new-search, searches/[id], results, settings
  src/components/          # AppShell (nav/sidebar/guard), provider cards, contact cards, live logs
docker-compose.yml         # frontend + backend + PostgreSQL
.env.example               # every tunable, documented
```
