"""
Dynamic RAG web scraper — deep recursive BFS crawler with per-page indexing
and content-hash change detection for automatic updates.

Two-layer fallback:
  1. Crawl4AI — BFS recursive crawl (same-domain, unlimited depth)
  2. BeautifulSoup — lightweight fallback for static pages

Features:
  - Deep crawling: follows ALL internal links across the entire website
  - Per-page indexing: each subpage gets its own doc_id for granular updates
  - Content hashing: detects changes and only re-indexes modified pages
  - Automatic updates: scheduler re-crawls periodically and updates only changed content
"""

import asyncio
import hashlib
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
    """Check if link belongs to the same domain (ignoring www prefix)."""
    base_host = urlparse(base_url).netloc.lower().lstrip("www.")
    link_host = urlparse(link).netloc.lower().lstrip("www.")
    return link_host == base_host or link_host == ""


def _normalise_link(base_url: str, href: str) -> Optional[str]:
    """Normalise a relative/absolute link into a canonical URL."""
    try:
        full = urljoin(base_url, href)
        parsed = urlparse(full)
        if parsed.scheme not in ("http", "https"):
            return None
        # Skip pagination, login, and query-heavy URLs
        path = parsed.path.lower()
        skip_patterns = ('/page/', '/login', '/logout', '/wp-admin', '/feed', '/comment', '/tag/', '/author/')
        if any(p in path for p in skip_patterns):
            return None
        if 'page=' in (parsed.query or ''):
            return None
        # Strip fragment and query params for consistency
        clean = parsed._replace(fragment="", query="").geturl()
        # Remove trailing slash for consistency (except root)
        if clean.endswith("/") and parsed.path != "/":
            clean = clean[:-1]
        return clean
    except Exception:
        return None


def _is_skippable_url(url: str) -> bool:
    """Skip non-content URLs (media, login, PDFs, etc.)."""
    path = urlparse(url).path.lower()
    skip_exts = {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
        ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".webm",
        ".zip", ".rar", ".7z", ".tar", ".gz",
        ".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".map",
        ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".pdf",  # Don't crawl PDFs — too slow
    }
    for ext in skip_exts:
        if path.endswith(ext):
            return True
    skip_patterns = (
        "/login", "/signin", "/signup", "/logout", "/wp-admin",
        "/wp-login", "/cart", "/checkout", "/account", "/api/",
        "/cgi-bin/", "/share", "/print", "javascript:", "mailto:",
        "/feed", "/rss", "/sitemap", "/robots.txt",
        "/notices", "/notice", "/circular",  # Skip notice/circular pages (pagination traps)
    )
    for pat in skip_patterns:
        if pat in url.lower():
            return True
    return False


def _extract_internal_links(result, base_url: str) -> list[str]:
    """Extract internal links from a Crawl4AI result object."""
    links = []
    raw = getattr(result, "links", {}) or {}
    for entry in raw.get("internal", []):
        href = entry.get("href", "") if isinstance(entry, dict) else str(entry)
        url = _normalise_link(base_url, href)
        if url and _same_domain(base_url, url) and not _is_skippable_url(url):
            links.append(url)
    return links


def content_hash(text: str) -> str:
    """Generate a SHA-256 hash of content for change detection."""
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


# ─────────────────────────────────────────────────────────────────
# Primary: Crawl4AI — deep recursive BFS
# ─────────────────────────────────────────────────────────────────

async def _crawl4ai_recursive(
    seed_url: str,
    max_depth: int = 2,
    max_pages: int = 15,
) -> list[dict]:
    """
    Deep BFS crawl returning per-page results.
    Returns list of {url, content, title, depth} dicts.
    """
    from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig

    cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS)

    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(seed_url, 0)])
    pages: list[dict] = []

    async with AsyncWebCrawler() as crawler:
        while queue and len(visited) < max_pages:
            url, depth = queue.popleft()
            if url in visited:
                continue
            visited.add(url)

            try:
                result = await crawler.arun(url=url, config=cfg)
            except Exception as e:
                log.warning("crawl4ai_page_failed", url=url, error=str(e)[:100])
                continue

            if not result or not result.success:
                continue

            page_content = result.markdown or ""
            if len(page_content) > 100:
                # Extract title from the result
                title = ""
                if hasattr(result, "metadata") and result.metadata:
                    title = result.metadata.get("title", "")
                if not title and hasattr(result, "title"):
                    title = result.title or ""

                pages.append({
                    "url": url,
                    "content": page_content,
                    "title": title or url,
                    "depth": depth,
                })
                log.info("crawl4ai_page_ok", url=url, depth=depth, chars=len(page_content))

            # Follow ALL internal links up to max_depth
            if depth < max_depth and len(visited) < max_pages:
                for link in _extract_internal_links(result, seed_url):
                    if link not in visited:
                        queue.append((link, depth + 1))

    if not pages:
        raise ValueError("Crawl4AI returned no usable content")

    log.info("crawl4ai_complete", seed=seed_url, pages=len(pages), total_visited=len(visited))
    return pages


