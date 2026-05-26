"""HTML link extraction and content cleaning."""
from __future__ import annotations
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import trafilatura
import ftfy


def extract_links(base_url: str, html: str, allowed_domains: list[str] | None = None) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    out: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "javascript:")):
            continue
        absu = urljoin(base_url, href)
        u = urlparse(absu)
        if u.scheme not in ("http", "https"):
            continue
        if allowed_domains and not any(d in u.netloc for d in allowed_domains):
            continue
        out.add(absu.split("#")[0])
    return sorted(out)


def extract_pdf_links(base_url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    out: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.lower().endswith(".pdf"):
            out.add(urljoin(base_url, href))
    return sorted(out)


def clean(html: str) -> tuple[str, dict]:
    text = trafilatura.extract(html, include_tables=True, include_comments=False)
    if not text or len(text.strip()) < 50:
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
            tag.decompose()
        text = soup.get_text("\n")
    text = ftfy.fix_text(text or "")

    soup = BeautifulSoup(html, "lxml")
    title = (soup.title.string.strip() if soup.title and soup.title.string else "")
    meta = {
        "title": title,
        "lang": soup.html.get("lang") if soup.html else None,
        "description": (soup.find("meta", attrs={"name": "description"}) or {}).get("content")
        if soup.find("meta", attrs={"name": "description"}) else None,
    }
    return text, meta
