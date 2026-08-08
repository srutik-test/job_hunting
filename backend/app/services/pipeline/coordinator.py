"""
Master Pipeline Coordinator.
Implements the full 5-step intelligent multi-source data collection and verification pipeline:
Step 1: Recursive website crawl & link discovery
Step 2: Public email extraction & classification
Step 3: LinkedIn HR research
Step 4: Public search & directory verification
Step 5: Verification, confidence scoring, and structured audit logs
"""
import time
import json
from typing import Dict, Any, Optional, Callable
from app.services.crawler.crawler_factory import CrawlerFactory
from app.services.crawler.page_classifier import classify_page_type
from app.services.extractor.email_classifier import classify_email, select_best_contacts, CategorizedEmail
from app.services.extractor.linkedin_finder import LinkedInFinder, PublicHRProfile
from app.services.extractor.verifier import ContactVerifier
from app.services.search.ddg_searcher import PublicSearchEngine
from app.core.logging import add_job_log


class ExtractionCoordinator:
    """Coordinates multi-source HR contact intelligence collection."""

    def __init__(self, crawler_engine: str = "auto", enable_public_search: bool = True):
        self.crawler = CrawlerFactory.get_crawler(crawler_engine)
        self.searcher = PublicSearchEngine()
        self.enable_public_search = enable_public_search

    async def process_company(
        self,
        company_name: str,
        website: str,
        location: str = "",
        linkedin_url: str = "",
        max_pages: int = 20,
        job_id: Optional[str] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Dict[str, Any]:
        """
        Execute full extraction pipeline for a single company.
        """
        start_ts = time.time()
        job_id_str = job_id or "adhoc"

        add_job_log(job_id_str, "INFO", f"▶ Starting Public HR Contact Research for '{company_name}' ({website})", {
            "company": company_name, "website": website, "location": location
        })

        all_categorized_emails: list[CategorizedEmail] = []
        all_discovered_profiles: list[PublicHRProfile] = []
        crawled_page_records = []
        raw_audit_details: Dict[str, Any] = {
            "company_name": company_name,
            "website": website,
            "location": location,
            "steps": {}
        }

        # ----------------------------------------------------
        # Step 1: Recursive Website Crawl
        # ----------------------------------------------------
        add_job_log(job_id_str, "INFO", f"Step 1: Crawling website structure for '{company_name}'...")
        crawl_result = await self.crawler.crawl_company(
            base_url=website,
            company_name=company_name,
            max_pages=max_pages,
            progress_callback=progress_callback
        )

        raw_audit_details["steps"]["crawl"] = {
            "pages_crawled": crawl_result.pages_crawled,
            "duration_seconds": crawl_result.duration_seconds,
            "sitemap_found": crawl_result.sitemap_found,
            "errors": crawl_result.errors
        }

        add_job_log(job_id_str, "INFO", f"Step 1 Completed: Crawled {crawl_result.pages_crawled} pages in {crawl_result.duration_seconds}s")

        # ----------------------------------------------------
        # Step 2: Extract & Classify Public Email Addresses
        # ----------------------------------------------------
        add_job_log(job_id_str, "INFO", f"Step 2: Classifying public emails from crawled pages...")
        for page in crawl_result.pages:
            crawled_page_records.append({
                "url": page.url,
                "type": page.page_type,
                "status": page.status_code,
                "title": page.title,
                "emails_found": page.discovered_emails,
                "linkedin_found": page.discovered_linkedin_urls
            })
            for em in page.discovered_emails:
                cat_em = classify_email(em, page_type=page.page_type, source_url=page.url)
                all_categorized_emails.append(cat_em)

        # ----------------------------------------------------
        # Step 3: LinkedIn HR Research
        # ----------------------------------------------------
        add_job_log(job_id_str, "INFO", f"Step 3: Conducting public LinkedIn HR & Recruiter research...")
        
        # 3a. Extract HR names and titles from crawled team/about text
        for page in crawl_result.pages:
            if page.page_type in ("team", "leadership", "people", "careers", "about"):
                found_profiles = LinkedInFinder.extract_hr_profiles_from_text(
                    text=page.text_content,
                    company_name=company_name,
                    page_url=page.url,
                    discovered_linkedin_urls=list(crawl_result.all_linkedin_urls)
                )
                all_discovered_profiles.extend(found_profiles)

        # ----------------------------------------------------
        # Step 4: Public Search & Directory Research
        # ----------------------------------------------------
        if self.enable_public_search:
            add_job_log(job_id_str, "INFO", f"Step 4: Querying public search engines & business indexes...")
            try:
                search_results = await self.searcher.search_company_hr_info(
                    company_name=company_name,
                    website_domain=website,
                    max_results=6
                )
                all_categorized_emails.extend(search_results.get("emails", []))
                all_discovered_profiles.extend(search_results.get("profiles", []))
                raw_audit_details["steps"]["search"] = {
                    "queries": search_results.get("queries", []),
                    "search_emails_found": len(search_results.get("emails", [])),
                    "search_profiles_found": len(search_results.get("profiles", []))
                }
            except Exception as e:
                add_job_log(job_id_str, "WARNING", f"Search query warning: {str(e)}")

        # ----------------------------------------------------
        # Step 5: Verification & Confidence Scoring
        # ----------------------------------------------------
        add_job_log(job_id_str, "INFO", f"Step 5: Verifying emails and computing confidence score...")
        (
            hr_email,
            recruitment_email,
            careers_email,
            general_email,
            best_source,
            base_confidence
        ) = select_best_contacts(all_categorized_emails)

        # Select best HR profile
        hr_name = "Not Publicly Available"
        hr_position = "Not Publicly Available"
        linkedin_profile_url = "Not Publicly Available"

        if all_discovered_profiles:
            # Pick profile with highest confidence
            best_profile = sorted(all_discovered_profiles, key=lambda x: x.confidence, reverse=True)[0]
            hr_name = best_profile.name
            hr_position = best_profile.job_title
            linkedin_profile_url = best_profile.linkedin_profile_url

        # Determine official verification status & final confidence score
        status, confidence_score = ContactVerifier.evaluate_verification_status(
            hr_email=hr_email,
            recruitment_email=recruitment_email,
            careers_email=careers_email,
            general_email=general_email,
            hr_profile_url=linkedin_profile_url,
            source=best_source,
            base_confidence=base_confidence
        )

        raw_audit_details["verification"] = {
            "status": status,
            "confidence_score": confidence_score,
            "best_source": best_source,
            "hr_email_syntax_valid": ContactVerifier.verify_email_syntax(hr_email),
            "all_emails_discovered": [e.model_dump() for e in all_categorized_emails],
            "all_profiles_discovered": [p.model_dump() for p in all_discovered_profiles],
            "pages_summary": crawled_page_records[:15]
        }

        total_elapsed = round(time.time() - start_ts, 2)
        add_job_log(
            job_id_str,
            "INFO",
            f"✔ Completed '{company_name}' in {total_elapsed}s | Status: {status} ({confidence_score}%) | HR: {hr_email} | Recruiter: {hr_name} ({hr_position})",
            {"status": status, "confidence": confidence_score, "hr_email": hr_email}
        )

        return {
            "company_name": company_name,
            "location": location,
            "website": website,
            "linkedin_url": linkedin_url,
            "hr_email": hr_email,
            "recruitment_email": recruitment_email,
            "careers_email": careers_email,
            "general_email": general_email,
            "hr_name": hr_name,
            "hr_position": hr_position,
            "linkedin_profile": linkedin_profile_url,
            "linkedin_profile_url": linkedin_profile_url,
            "confidence_score": confidence_score,
            "source": best_source,
            "status": status,
            "crawled_pages_count": crawl_result.pages_crawled,
            "raw_details": raw_audit_details,
            "raw_details_json": json.dumps(raw_audit_details)
        }
