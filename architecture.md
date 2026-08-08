# HR & Recruitment Contact Intelligence Platform Architecture

## System Architecture Overview

The HR & Recruitment Contact Intelligence Platform is built on clean, modular, domain-driven design principles with a decoupled async backend and a modern Next.js frontend.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Next.js 16 Web UI                               │
│  (Dashboard | Drag & Drop Upload | Manual Grid | Live Queue | Results Grid) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST / SSE Proxy
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            FastAPI Backend API                              │
│         (/health | /companies | /jobs | /results | /export)                 │
└───────────────────┬───────────────────────────────────┬─────────────────────┘
                    │                                   │
┌───────────────────▼──────────────┐   ┌────────────────▼─────────────────────┐
│     Async Pipeline Coordinator   │   │         SQLite / PostgreSQL          │
│   (5-Step Multi-Source Pipeline) │   │        (Async SQLAlchemy 2.0)        │
└───────────────────┬──────────────┘   └──────────────────────────────────────┘
                    │
   ┌────────────────┼────────────────┬────────────────┬────────────────┐
   │                │                │                │                │
┌──▼─────────┐ ┌────▼──────────┐ ┌───▼──────────┐ ┌───▼──────────┐ ┌───▼──────────┐
│   Step 1   │ │    Step 2     │ │    Step 3    │ │    Step 4    │ │    Step 5    │
│ Recursive  │ │ Public Email  │ │  LinkedIn    │ │ Public Search│ │ Verification │
│  Crawler   │ │ Categorizer   │ │  HR Research │ │  & Indexes   │ │  & Confidence│
│  & Sitemap │ │ (HR/Careers)  │ │ (Roles/Team) │ │ (Apollo/DDG) │ │  (DNS MX /   │
│   Parser   │ │ (Drop Generic)│ │ (Zero Bypass)│ │ (Directories)│ │  0% to 95%)  │
└────────────┘ └───────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

## Modular Directory Structure

