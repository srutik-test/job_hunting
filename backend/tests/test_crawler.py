"""
Unit tests for the Crawler and Sitemap Parser.
"""
import pytest
from app.services.crawler.page_classifier import classify_page_type, get_url_crawl_priority, is_internal_url
from app.services.crawler.sitemap_parser import SitemapParser
from app.services.crawler.http_crawler import AsyncHttpCrawler


def test_page_classifier_priorities():
    assert classify_page_type("https://example.com/careers") == "careers"
    assert classify_page_type("https://example.com/jobs/openings") == "careers"
    assert classify_page_type("https://example.com/contact-us") == "contact"
    assert classify_page_type("https://example.com/our-team") == "team"
    assert classify_page_type("https://example.com/people") == "people"
    assert classify_page_type("https://example.com/sitemap.xml") == "sitemap"

    assert get_url_crawl_priority("https://example.com/careers") > 5
    assert get_url_crawl_priority("https://example.com/image.png") == -1
    assert is_internal_url("https://example.com", "https://example.com/about") is True
    assert is_internal_url("https://example.com", "https://other.com/about") is False


def test_sitemap_xml_parsing():
    xml_sample = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://aspiresoftserv.com/</loc></url>
        <url><loc>https://aspiresoftserv.com/careers</loc></url>
        <url><loc>https://aspiresoftserv.com/contact-us</loc></url>
        <url><loc>https://aspiresoftserv.com/services/web-development</loc></url>
    </urlset>"""
    
    parser = SitemapParser()
    urls = parser._extract_urls_from_xml(xml_sample, "https://aspiresoftserv.com")
    assert "https://aspiresoftserv.com/careers" in urls
    assert "https://aspiresoftserv.com/contact-us" in urls
    assert len(urls) == 4


def test_email_candidate_validation():
    crawler = AsyncHttpCrawler()
    assert crawler._is_valid_email_candidate("hr@aspiresoftserv.com", "aspiresoftserv.com") is True
    assert crawler._is_valid_email_candidate("style@2x.png", "aspiresoftserv.com") is False
    assert crawler._is_valid_email_candidate("invalid-email", "aspiresoftserv.com") is False
    assert crawler._is_valid_email_candidate("test@example.com", "aspiresoftserv.com") is False
