"""
Search Orchestrator.

Runs the evidence-first discovery pipeline for one company:

    provided website
        → official website crawl (HTTP)
        → JavaScript fallback (Playwright / Firecrawl) when needed
        → relevant pages (contact/careers/team/people/leadership/hr)
        → extract real emails with context
        → HR/recruitment context classification
        → person identification (names, titles, LinkedIn)
        → local verification (syntax → domain → MX)
        → if no verified HR email: external search providers
        → professional/LinkedIn discovery (public index snippets / Apollo)
        → email-finder providers (Hunter etc.)
        → final evidence-scored results

CRITICAL RULES:
* An email is only ever produced when it was literally found in a source.
* Nothing is generated, pattern-guessed, or inferred.
* Generic emails (info@, support@, etc.) are NEVER shown as HR contacts.
* Confidence scores represent ACTUAL evidence, not optimistic estimates.
* If no genuine HR email is found, return "No verified HR email found."
* Quality over quantity: it's better to return no email than a fake one.
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Company, HRContact, Search, SearchLog
from app.services.evidence import score_for_email
from app.services.extraction.classifier import (
    EmailCandidate,
    classify_email,
    is_hr_related,
<<<<<<< HEAD
=======
    is_verified_hr_email,
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
)
from app.services.extraction.people import persons_from_jsonld, persons_from_text
from app.services.extraction.linkedin import parse_linkedin_snippet, LinkedInLead
from app.services.providers.base import ProviderManager, SearchHit
from app.services.providers import builtin as _builtin  # noqa: F401 (register)
from app.services.providers import search as _search  # noqa: F401 (register)
from app.services.providers import firecrawl as _firecrawl  # noqa: F401 (register)
from app.services.providers import hunter as _hunter  # noqa: F401 (register)
from app.services.providers import apollo as _apollo  # noqa: F401 (register)
from app.services.verification.email_verifier import (
    VerificationLevel,
    verify_email_local,
)

logger = logging.getLogger("platform.orchestrator")

MAX_EMAILS_TO_VERIFY = 8
MAX_SEARCH_QUERIES = 4
WEBSITE_RELEVANT_HINTS = (
<<<<<<< HEAD
    "contact",
    "career",
    "job",
    "people",
    "team",
    "about",
    "leadership",
    "hr",
    "human-resource",
    "recruit",
    "work-with",
    "join",
)
=======
    "contact", "career", "job", "people", "team",
    "about", "leadership", "hr", "human-resource",
    "recruit", "work-with", "join",
)

# =============================================================================
# Generic email domains that should NEVER be treated as HR
# =============================================================================
GENERIC_EMAIL_PREFIXES = frozenset({
    "info", "support", "admin", "sales", "contact", "hello", "hi", "marketing",
    "finance", "accounts", "billing", "press", "media", "help", "enquiry",
    "inquiry", "feedback", "service", "office", "frontdesk", "inbox", "general",
    "webmaster", "postmaster", "security", "noreply", "no-reply", "mail",
    "customerservice", "it", "tech", "legal", "privacy", "abuse",
})
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709


def normalize_website(website: str) -> Optional[str]:
    """Normalize website URL."""
    website = (website or "").strip()
    if not website:
        return None
    if not website.startswith(("http://", "https://")):
        website = "https://" + website
    parsed = urlparse(website)
    if not parsed.netloc or "." not in parsed.netloc:
        return None
    return website.rstrip("/")


def domain_of(url: str) -> str:
    """Extract domain from URL."""
    return (urlparse(url).netloc or "").lower().removeprefix("www.")


def is_generic_email(email: str) -> bool:
    """
    Check if an email is a generic company mailbox.
    
    Generic emails are NEVER HR contacts.
    """
    if not email or "@" not in email:
        return False
    local = email.split("@")[0].lower()
    # Remove common separators
    local_clean = local.replace(".", "").replace("-", "").replace("_", "").replace("+", "")
    
    return local_clean in GENERIC_EMAIL_PREFIXES or local in GENERIC_EMAIL_PREFIXES


class SearchOrchestrator:
    """Runs one company search and persists evidence-backed results."""

    def __init__(self, db: AsyncSession, search: Search, company: Company):
        self.db = db
        self.search = search
        self.company = company
        self.cancelled = False
        self.provider_manager = ProviderManager(db, search.user_id)
        self._persisted_emails: set[str] = set()

    async def _record_email(self, email: Optional[str]) -> bool:
        """Track persisted emails so the same address never duplicates."""
        if not email:
            return True
        normalized = email.strip().lower()
        if normalized in self._persisted_emails:
            return False
        self._persisted_emails.add(normalized)
        return True

    # ------------------------------------------------------------- helpers
    async def log(self, message: str, level: str = "info") -> None:
        """Persist a progress log line and mirror it to the app log."""
        logger.info("[search %s] %s", self.search.id, message)
        self.db.add(SearchLog(search_id=self.search.id, level=level, message=message))
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()

    async def check_cancelled(self) -> bool:
        await self.db.refresh(self.search, attribute_names=["status"])
        if self.search.status == "cancelled":
            self.cancelled = True
        return self.cancelled

    async def set_progress(self, step: str, pct: int) -> None:
        self.search.current_step = step
        self.search.progress_pct = min(pct, 100)
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()

    async def save_contact(self, **fields) -> HRContact:
        contact = HRContact(
            search_id=self.search.id,
            company_id=self.company.id,
            user_id=self.search.user_id,
            **fields,
        )
        self.db.add(contact)
        return contact

    # ------------------------------------------------------------- main flow
    async def run(self) -> Search:
        start = time.time()
        self.search.status = "processing"
        self.search.started_at = datetime.now(timezone.utc)
        await self.log(
            f"▶ Starting HR contact discovery for '{self.company.name}' "
            f"({self.company.website})"
        )

        base_url = normalize_website(self.company.website)
        if not base_url:
            await self._finish_failed(
                "Invalid website URL – domain could not be parsed."
            )
            return self.search
        base_domain = domain_of(base_url)

        try:
            crawl = await self._stage_crawl(base_url, base_domain)
            if await self.check_cancelled():
                return self.search

            candidates = await self._stage_extract_and_classify(crawl)
            verified_map, hunter_verified = await self._stage_verify(candidates)
            if await self.check_cancelled():
                return self.search

            # =================================================================
            # FILTER: Only include HR-related emails with sufficient evidence
            # =================================================================
            hr_evidence = [
<<<<<<< HEAD
                c
                for c in candidates
                if is_hr_related(c)
=======
                c for c in candidates
                if is_verified_hr_email(c, c.context_strength)
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
                and verified_map.get(c.email) not in (VerificationLevel.INVALID, None)
            ]

            if not hr_evidence:
                await self.log(
                    "No verified HR email from the official website – continuing to "
                    "external/LinkedIn provider steps.",
                    "warning",
                )
                await self._stage_external_search(base_domain)
                await self._stage_email_finder(base_domain)
                await self._stage_people_discovery(base_domain)
                # people seen on the website itself (may carry HR titles)
                await self._persist_people_from_pages(crawl)
                # persist generic company emails (real, but not HR)
                await self._persist_company_emails(candidates, verified_map)
            else:
                await self._persist_hr_evidence(
                    hr_evidence, verified_map, hunter_verified
                )
                await self._persist_people_from_pages(crawl)
                await self._persist_company_emails(candidates, verified_map)

            await self._finish_success()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # defensive – never crash worker silently
            logger.exception("Search %s failed", self.search.id)
            await self._finish_failed(f"Unexpected pipeline error: {exc}")
        finally:
            self.search.duration_seconds = round(time.time() - start, 2)
            try:
                await self.db.commit()
            except Exception:
                await self.db.rollback()
        return self.search

    # -------------------------------------------------------------- stage 1+5
    async def _stage_crawl(self, base_url: str, base_domain: str):
        await self.set_progress("Crawling company website", 10)
        provider, api_key, origin = await self.provider_manager.resolve("crawler")

        async def progress_cb(info: Dict[str, Any]):
            self.search.pages_crawled = info.get("pages_crawled", 0)
            self.search.emails_found = info.get("emails_count", 0)
            self.search.current_step = info.get("current_page", "")[:250]
            try:
                await self.db.commit()
            except Exception:
                await self.db.rollback()
            if await self.check_cancelled():
                return False
            return True

        await self.log(f"✓ Company website loaded: {base_url}")
        crawler = provider or (await self.provider_manager.resolve("crawler"))[0]
        if crawler is None:
            raise RuntimeError("No crawler provider available.")

        await self.log(f"Using crawler: {crawler.display_name} ({origin})")
        crawl = await crawler.crawl_company(
            base_url,
            self.company.name,
            progress_callback=progress_cb,
        )

        await self.log(
            f"✓ {crawl.pages_crawled} pages successfully crawled "
            f"({len(crawl.errors)} fetch errors)"
        )
        if crawl.sitemap_found:
            await self.log("✓ sitemap.xml discovered and used for page prioritization")
        if crawl.robots_disallowed:
            await self.log(
                f"✓ robots.txt disallowed {crawl.robots_disallowed} URLs – skipped"
            )
        if crawl.blocked:
            await self.log(
                f"✕ Website blocked plain HTTP crawling: " f"{crawl.blocked_reason}",
                "warning",
            )

        # ---- JavaScript / anti-bot fallbacks
        if crawl.pages_crawled == 0 or crawl.needs_js or crawl.blocked:
            reason = (
                crawl.blocked_reason
                or "JavaScript rendering required or no HTML pages retrieved"
            )
            await self.log(f"✕ Lightweight crawl incomplete ({reason})", "warning")

            # Try Playwright
            from app.services.providers.base import ProviderRegistry

            pw = ProviderRegistry.get("playwright")
            done = False
            if pw and pw.available():
                await self.log("→ Falling back to browser crawler (Playwright)")
                try:
                    fallback = await pw.crawl_company(
                        base_url,
                        self.company.name,
                        progress_callback=progress_cb,
                    )
                    if fallback.pages_crawled > 0:
                        crawl = fallback
                        done = True
                        await self.log("✓ Browser crawler succeeded")
                except Exception as exc:
                    await self.log(f"Browser crawler error: {exc}", "error")

            # Then Firecrawl
            if not done:
                fc_key = await self.provider_manager.api_key_for("firecrawl")
                fc = ProviderRegistry.get("firecrawl")
                if fc and fc_key:
                    await self.log("→ Falling back to Firecrawl crawling API")
                    try:
                        fallback = await fc.crawl_company(
                            base_url,
                            self.company.name,
                            progress_callback=progress_cb,
                            api_key=fc_key,
                        )
                        if fallback.pages_crawled > 0:
                            crawl = fallback
                            done = True
                            await self.log("✓ Firecrawl crawler succeeded")
                    except Exception as exc:
                        await self.log(f"Firecrawl crawler error: {exc}", "error")

            if not done and crawl.pages_crawled == 0:
                await self.log(
                    "✕ All crawling strategies failed for this website", "error"
                )

        # Report relevant pages
        for p in crawl.pages:
            if p.page_type in ("careers", "contact", "people", "team", "hr", "recruitment"):
                await self.log(f"✓ {p.page_type.capitalize()} page found: {p.url}")
        return crawl

    # ---------------------------------------------------------------- stage 2,3
    async def _stage_extract_and_classify(self, crawl) -> List[EmailCandidate]:
        await self.set_progress("Extracting emails & analysing context", 40)
        candidates: Dict[str, EmailCandidate] = {}
        for page in crawl.pages:
            contexts = {c["email"]: c.get("context", "") for c in page.email_contexts}
            for em in page.emails:
                best = contexts.get(em, "")
                cand = classify_email(
                    em, page_type=page.page_type, source_url=page.url, context=best
                )
                prev = candidates.get(em)
                if prev is None or cand.context_strength > prev.context_strength:
                    candidates[em] = cand

        result = list(candidates.values())
        self.search.emails_found = len(result)
<<<<<<< HEAD
        await self.log(
            f"✓ {len(result)} email addresses extracted "
            f"(from real page content only)"
        )
        for cand in result:
            label = cand.relation
            await self.log(
                f"   • {cand.email} → {label} (page: " f"{cand.page_type})", "info"
            )
=======
        await self.log(f"✓ {len(result)} email addresses extracted "
                       f"(from real page content only)")
        
        # Log classification summary
        hr_count = sum(1 for c in result if is_hr_related(c))
        generic_count = sum(1 for c in result if c.is_generic)
        await self.log(f"   Classification: {hr_count} HR-related, {generic_count} generic company emails", "info")
        
        for cand in result:
            label = cand.relation
            await self.log(f"   • {cand.email} → {label} (page: "
                           f"{cand.page_type}, context: {cand.context_strength})", "info")
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
        return result

    # ---------------------------------------------------------------- stage 5
    async def _stage_verify(self, candidates: List[EmailCandidate]):
        await self.set_progress("Verifying emails (syntax → DNS → MX)", 60)
        verified_map: Dict[str, VerificationLevel] = {}
        hunter_verified: Dict[str, bool] = {}

        verifier, verifier_key, _ = await self.provider_manager.resolve(
<<<<<<< HEAD
            "email_verifier"
        )
        use_hunter = verifier is not None and verifier.key == "hunter" and verifier_key
=======
            "email_verifier")
        use_hunter = (
            verifier is not None and verifier.key == "hunter" and verifier_key
        )
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709

        # Verify HR-relevant first, capped
        ordered = sorted(
            candidates, key=lambda c: (not is_hr_related(c), -c.context_strength)
        )
        for cand in ordered[:MAX_EMAILS_TO_VERIFY]:
            level = await verify_email_local(cand.email)
            verified_map[cand.email] = level

            if use_hunter and cand.email:
                try:
                    res = await verifier.verify(cand.email, api_key=verifier_key)
                    hunter_verified[cand.email] = res.get("status") == "valid"
                    if hunter_verified[cand.email]:
                        level = VerificationLevel.MX_OK
                        verified_map[cand.email] = level
                except Exception:
                    pass

            status_line = {
                VerificationLevel.INVALID: "✕ invalid syntax",
                VerificationLevel.SYNTAX_ONLY: "… syntax valid only (unverified)",
                VerificationLevel.DOMAIN_OK: "… domain resolves, no MX",
                VerificationLevel.MX_OK: "✓ MX records valid",
                VerificationLevel.SMTP_OK: "✓ SMTP verified",
                VerificationLevel.ERROR: "✕ verification error",
            }.get(level, "…")
            await self.log(f"   {status_line}: {cand.email}")

        self.search.emails_found = max(self.search.emails_found, len(candidates))
        await self.db.commit()
        return verified_map, hunter_verified

    # ---------------------------------------------------------------- stage 7
    async def _stage_external_search(self, base_domain: str) -> None:
        await self.set_progress("External search providers", 70)
        if not settings.ENABLE_PUBLIC_SEARCH:
            await self.log("External search disabled by configuration.", "warning")
            return

        provider, api_key, origin = await self.provider_manager.resolve("search")
        if provider is None:
            await self.log("No search provider available.", "warning")
            return

        await self.log(f"Searching public indexes via {provider.display_name}")
        cname = self.company.name
        queries = [
            f'"{cname}" recruiter OR "talent acquisition" OR "hr manager" linkedin',
            f"{base_domain} (careers OR jobs) email contact",
            f'"{cname}" "careers@" OR "hr@" OR "jobs@" OR "recruitment@"',
        ][:MAX_SEARCH_QUERIES]

        linkedin_leads: List[LinkedInLead] = []
        for q in queries:
            if await self.check_cancelled():
                return
            try:
                kwargs = {}
                if provider.key == "google_search":
                    kwargs["api_key"] = api_key
                hits: List[SearchHit] = await provider.search(
                    q, max_results=settings.SEARCH_MAX_RESULTS, **kwargs
                )
            except Exception as exc:
                await self.log(
                    f"Search provider error on query {q!r}: {exc}", "warning"
                )
                continue

            for hit in hits:
                # LinkedIn profile snippets
                if "linkedin.com/in/" in hit.url.lower():
                    lead = parse_linkedin_snippet(
                        hit.title,
                        hit.snippet,
                        hit.url,
                        company_name=cname,
                        provider_name=provider.display_name,
                    )
                    if lead:
                        linkedin_leads.append(lead)
                # company-domain emails in snippets (real occurrences only)
                for em in self._emails_in_text(hit.snippet + " " + hit.title):
                    if domain_of("https://" + em.split("@")[-1]).endswith(base_domain):
                        level = await verify_email_local(em)
                        if level == VerificationLevel.INVALID:
                            continue
                        # Skip generic emails from search results
                        if is_generic_email(em):
                            await self.log(
                                f"   Skipping generic email from search: {em}", "info")
                            continue
                        cand = classify_email(em, "general", hit.url, hit.snippet)
                        status, category, conf, _ = score_for_email(
                            cand, level, "search_provider"
                        )
                        if not await self._record_email(em):
                            continue
                        await self.save_contact(
                            email=em,
                            name=None,
                            designation=None,
                            linkedin_url=None,
                            source_type="search_provider",
                            source_url=hit.url,
                            provider_name=provider.display_name,
                            verification_status=status,
                            confidence_score=conf,
                            contact_category=category,
                            discovery_method=provider.key,
                        )
                        await self.log(
                            f"✓ Email found in public index: {em} (source: "
                            f"{hit.url})",
                            "success",
                        )
            await asyncio.sleep(settings.SEARCH_RATE_LIMIT_DELAY)

        for lead in linkedin_leads[:5]:
            await self.save_contact(
                email=None,
                name=lead.name,
                designation=lead.job_title,
                linkedin_url=lead.linkedin_url,
                source_type="linkedin_page",
                source_url=lead.source_url,
                provider_name=lead.source,
                verification_status="unverified",  # no address to verify
                confidence_score=0,
                contact_category="linkedin",
                discovery_method=provider.key or "search",
            )
            self.search.profiles_found += 1
        if linkedin_leads:
            await self.log(
                f"✓ {len(linkedin_leads)} HR LinkedIn profile(s) "
                f"identified via public index",
                "success",
            )

    # ---------------------------------------------------------------- stage 8
    async def _stage_email_finder(self, base_domain: str) -> None:
        await self.set_progress("Email discovery providers", 80)
        provider, api_key, origin = await self.provider_manager.resolve("email_finder")
        if provider is None:
            await self.log("No email-discovery provider configured (skipping).")
            return
        await self.log(f"Querying {provider.display_name} for {base_domain}")
        try:
            found = await provider.find_emails(base_domain, api_key=api_key)
        except Exception as exc:
            await self.log(f"Email finder error: {exc}", "warning")
            return

        count = 0
        for fe in found:
            if await self.check_cancelled():
                return
            if not fe.email:
                continue
            level = await verify_email_local(fe.email)
            if level == VerificationLevel.INVALID:
                continue
<<<<<<< HEAD
            cand = classify_email(
                fe.email, "general", fe.source_url or "", fe.position or ""
            )
=======
            # Skip generic emails
            if is_generic_email(fe.email):
                await self.log(f"   Skipping generic email from provider: {fe.email}", "info")
                continue
            cand = classify_email(fe.email, "general",
                                  fe.source_url or "", fe.position or "")
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
            status, category, conf, label = score_for_email(
                cand, level, "email_finder", provider_says_verified=fe.provider_verified
            )
            # Only surface people in HR/recruiting roles (or HR mailboxes)
            title_hr = bool(
                fe.position
                and any(
                    t in fe.position.lower()
                    for t in ("hr", "human resource", "recruit", "talent", "people")
                ),
            )
            if not (is_hr_related(cand) or title_hr):
                category = "company_email"
            name = " ".join(filter(None, [fe.first_name, fe.last_name])) or None
            if not await self._record_email(fe.email):
                continue
            await self.save_contact(
                email=fe.email,
                name=name,
                designation=fe.position,
                linkedin_url=None,
                source_type="email_finder",
                source_url=fe.source_url,
                provider_name=provider.display_name,
                verification_status=status,
                confidence_score=conf,
                contact_category=category,
                discovery_method=provider.key,
            )
            count += 1
        if count:
            await self.log(
                f"✓ {count} addresses returned by " f"{provider.display_name}",
                "success",
            )
        else:
            await self.log(f"{provider.display_name} returned no addresses.")

    # ---------------------------------------------------------------- stage 9
    async def _stage_people_discovery(self, base_domain: str) -> None:
        await self.set_progress("Professional/LinkedIn data providers", 88)
        provider, api_key, _ = await self.provider_manager.resolve("people")
        if provider is None:
            await self.log("No professional-data provider configured (skipping).")
            return
        await self.log(
            f"Querying {provider.display_name} for HR people at " f"{self.company.name}"
        )
        try:
            people = await provider.find_people(
                base_domain, company_name=self.company.name, api_key=api_key
            )
        except Exception as exc:
            await self.log(f"People provider error: {exc}", "warning")
            return

        for person in people:
            status, category, conf = "unverified", "linkedin", 0
            if person.email:
                level = await verify_email_local(person.email)
                if level != VerificationLevel.INVALID:
                    cand = classify_email(person.email, "people", "", person.job_title)
                    status, category, conf, _ = score_for_email(
                        cand,
                        level,
                        "people_provider",
                        provider_says_verified=person.email_verified,
                    )
                    if category == "company_email" and person.job_title:
                        # Strong HR title evidence from a professional DB:
                        category = "possible_hr"
                else:
                    continue
            if person.email and not await self._record_email(person.email):
                continue
            await self.save_contact(
                email=person.email,
                name=person.name,
                designation=person.job_title,
                linkedin_url=person.linkedin_url,
                source_type="people_provider",
                source_url=person.source_url,
                provider_name=provider.display_name,
                verification_status=status,
                confidence_score=conf,
                contact_category=category,
                discovery_method=provider.key,
            )
            self.search.profiles_found += 1
        if people:
            await self.log(
                f"✓ {len(people)} HR profile(s) from " f"{provider.display_name}",
                "success",
            )

    # ---------------------------------------------------------------- persist
    async def _persist_hr_evidence(
        self, hr_evidence, verified_map, hunter_verified
    ) -> None:
        for cand in hr_evidence:
            level = verified_map.get(cand.email, VerificationLevel.SYNTAX_ONLY)
            status, category, conf, _ = score_for_email(
                cand,
                level,
                "company_website",
                provider_says_verified=hunter_verified.get(cand.email, False),
            )
            # Skip if confidence is too low (less than 50%)
            if conf < 50:
                await self.log(
                    f"   Skipping {cand.email}: confidence {conf}% below threshold",
                    "warning")
                continue
            if not await self._record_email(cand.email):
                continue
            await self.save_contact(
                email=cand.email,
                name=None,
                designation=None,
                linkedin_url=None,
                source_type="company_website",
                source_url=cand.source_url,
                provider_name=None,
                verification_status=status,
                confidence_score=conf,
                contact_category=category,
                discovery_method="website_crawl",
            )
            await self.log(
                f"✓ HR-related email identified: {cand.email} "
                f"({status}, confidence {conf}%, context: {cand.page_type})",
                "success",
            )

    async def _persist_company_emails(
        self, candidates, verified_map, exclude_hr: bool = False
    ) -> None:
        stored = 0
        for cand in candidates:
            if is_hr_related(cand):
                continue  # company buckets only for non-HR
            level = verified_map.get(cand.email)
            if level in (None, VerificationLevel.INVALID):
                continue
            status, category, conf, _ = score_for_email(cand, level, "company_website")
            if not await self._record_email(cand.email):
                continue
            await self.save_contact(
                email=cand.email,
                name=None,
                designation=None,
                linkedin_url=None,
                source_type="company_website",
                source_url=cand.source_url,
                provider_name=None,
                verification_status=status,
                confidence_score=conf,
                contact_category="company_email",
                discovery_method="website_crawl",
            )
            stored += 1
        if stored:
            await self.log(
                f"✓ {stored} general company email(s) saved as company contacts "
                f"(not HR)",
                "info",
            )

    async def _persist_people_from_pages(self, crawl) -> None:
        stored = 0
        seen = set()
        for page in crawl.pages:
<<<<<<< HEAD
            if page.page_type not in (
                "team",
                "people",
                "leadership",
                "careers",
                "about",
                "contact",
            ):
=======
            if page.page_type not in ("team", "people", "leadership", "careers",
                                      "about", "contact", "hr", "recruitment"):
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
                continue
            persons = persons_from_jsonld(page.json_ld, page.url)
            persons += persons_from_text(
                page.text_content,
                self.company.name,
                page.url,
                linkedin_urls=list(crawl.all_linkedin_urls),
            )
            for p in persons:
                key = p.name.lower()
                if key in seen:
                    continue
                seen.add(key)
                status = "unverified"
                category, conf = "linkedin", 0
                email = None
                if p.email:
                    level = await verify_email_local(p.email)
                    if level != VerificationLevel.INVALID:
                        cand = classify_email(
                            p.email, page.page_type, page.url, p.job_title
                        )
                        status, category, conf, _ = score_for_email(
                            cand, level, "company_website"
                        )
                        # An HR job title is itself HR evidence: even when the
                        # personal mailbox isn't HR-keyed, this is an HR contact
                        # (never an HR *verified* one without stronger checks).
                        if category == "company_email" and p.job_title:
                            category = "possible_hr"
                        email = p.email
                if email and not await self._record_email(email):
                    continue
                await self.save_contact(
                    email=email,
                    name=p.name,
                    designation=p.job_title,
                    linkedin_url=p.linkedin_profile_url,
                    source_type="company_website",
                    source_url=p.source_url,
                    provider_name=None,
                    verification_status=status,
                    confidence_score=conf,
                    contact_category=category if email else "linkedin",
                    discovery_method="website_crawl",
                )
                stored += 1
                self.search.profiles_found += 1
        if stored:
            await self.log(
                f"✓ {stored} HR person(s) identified on company " f"pages", "success"
            )

    # ---------------------------------------------------------------- status
    async def _finish_success(self) -> None:
        from sqlalchemy import select as _select

        await self.db.flush()
        res = await self.db.execute(
            _select(HRContact).where(HRContact.search_id == self.search.id)
        )
        contacts = res.scalars().all()
        hr_like = [
            c for c in contacts if c.contact_category in ("verified_hr", "possible_hr")
        ]
        self.search.status = "completed" if hr_like else "no_results"
        self.search.finished_at = datetime.now(timezone.utc)
        self.search.progress_pct = 100
        self.search.current_step = ""
        if hr_like:
            best = sorted(hr_like, key=lambda c: c.confidence_score, reverse=True)[0]
            self.search.summary = (
                f"{best.verification_status.replace('_', ' ').title()} HR contact: "
                f"{best.email} (confidence {best.confidence_score}%)"
                if best.email
                else "HR profile identified (no email evidence)."
            )
            self.search.discovery_method = best.discovery_method
            await self.log(f"✓ Final result: {self.search.summary}", "success")
        else:
            company_emails = [
                c for c in contacts if c.contact_category == "company_email"
            ]
            linkedins = [c for c in contacts if c.contact_category == "linkedin"]
            tail = ""
            if company_emails or linkedins:
                tail = (
                    f" ({len(company_emails)} general company email(s), "
                    f"{len(linkedins)} HR profile(s) without verified email "
                    f"were found and are listed separately.)"
                )
            self.search.summary = f"No verified HR contact found.{tail}"
            await self.log(f"✕ {self.search.summary}", "warning")
        await self.db.commit()

    async def _finish_failed(self, message: str) -> None:
        from sqlalchemy import select as _select

        try:
            res = await self.db.execute(
                _select(Search).where(Search.id == self.search.id)
            )
            self.search = res.scalars().one()
        except Exception:
            pass
        self.search.status = "failed"
        self.search.error_message = message
        self.search.summary = message
        self.search.finished_at = datetime.now(timezone.utc)
        await self.log(f"✕ Search failed: {message}", "error")
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()

    # ---------------------------------------------------------------- helpers
    @staticmethod
    def _emails_in_text(text: str) -> List[str]:
        """Extract email addresses from text."""
        import re
        EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", re.I)
        return EMAIL_RE.findall(text)