```
job_hunting/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── companies.py     # Upload preview, column validation, manual submission
│   │   │   │   ├── jobs.py          # Progress polling, SSE streams, cancellations, metrics
│   │   │   │   ├── results.py       # Querying, filtering, sorting, and pagination
│   │   │   │   ├── export.py        # Excel (.xlsx) and CSV exports, sample templates
│   │   │   │   └── health.py        # System health diagnostics & capabilities
│   │   │   └── router.py            # Main API router aggregating endpoints
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic v2 settings & environment loading
│   │   │   ├── database.py          # Async SQLAlchemy engine, session maker, base model
│   │   │   └── logging.py           # Structured logging with per-job live buffers
│   │   ├── models/
│   │   │   ├── company.py           # Company database model
│   │   │   ├── job.py               # ExtractionJob status, timing, and counters
│   │   │   └── result.py            # ExtractionResult with all 14 structured columns
│   │   ├── schemas/
│   │   │   ├── company.py           # Company input validation & preview schemas
│   │   │   ├── job.py               # Progress, stats, and lifecycle models
│   │   │   ├── result.py            # Result responses and filter parameters
│   │   │   └── extraction.py        # Manual batch and single company requests
│   │   ├── services/
│   │   │   ├── crawler/
│   │   │   │   ├── base.py          # BaseCrawler abstract interface
│   │   │   │   ├── http_crawler.py  # Asynchronous HTTP crawler with priority queue
│   │   │   │   ├── page_classifier.py # Page type scorer (careers, team, contact)
│   │   │   │   ├── sitemap_parser.py # XML sitemap and robots.txt parser
│   │   │   │   └── crawler_factory.py # Multi-crawler engine factory
│   │   │   ├── extractor/
│   │   │   │   ├── email_classifier.py # Categorizes HR, Recruitment, Careers emails
│   │   │   │   ├── linkedin_finder.py  # Public LinkedIn profile extractor
│   │   │   │   └── verifier.py         # RFC syntax check, DNS MX lookup, scoring
│   │   │   ├── search/
│   │   │   │   └── ddg_searcher.py     # Public search engine aggregator
│   │   │   ├── excel/
│   │   │   │   ├── importer.py      # Excel/CSV parser with fuzzy column mapping
│   │   │   │   └── exporter.py      # Styled openpyxl Excel & CSV exporter
│   │   │   └── pipeline/
│   │   │       ├── coordinator.py   # Master 5-step extraction coordinator
│   │   │       └── queue_worker.py  # Async worker manager with concurrency pools
│   │   └── main.py                  # FastAPI lifespan & application setup
│   ├── tests/                       # 16 unit and integration pytest test cases
│   ├── sample_data/                 # Downloadable sample Excel and CSV files
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Responsive layout with Navbar and Sidebar
│   │   │   ├── page.tsx             # Dashboard with stats & recent runs
│   │   │   ├── upload/page.tsx      # Drag & Drop Excel/CSV upload & column validator
│   │   │   ├── manual/page.tsx      # Manual entry spreadsheet grid
│   │   │   ├── processing/page.tsx  # Live progress bar & streaming log terminal
│   │   │   ├── results/page.tsx     # Data grid with sorting, filtering, copy buttons
│   │   │   └── export/page.tsx      # Export center & sample templates
│   │   ├── components/
│   │   │   ├── dashboard/           # Stats cards, pipeline diagram
│   │   │   ├── upload/              # Dropzone, preview table
│   │   │   ├── manual/              # Manual entry spreadsheet table
│   │   │   ├── queue/               # LiveProgressBar, LiveLogViewer
│   │   │   ├── results/             # DataTable, ConfidenceBadge, StatusBadge, DetailModal
│   │   │   └── layout/              # Navbar, Sidebar, ThemeToggle
│   │   ├── lib/api.ts               # Typed client fetchers for all endpoints
│   │   └── types/index.ts           # TypeScript domain definitions
│   ├── package.json
│   ├── next.config.mjs
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Data Collection & Verification Pipeline

### Step 1: Recursive Website Crawl
- Priority queue checks `/careers`, `/jobs`, `/hiring`, `/join-us`, `/team`, `/about-us`, `/leadership`, `/contact`, `/people`, and `/sitemap.xml`.
- Extracts all visible text, mailto links, JSON-LD structured data (`schema.org/Person`, `schema.org/JobPosting`), and link graphs.

### Step 2: Public Email Categorization
- Scans for all publicly visible emails.
- Categorizes into: `HR`, `Recruitment`, `Careers`, `Talent Acquisition`, `People Operations`, `General Contact`.
- Automatically ignores generic mailboxes (`info@`, `support@`, `admin@`, `sales@`, `contact@`, `hello@`, `marketing@`, `finance@`, `accounts@`) from HR fields, using them strictly as a fallback labeled `"General Contact Email"` only when no HR contact exists.

### Step 3: Public LinkedIn Research
- Identifies publicly available HR personnel: HR Managers, Recruiters, Talent Acquisition Specialists, Talent Partners, HR Executives, Hiring Managers, People Operations, Recruitment Coordinators.
- Collects: Name, Job Title, LinkedIn Profile URL.
- Strictly ethical: No login bypass or pattern guessing.

### Step 4: Public Search & Directory Indexes
- Cross-references DuckDuckGo public search, Google search index snippets, and business directories (Apollo, Wellfound, Crunchbase, Clutch).

### Step 5: Verification & Confidence Scoring
- Validates RFC 5322 email syntax and DNS MX mail exchanger records.
- Assigns statuses:
  - `Verified Public HR Email` (90–95%)
  - `Verified Recruitment Email` (85–90%)
  - `Verified Careers Email` (85–90%)
  - `General Contact Email` (70%)
  - `Not Publicly Available` (0%)
- Returns `"Not Publicly Available"` whenever no verified contact exists.
