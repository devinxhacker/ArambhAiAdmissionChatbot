"""URL canonicalization + filtering for the crawler.

The goal is to reduce duplicate work (same page with different query/fragment),
keep the crawl inside the seed domain, and skip obvious non-content URLs
(media files, calendars, login forms, etc.) without ever fetching them.
"""
from __future__ import annotations
import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

# Tracking / session params we should drop so /page?utm_source=x and
# /page resolve to the same canonical form.
_DROP_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "gclid", "fbclid", "mc_eid", "mc_cid", "ref", "ref_src", "_ga", "yclid",
    "PHPSESSID", "JSESSIONID", "sessionid", "sid",
}

# File extensions we never want to crawl (we DO crawl PDFs separately).
_SKIP_EXTS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".webm", ".m4a",
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".map",
}

# Path regexes we treat as "definitely not content"
_SKIP_PATH = re.compile(
    r"/(login|signin|signup|register|logout|wp-admin|wp-login|cart|checkout|"
    r"account|profile|settings|password|api/|cgi-bin/|share|print)(/|$|\?)",
    re.IGNORECASE,
)


def canonicalize(url: str) -> str:
    """Normalise URL: lowercase scheme/host, strip fragment, drop tracking params,
    sort remaining query params, drop trailing slash on path."""
    try:
        p = urlparse(url.strip())
    except Exception:
        return url
    if not p.scheme or not p.netloc:
        return url

    scheme = p.scheme.lower()
    if scheme not in ("http", "https"):
        return url
    netloc = p.netloc.lower()
    # Drop default ports
    if netloc.endswith(":80") and scheme == "http":
        netloc = netloc[:-3]
    if netloc.endswith(":443") and scheme == "https":
        netloc = netloc[:-4]

    path = p.path or "/"
    if path != "/" and path.endswith("/"):
        path = path[:-1]

    # Filter and sort query params for deterministic canonical form.
    kept = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k not in _DROP_PARAMS]
    kept.sort()
    query = urlencode(kept, doseq=True)

    return urlunparse((scheme, netloc, path, "", query, ""))


def is_pdf_url(url: str) -> bool:
    return url.lower().split("?", 1)[0].endswith(".pdf")


def is_skippable(url: str) -> bool:
    """Cheap pre-filter so we don't even queue obvious junk."""
    try:
        p = urlparse(url)
    except Exception:
        return True
    if not p.scheme or not p.netloc:
        return True
    path_lower = p.path.lower()
    for ext in _SKIP_EXTS:
        if path_lower.endswith(ext):
            return True
    if _SKIP_PATH.search(p.path or ""):
        return True
    return False


def host_of(url: str) -> str:
    return urlparse(url).netloc.lower()


def registrable_domain(host: str) -> str:
    """Strip 'www.' so seed `www.example.edu` and discovered `example.edu` match."""
    return host[4:] if host.startswith("www.") else host


def in_scope(url: str, seed_hosts: set[str]) -> bool:
    """A URL is in scope if its registrable host equals (or is a subdomain of)
    any of the seed hosts. e.g. seeding example.edu allows admissions.example.edu."""
    h = registrable_domain(host_of(url))
    for seed in seed_hosts:
        seed = registrable_domain(seed)
        if h == seed or h.endswith("." + seed):
            return True
    return False
