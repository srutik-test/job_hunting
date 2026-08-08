# HR & Recruitment Contact Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A **production-ready, full-stack web application** that discovers, extracts, and verifies **publicly available HR and recruitment contact information** (official HR email addresses, recruitment mailboxes, and recruiter/HR LinkedIn profiles) from target company websites and public indices.

Built with **clean architecture, modular services, async concurrency, and an excellent UI/UX with dark mode support**.

---

## 🌟 Key Features

- **Batch Upload (Excel & CSV)**: Drag & drop upload with fuzzy column mapping (auto-detects `Company Name`, `Location`, `Website`, `LinkedIn URL`) and interactive pre-extraction preview.
- **Manual Entry Grid**: Single and multi-company spreadsheet input with one-click sample loader.
- **Intelligent 5-Step Pipeline**:
  1. *Recursive Website Crawling*: Automatic discovery of `/careers`, `/jobs`, `/team`, `/about-us`, `/leadership`, `/contact`, and `sitemap.xml`.
  2. *Email Extraction & Categorization*: Classifies into `HR`, `Recruitment`, `Careers`, `Talent Acquisition`, and filters generic `info@`, `support@`, `sales@` emails unless used as a fallback.
  3. *Public LinkedIn HR Research*: Locates publicly indexed HR Managers, Recruiters, and Talent Specialists with Names, Job Titles, and profile URLs without bypassing authentication.
  4. *Public Search Indexing*: Cross-references DuckDuckGo public search and directory listings.
  5. *Verification & Confidence Scoring*: DNS MX mail exchanger validation, RFC syntax check, and 0–95% confidence scoring.
- **Real-Time Processing Queue**: Live progress bar, current target, page counters, and streaming terminal log viewer.
- **Rich Results Intelligence Grid**: TanStack-style data table with all 14 columns, multi-field search, status filtering, confidence sliders, column toggles, copy buttons, and full audit detail modals.
- **Formatted Exports & Templates**: Download styled Excel (`.xlsx`) and `.csv` files, plus downloadable sample templates (`sample_companies_template.xlsx` and `sample_companies_template.csv`).
- **Ethical & Legal**: 100% public information, zero guessed patterns, zero fake data.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | FastAPI, Async Architecture, Pydantic v2 Settings & Models |
| **Database** | SQLite with Async SQLAlchemy 2.0 (PostgreSQL ready) |
| **Crawler & Extraction** | `aiohttp`, `httpx`, `BeautifulSoup4`, XML Sitemap Parser, DuckDuckGo Search |
| **Excel & CSV** | Pandas, OpenPyXL (styled headers & auto-width) |
| **Verification** | `dnspython` (DNS MX records), `email-validator` (RFC 5322) |
| **Containerization** | Docker, Docker Compose |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Git

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run backend API server on port 8000
python run.py
```
Backend API will be available at `http://localhost:8000` with Swagger documentation at `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend
npm install

# Run Next.js development server on port 3000
npm run dev
```
Frontend will be available at `http://localhost:3000`.

---

## 🐳 Docker Setup

Run the full platform with a single command using Docker Compose:

```bash
docker-compose up --build
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **API Docs**: `http://localhost:8000/docs`

---

## 📊 Excel & CSV Import/Export Formats

### Sample Import Template (`sample_companies_template.xlsx` / `.csv`)

| Company Name | Location | Website | LinkedIn URL |
|---|---|---|---|
| Aspire Softserv | Ahmedabad | `https://aspiresoftserv.com` | `https://linkedin.com/company/aspire-softserv` |
| Simform | Ahmedabad | `https://simform.com` | `https://linkedin.com/company/simform` |
| Bacancy Technology | Ahmedabad | `https://bacancytechnology.com` | `https://linkedin.com/company/bacancy-technology` |
| Radixweb | Ahmedabad | `https://radixweb.com` | `https://linkedin.com/company/radixweb` |
| TatvaSoft | Ahmedabad | `https://tatvasoft.com` | `https://linkedin.com/company/tatvasoft` |

### Structured Export Columns

1. **Company Name**: Target organization
2. **Location**: City or headquarters
3. **Website**: Official website URL
4. **LinkedIn**: Company LinkedIn page
5. **HR Email**: Verified public HR contact (or "Not Publicly Available")
6. **Recruitment Email**: Talent acquisition contact
7. **Careers Email**: Careers portal contact
8. **General Email**: General contact fallback
9. **HR Name**: Publicly identified HR representative
10. **HR Position**: Recruiter or HR Manager job title
11. **LinkedIn Profile**: Public recruiter LinkedIn profile
12. **Confidence Score**: Traceable confidence metric (95%, 90%, 85%, 70%, 0%)
13. **Source**: Verifiable public page URL
14. **Verification Status**: `Verified Public HR Email`, `Verified Recruitment Email`, `Verified Careers Email`, `General Contact Email`, `Not Publicly Available`
15. **Extraction Date**: UTC timestamp

---

## 🧪 Testing

Run the automated pytest test suite covering crawlers, email extractors, classifiers, DNS verifiers, Excel importers/exporters, and API endpoints:

```bash
cd backend
PYTHONPATH=. /home/user/venv/bin/pytest -v
```

16 unit and integration test cases verify the extraction engine and API contracts.

---

## ⚖️ Ethical & Legal Compliance

- **Public Data Only**: Collects only publicly accessible information indexed on company websites, careers pages, sitemaps, and public search snippets.
- **Zero Login Wall Bypassing**: Does not scrape behind authentication or bypass LinkedIn logins.
- **No Email Guessing**: Never generates guessed email addresses based on patterns. If no verified contact is found, the platform returns `"Not Publicly Available"`.
- **DNS MX Verified**: Every extracted email domain is validated for active mail exchanger records.

---

## 🚀 Major System Upgrade (v2) – Completed

**Implemented on branch `arena/019fe14f-job-hunting`**

### 1. User Authentication System
- Google OAuth + Email/Password with bcrypt
- Cryptographic visual/math CAPTCHA on registration/login
- JWT + HTTP-only cookies, protected routes
- Complete user data isolation (companies, searches, contacts)

### 2. Real Database Architecture
- PostgreSQL / SQLite with Async SQLAlchemy 2.0
- Tables: `users`, `companies`, `searches`, `hr_contacts`, `api_providers`
- Updated `docker-compose.yml` with full local stack

### 3. ZERO Fake/Guessed Emails (Evidence-First)
- 100% elimination of synthetic email generation
- Strict “No verified HR email found.” + 0% confidence when no evidence
- Full Source, Source URL, Verification Status displayed for every result

### 4. Pluggable Provider Management
- Abstract providers: Web Crawling, Search, Email Discovery, Verifier
- Live “Test Connection” buttons in Settings (returns balance + latency)
- API keys encrypted at rest and masked in UI

### 5. Full-Stack Next.js 16 + FastAPI
- Next.js 16 (App Router), React 19, TypeScript, Tailwind, Lucide, Dark Mode
- Dashboard, Drag & Drop, Manual Grid, Live Queue + streaming logs, Results Table + Excel/CSV export
- Comprehensive pytest suite (all tests passing)

**Status**: Fully implemented, tested, and ready for production.
