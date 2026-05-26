"""
Dynamic RAG web scraper — integrated from teammate's Dynamic_Rag project.

Two-layer fallback:
  1. Crawl4AI — BFS recursive crawl (same-domain, depth + page capped)
  2. BeautifulSoup — lightweight fallback for static pages

When an admin adds a URL via the dashboard, this module scrapes it immediately
and returns cleaned text ready for chunking + embedding into Qdrant.
"""

import asyncio
import re
import sys
import concurrent.futures
from collections import deque
from urllib.parse import urljoin, urlparse
from typing import Optional

from ..core.logging import get_logger

log = get_logger("web_scraper")


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _same_domain(base_url: str, link: str) -> bool:
    base_host = urlparse(base_url).netloc.lower().lstrip("www.")
    link_host = urlparse(link).netloc.lower().lstrip("www.")
    return link_host == base_host or link_host == ""


def _normalise_link(base_url: str, href: str) -> Optional[str]:
    try:
        full = urljoin(base_url, href)
        parsed = urlparse(full)
        if parsed.scheme not in ("http", "https"):
            return None
        return parsed._replace(fragment="").geturl()
    except Exception:
        return None


def _extract_internal_links(result, base_url: str) -> list[str]:
    links = []
    raw = getattr(result, "links", {}) or {}
    for entry in raw.get("internal", []):
        href = entry.get("href", "") if isinstance(entry, dict) else str(entry)
        url = _normalise_link(base_url, href)
        if url and _same_domain(base_url, url):
            links.append(url)
    return links


# ─────────────────────────────────────────────────────────────────
# Primary: Crawl4AI — recursive BFS
# ─────────────────────────────────────────────────────────────────

async def _crawl4ai_recursive(
    seed_url: str,
    max_depth: int = 2,
    max_pages: int = 15,
) -> str:
    from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig

    cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS)

    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(seed_url, 0)])
    pages_text: list[str] = []

    async with AsyncWebCrawler() as crawler:
        while queue and len(visited) < max_pages:
            url, depth = queue.popleft()
            if url in visited:
                continue
            visited.add(url)

            try:
                result = await crawler.arun(url=url, config=cfg)
            except Exception as e:
                log.warning("crawl4ai_page_failed", url=url, error=str(e))
                continue

            if not result or not result.success:
                continue

            content = result.markdown or ""
            if len(content) > 100:
                pages_text.append(f"<!-- PAGE: {url} -->\n{content}")
                log.info("crawl4ai_page_ok", url=url, depth=depth, chars=len(content))

            if depth < max_depth and len(visited) < max_pages:
                for link in _extract_internal_links(result, seed_url):
                    if link not in visited:
                        queue.append((link, depth + 1))

    if not pages_text:
        raise ValueError("Crawl4AI returned no usable content")

    combined = "\n\n".join(pages_text)
    log.info("crawl4ai_complete", seed=seed_url, pages=len(pages_text), chars=len(combined))
    return combined


def _run_crawl4ai_in_thread(url: str, max_depth: int = 2, max_pages: int = 15) -> str:
    """Run Crawl4AI in a dedicated thread with its own event loop."""
    async def _run():
        return await _crawl4ai_recursive(url, max_depth, max_pages)

    def thread_target():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(_run())
        finally:
            loop.close()

    timeout = max(120, max_pages * 10)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(thread_target)
        return future.result(timeout=timeout)


# ─────────────────────────────────────────────────────────────────
# Fallback: BeautifulSoup (single page)
# ─────────────────────────────────────────────────────────────────

def _bs4_scrape(url: str) -> str:
    import requests
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=25)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    text = " ".join(
        el.get_text(" ", strip=True)
        for el in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "li", "td", "th", "blockquote"])
    )
    cleaned = " ".join(text.split())
    log.info("bs4_scrape_ok", url=url, chars=len(cleaned))
    return cleaned


# ─────────────────────────────────────────────────────────────────
# Text Cleaner
# ─────────────────────────────────────────────────────────────────

def clean_scraped_text(raw: str) -> str:
    """Normalise markdown artefacts, extra whitespace, and control chars."""
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", raw)   # markdown links → anchor text
    text = re.sub(r"#{1,6}\s*", "", text)                   # markdown headers
    text = re.sub(r"[*_`~>|\\]{2,}", " ", text)             # repeated markdown symbols
    text = re.sub(r"\n{3,}", "\n\n", text)                  # collapse blank lines
    text = re.sub(r"[ \t]{2,}", " ", text)                  # collapse spaces
    return text.strip()


# ─────────────────────────────────────────────────────────────────
# Public entry-point
# ─────────────────────────────────────────────────────────────────

def scrape_url(url: str, max_depth: int = 2, max_pages: int = 15) -> str:
    """
    Scrape a URL recursively. Tries Crawl4AI BFS first, falls back to BS4.
    Returns cleaned plain text ready for chunking.
    """
    try:
        raw = _run_crawl4ai_in_thread(url, max_depth=max_depth, max_pages=max_pages)
    except Exception as e:
        log.warning("crawl4ai_failed_fallback_bs4", url=url, error=str(e))
        raw = _bs4_scrape(url)

    return clean_scraped_text(raw)