def _run_crawl4ai_in_thread(url: str, max_depth: int = 2, max_pages: int = 15) -> list[dict]:
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

    timeout = max(90, max_pages * 8)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(thread_target)
        return future.result(timeout=timeout)


# ─────────────────────────────────────────────────────────────────
# Fallback: BeautifulSoup — BFS with requests
# ─────────────────────────────────────────────────────────────────

def _bs4_deep_scrape(seed_url: str, max_depth: int = 2, max_pages: int = 15) -> list[dict]:
    """
    BFS crawl using requests + BeautifulSoup as fallback.
    Returns per-page results like Crawl4AI.
    """
    import requests
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        )
    }

    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(seed_url, 0)])
    pages: list[dict] = []

    while queue and len(visited) < max_pages:
        url, depth = queue.popleft()
        if url in visited:
            continue
        visited.add(url)

        try:
            resp = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
            resp.raise_for_status()
        except Exception as e:
            log.warning("bs4_page_failed", url=url, error=str(e)[:100])
            continue

        if "text/html" not in resp.headers.get("content-type", ""):
            continue

        soup = BeautifulSoup(resp.text, "html.parser")

        # Extract title
        title = soup.title.string.strip() if soup.title and soup.title.string else url

        # Clean and extract text
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]):
            tag.decompose()

        text = " ".join(
            el.get_text(" ", strip=True)
            for el in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th", "blockquote", "article", "section", "main", "div"])
        )
        cleaned = " ".join(text.split())

        if len(cleaned) > 100:
            pages.append({
                "url": url,
                "content": cleaned,
                "title": title,
                "depth": depth,
            })
            log.info("bs4_page_ok", url=url, depth=depth, chars=len(cleaned))

        # Extract and follow internal links
        if depth < max_depth and len(visited) < max_pages:
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                link = _normalise_link(url, href)
                if link and _same_domain(seed_url, link) and link not in visited and not _is_skippable_url(link):
                    queue.append((link, depth + 1))

    log.info("bs4_complete", seed=seed_url, pages=len(pages), total_visited=len(visited))
    return pages


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
# Public entry-points
# ─────────────────────────────────────────────────────────────────

def scrape_url(url: str, max_depth: int = 2, max_pages: int = 15) -> str:
    """
    Scrape a URL recursively (BFS). Tries Crawl4AI first, falls back to BS4.
    Returns cleaned plain text (all pages concatenated) ready for chunking.
    """
    pages = scrape_url_pages(url, max_depth=max_depth, max_pages=max_pages)
    combined = "\n\n".join(f"<!-- PAGE: {p['url']} -->\n{p['content']}" for p in pages)
    return clean_scraped_text(combined)


def scrape_url_pages(url: str, max_depth: int = 2, max_pages: int = 15) -> list[dict]:
    """
    Scrape a URL recursively and return per-page results.
    Each result: {url, content, title, depth, content_hash}
    """
    try:
        pages = _run_crawl4ai_in_thread(url, max_depth=max_depth, max_pages=max_pages)
    except Exception as e:
        log.warning("crawl4ai_failed_fallback_bs4", url=url, error=str(e)[:100])
        pages = _bs4_deep_scrape(url, max_depth=max_depth, max_pages=max_pages)

    # Clean content and add content hash for change detection
    for page in pages:
        page["content"] = clean_scraped_text(page["content"])
        page["content_hash"] = content_hash(page["content"])

    return pages
