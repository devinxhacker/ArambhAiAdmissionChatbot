"""Live web search → fetch → clean → chunk pipeline.

Used by the `live_search` agent node so the chatbot can answer questions about
colleges/data we haven't crawled yet, with real citations to the original URLs.

Provider chain:
- DuckDuckGo (lib)   - free, but rate-limits aggressively
- DuckDuckGo (HTML)  - free, scrapes html.duckduckgo.com
- Bing (HTML)        - free, scrapes bing.com/search
- Wikipedia REST     - free, last-resort knowledge base

Each provider is tried in order with a small retry on transient errors. The
first non-empty result wins.

Two-phase fetching:
- Phase 1: fetch each search hit's HTML/PDF, extract text, chunk.
- Phase 2: from each HTML page, harvest in-domain PDF links (brochures, fee
  structures, cutoff sheets) and fetch those too. This is the bit that lets
  the bot find concrete numbers that Google's snippets don't show.

Caching:
- Search results: Redis 30 min TTL per (query, k).
- Fetched chunks: Redis 1 h TTL per URL.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import random
import re
from typing import Optional
from urllib.parse import parse_qs, quote_plus, urljoin, urlparse

import httpx

from ..core.config import get_settings
from ..core.logging import get_logger
from .chunker import chunk_text
from .cleaner import clean_html

log = get_logger("web_search")

_USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
]


def _ua() -> str:
    return random.choice(_USER_AGENTS)


# ─────────────────── Redis cache helpers ───────────────────
def _cache_key(prefix: str, ident: str) -> str:
    h = hashlib.sha1(ident.encode("utf-8")).hexdigest()
    return f"{prefix}:{h}"


async def _cache_get(key: str) -> Optional[object]:
    try:
        import redis.asyncio as redis_async
        cli = redis_async.from_url(get_settings().redis_url, decode_responses=True)
        try:
            raw = await cli.get(key)
            return json.loads(raw) if raw else None
        finally:
            await cli.aclose()
    except Exception:
        return None


async def _cache_set(key: str, value: object, ttl: int) -> None:
    try:
        import redis.asyncio as redis_async
        cli = redis_async.from_url(get_settings().redis_url, decode_responses=True)
        try:
            await cli.set(key, json.dumps(value), ex=ttl)
        finally:
            await cli.aclose()
    except Exception:
        return


# ─────────────────── Query expansion ───────────────────
_INSTITUTIONAL_TLDS = (".ac.in", ".edu.in", ".edu", ".gov.in", ".nic.in")


def _expand_query(query: str) -> str:
    """Bias toward Indian institutional sources for college queries.

    We don't transform the query if the user already used a `site:` operator or
    if it's a generic non-college question.
    """
    q = (query or "").strip()
    if "site:" in q.lower():
        return q
    college_signals = (
        "college", "university", "iit ", " iit", "nit ", " nit", "iiit", "engineering",
        "polytechnic", "btech", "b.tech", "fees", "cutoff", "cut off", "placement",
        "scholarship", "hostel", "admission", "mhtcet", "mht-cet", "jee", "neet",
    )
    if not any(s in q.lower() for s in college_signals):
        return q
    return q  # keep original — stronger biasing in the search query itself caused some providers to fail.


# ─────────────────── Search providers ───────────────────
def _retry_decorator():
    """Return a coroutine wrapper that retries on transient errors with jitter."""
    async def runner(coro_factory, attempts: int = 2):
        last_exc = None
        for i in range(attempts):
            try:
                return await coro_factory()
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                await asyncio.sleep(0.4 + random.random() * 0.6)
        if last_exc:
            log.info("provider_retry_exhausted", error=str(last_exc)[:120])
        return []
    return runner


async def _search_duckduckgo(query: str, k: int) -> list[dict]:
    def _sync() -> list[dict]:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return []
        try:
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=k, safesearch="moderate"))
        except Exception as exc:  # noqa: BLE001
            log.info("ddgs_search_failed", error=str(exc)[:120])
            return []

    raw = await asyncio.to_thread(_sync)
    out: list[dict] = []
    for h in raw:
        url = h.get("href") or h.get("url")
        title = h.get("title") or ""
        snippet = h.get("body") or h.get("snippet") or ""
        if not url:
            continue
        out.append({"url": url, "title": title.strip(), "snippet": snippet.strip()})
    return out


async def _search_ddg_html(query: str, k: int) -> list[dict]:
    from bs4 import BeautifulSoup
    url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
    headers = {"User-Agent": _ua(), "Accept": "text/html,application/xhtml+xml"}
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=headers, follow_redirects=True) as cli:
            r = await cli.get(url)
        if r.status_code != 200:
            return []
    except Exception as exc:
        log.info("ddg_html_failed", error=str(exc)[:120])
        return []

    soup = BeautifulSoup(r.text, "lxml")
    out: list[dict] = []
    for a in soup.select("a.result__a")[: k * 3]:
        href = a.get("href", "")
        try:
            qs = parse_qs(urlparse(href).query)
            real = qs.get("uddg", [href])[0]
        except Exception:
            real = href
        if not real or not real.startswith(("http://", "https://")):
            continue
        host = urlparse(real).netloc.lower()
        if host in {"duckduckgo.com", "links.duckduckgo.com"} or "y.js" in real:
            continue
        if host.startswith("ad.") or "doubleclick" in host or "googleadservices" in host:
            continue
        title = a.get_text(strip=True)
        snippet_el = a.find_parent("div", class_="result__body")
        snippet = ""
        if snippet_el:
            sn = snippet_el.select_one(".result__snippet")
            if sn:
                snippet = sn.get_text(" ", strip=True)
        out.append({"url": real, "title": title, "snippet": snippet})
        if len(out) >= k:
            break
    return out


async def _search_bing_html(query: str, k: int) -> list[dict]:
    """Scrape bing.com/search HTML. No API key. Reasonably stable."""
    from bs4 import BeautifulSoup
    url = f"https://www.bing.com/search?q={quote_plus(query)}&count={max(k, 10)}&setlang=en-IN"
    headers = {
        "User-Agent": _ua(),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=headers, follow_redirects=True) as cli:
            r = await cli.get(url)
        if r.status_code != 200:
            return []
    except Exception as exc:
        log.info("bing_html_failed", error=str(exc)[:120])
        return []

    soup = BeautifulSoup(r.text, "lxml")
    out: list[dict] = []

    for li in soup.select("li.b_algo")[: k * 3]:
        a = li.select_one("h2 a")
        if not a:
            continue
        href = (a.get("href") or "").strip()
        if not href.startswith(("http://", "https://")):
            continue
        host = urlparse(href).netloc.lower()
        if "bing.com" in host or "msn.com" in host or "go.microsoft.com" in host:
            continue
        title = a.get_text(strip=True)
        snippet_el = li.select_one(".b_caption p")
        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
        out.append({"url": href, "title": title, "snippet": snippet})
        if len(out) >= k:
            break

    return out


async def _search_wikipedia(query: str, k: int) -> list[dict]:
    headers = {"User-Agent": _ua(), "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as cli:
            r = await cli.get(
                "https://en.wikipedia.org/w/rest.php/v1/search/page",
                params={"q": query, "limit": k},
            )
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []

    out: list[dict] = []
    for p in (data.get("pages") or [])[:k]:
        slug = p.get("key")
        title = p.get("title") or slug
        excerpt = p.get("excerpt") or p.get("description") or ""
        if not slug:
            continue
        out.append({
            "url": f"https://en.wikipedia.org/wiki/{slug}",
            "title": title,
            "snippet": excerpt,
        })
    return out


async def search(query: str, k: int = 5) -> list[dict]:
    """Provider chain. Returns the first non-empty list."""
    s = get_settings()
    expanded = _expand_query(query)
    cache_id = f"{s.live_search_provider}:{k}:{expanded}"
    key = _cache_key("web_search", cache_id)

    cached = await _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    chain: list = []
    provider = s.live_search_provider.lower()
    if provider in ("auto", "duckduckgo"):
        chain = [_search_duckduckgo, _search_ddg_html, _search_bing_html, _search_wikipedia]
    elif provider == "bing":
        chain = [_search_bing_html, _search_ddg_html, _search_wikipedia]
    elif provider == "ddg_html":
        chain = [_search_ddg_html, _search_bing_html, _search_wikipedia]
    elif provider == "wikipedia":
        chain = [_search_wikipedia]
    else:
        log.warning("unknown_search_provider", provider=provider)
        chain = [_search_ddg_html, _search_bing_html, _search_wikipedia]

    runner = _retry_decorator()

    results: list[dict] = []
    for fn in chain:
        results = await runner(lambda fn=fn: fn(expanded, k), attempts=2)
        if results:
            log.info("provider_hit", provider=fn.__name__, n=len(results))
            break

    await _cache_set(key, results, ttl=1800)
    return results


# ─────────────────── Fetch + clean ───────────────────
_MAX_BODY_BYTES = 1024 * 1024  # 1 MB cap per HTML page
_MAX_PDF_BYTES = 6 * 1024 * 1024  # 6 MB cap per PDF


def _looks_like_pdf(url: str, content_type: str) -> bool:
    if "pdf" in (content_type or "").lower():
        return True
    return url.lower().split("?", 1)[0].endswith(".pdf")


def _pdf_text_from_bytes(data: bytes) -> str:
    """pdfplumber for tables + pypdf as fallback. Both run sync; caller wraps in thread."""
    text_parts: list[str] = []
    try:
        import io
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                t = page.extract_text() or ""
                text_parts.append(t)
                for table in page.extract_tables() or []:
                    rows = ["\t".join([c or "" for c in row]) for row in table]
                    if rows:
                        text_parts.append("\n".join(rows))
    except Exception:
        pass

    if not "".join(text_parts).strip():
        try:
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(data))
            text_parts = [(p.extract_text() or "") for p in reader.pages]
        except Exception:
            pass

    return "\n\n".join(text_parts)


def _harvest_pdf_links(base_url: str, html: str) -> list[str]:
    """Find PDF links inside an HTML page so we can fetch college brochures /
    fee structures / cutoff sheets. Stays inside the same registrable host."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "lxml")
    base_host = urlparse(base_url).netloc.lower().lstrip("www.")
    out: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href:
            continue
        absu = urljoin(base_url, href)
        if not absu.lower().split("?", 1)[0].endswith(".pdf"):
            continue
        # keep within same registrable host so we don't fan out across the web
        host = urlparse(absu).netloc.lower().lstrip("www.")
        if host and (host == base_host or host.endswith("." + base_host) or base_host.endswith("." + host)):
            out.add(absu.split("#")[0])
        else:
            # Allow a sibling host on institutional TLDs (e.g. brochure.iitb.ac.in)
            if any(host.endswith(t) for t in _INSTITUTIONAL_TLDS):
                out.add(absu.split("#")[0])
    return list(out)[:6]  # cap PDFs per page


def _is_useful_pdf_text(text: str) -> bool:
    if not text:
        return False
    s = text.strip()
    if len(s) < 120:
        return False
    # Heuristic: the text should contain digits (fee/cutoff PDFs always do)
    return bool(re.search(r"\d", s))


async def _fetch_html_bytes(cli: httpx.AsyncClient, url: str, timeout: float) -> tuple[bytes, str]:
    r = await cli.get(url, timeout=timeout)
    if r.status_code != 200:
        return b"", ""
    return r.content, r.headers.get("content-type", "")


async def _build_chunks(url: str, hit: dict, text: str, source_label: str) -> list[dict]:
    chunks = chunk_text(text, chunk_size=900, chunk_overlap=120)
    if source_label == "pdf":
        chunks = chunks[:10]  # PDFs deserve more chunks (more dense content)
    else:
        chunks = chunks[:6]
    out: list[dict] = []
    host = urlparse(url).netloc.lower()
    title = hit.get("title") or host
    if source_label == "pdf" and not hit.get("title_from_search"):
        # Promote PDF filename into the title for readability
        from os.path import basename
        from urllib.parse import unquote
        title = unquote(basename(urlparse(url).path)) or title
    for i, c in enumerate(chunks):
        out.append({
            "id": f"web::{hashlib.sha1(url.encode()).hexdigest()}::{source_label}::{i}",
            "doc_id": f"web::{hashlib.sha1(url.encode()).hexdigest()}",
            "text": c,
            "title": title,
            "source_url": url,
            "source_type": "web",
            "snippet": hit.get("snippet"),
            "host": host,
            "chunk_index": i,
            "format": source_label,  # "html" | "pdf"
        })
    return out


async def _fetch_one_html(cli: httpx.AsyncClient, hit: dict, timeout: float) -> tuple[list[dict], list[str]]:
    """Returns (html_chunks, pdf_links_to_follow).
    For PDFs: don't download/parse — just return metadata with the direct link."""
    url = hit["url"]
    cache_key = _cache_key("web_chunks", url)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return cached, []

    # If URL looks like a PDF, don't download it — just create a metadata chunk with the link
    if url.lower().split("?", 1)[0].endswith(".pdf"):
        from os.path import basename
        from urllib.parse import unquote
        pdf_name = unquote(basename(urlparse(url).path)) or "Document"
        host = urlparse(url).netloc.lower()
        title = hit.get("title") or pdf_name
        snippet = hit.get("snippet") or f"PDF document: {pdf_name}"
        chunks = [{
            "id": f"web::{hashlib.sha1(url.encode()).hexdigest()}::pdf::0",
            "doc_id": f"web::{hashlib.sha1(url.encode()).hexdigest()}",
            "text": f"{title}\n\nThis is a PDF document available at: {url}\n\n{snippet}",
            "title": title,
            "source_url": url,
            "source_type": "web",
            "snippet": snippet,
            "host": host,
            "chunk_index": 0,
            "format": "pdf",
        }]
        await _cache_set(cache_key, chunks, ttl=3600)
        return chunks, []

    try:
        body, ctype = await _fetch_html_bytes(cli, url, timeout)
    except Exception as exc:
        log.info("web_fetch_failed", url=url, error=str(exc)[:120])
        return [], []

    if not body:
        return [], []

    # If response is actually a PDF (content-type check), don't parse — return link
    if _looks_like_pdf(url, ctype):
        from os.path import basename
        from urllib.parse import unquote
        pdf_name = unquote(basename(urlparse(url).path)) or "Document"
        host = urlparse(url).netloc.lower()
        title = hit.get("title") or pdf_name
        snippet = hit.get("snippet") or f"PDF document: {pdf_name}"
        chunks = [{
            "id": f"web::{hashlib.sha1(url.encode()).hexdigest()}::pdf::0",
            "doc_id": f"web::{hashlib.sha1(url.encode()).hexdigest()}",
            "text": f"{title}\n\nThis is a PDF document available at: {url}\n\n{snippet}",
            "title": title,
            "source_url": url,
            "source_type": "web",
            "snippet": snippet,
            "host": host,
            "chunk_index": 0,
            "format": "pdf",
        }]
        await _cache_set(cache_key, chunks, ttl=3600)
        return chunks, []

    body = body[:_MAX_BODY_BYTES]
    try:
        html = body.decode("utf-8", errors="ignore")
    except Exception:
        html = ""
    text = await asyncio.to_thread(clean_html, html) if html else ""
    if not text or len(text.strip()) < 80:
        chunks = []
    else:
        chunks = await _build_chunks(url, hit, text, "html")

    # Collect PDF links but don't follow them — just note them
    pdf_links = await asyncio.to_thread(_harvest_pdf_links, url, html) if html else []
    if chunks:
        await _cache_set(cache_key, chunks, ttl=3600)
    return chunks, pdf_links


async def _fetch_one_pdf(cli: httpx.AsyncClient, url: str, timeout: float, parent_hit: dict) -> list[dict]:
    cache_key = _cache_key("web_chunks", url)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    try:
        r = await cli.get(url, timeout=timeout)
    except Exception as exc:
        log.info("pdf_fetch_failed", url=url, error=str(exc)[:120])
        return []
    if r.status_code != 200 or not r.content:
        return []

    try:
        text = await asyncio.to_thread(_pdf_text_from_bytes, r.content[:_MAX_PDF_BYTES])
    except Exception:
        return []
    if not _is_useful_pdf_text(text):
        return []

    hit = {"title": parent_hit.get("title"), "snippet": parent_hit.get("snippet")}
    chunks = await _build_chunks(url, hit, text, "pdf")
    await _cache_set(cache_key, chunks, ttl=3600)
    return chunks


async def fetch_and_chunk(
    hits: list[dict],
    *,
    follow_pdfs: bool = True,
    max_concurrent: int = 6,
    timeout: float | None = None,
) -> list[dict]:
    s = get_settings()
    timeout = timeout or s.live_search_fetch_timeout
    if not hits:
        return []

    sem = asyncio.Semaphore(max_concurrent)
    headers = {
        "User-Agent": _ua(),
        "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
    }
    async with httpx.AsyncClient(
        headers=headers,
        follow_redirects=True,
        timeout=httpx.Timeout(connect=8.0, read=timeout, write=8.0, pool=8.0),
        limits=httpx.Limits(max_connections=12, max_keepalive_connections=8),
    ) as cli:
        # ─── Phase 1: fetch each search hit ───
        async def _bound_html(hit: dict) -> tuple[list[dict], list[str], dict]:
            async with sem:
                chunks, pdfs = await _fetch_one_html(cli, hit, timeout)
                return chunks, pdfs, hit

        phase1 = await asyncio.gather(*[_bound_html(h) for h in hits], return_exceptions=False)

        all_chunks: list[dict] = []
        pdf_jobs: list[tuple[str, dict]] = []
        seen_pdfs: set[str] = set()
        for chunks, pdfs, hit in phase1:
            all_chunks.extend(chunks)
            if follow_pdfs:
                for pdf_url in pdfs:
                    if pdf_url in seen_pdfs:
                        continue
                    seen_pdfs.add(pdf_url)
                    pdf_jobs.append((pdf_url, hit))

        # cap PDF fan-out so a single noisy page doesn't spawn 50 fetches
        pdf_jobs = pdf_jobs[: s.live_search_pdf_max]

        if pdf_jobs:
            log.info("web_pdf_followup", count=len(pdf_jobs))

            async def _bound_pdf(item: tuple[str, dict]) -> list[dict]:
                async with sem:
                    return await _fetch_one_pdf(cli, item[0], timeout, item[1])

            phase2 = await asyncio.gather(*[_bound_pdf(j) for j in pdf_jobs], return_exceptions=False)
            for chunks in phase2:
                all_chunks.extend(chunks)

    return all_chunks


# ─────────────────── Public entry point ───────────────────
async def live_web_chunks(query: str, k: int | None = None) -> list[dict]:
    s = get_settings()
    k = k or s.live_search_top_k
    if not query or not query.strip():
        return []

    q = re.sub(r"\s+", " ", query).strip()
    if len(q) > 256:
        q = q[:256]

    hits = await search(q, k=k)
    if not hits:
        log.info("web_search_no_results", query=q)
        return []

    log.info("web_search_hits", n=len(hits), query=q)

    # Always use fast mode: fetch max 3 pages, never follow PDFs, short timeout.
    # Use search snippets as lightweight grounding for remaining hits.
    max_fetch = min(len(hits), 3)
    timeout = 6.0

    chunks = await fetch_and_chunk(
        hits[:max_fetch],
        follow_pdfs=False,
        max_concurrent=4,
        timeout=timeout,
    )

    # Also use search snippets as lightweight chunks for ALL hits (fast grounding)
    for hit in hits:
        snippet = hit.get("snippet", "").strip()
        if snippet and len(snippet) > 40:
            host = urlparse(hit["url"]).netloc.lower()
            chunks.append({
                "id": f"web::snippet::{hashlib.sha1(hit['url'].encode()).hexdigest()}",
                "doc_id": f"web::snippet::{hashlib.sha1(hit['url'].encode()).hexdigest()}",
                "text": snippet,
                "title": hit.get("title") or host,
                "source_url": hit["url"],
                "source_type": "web",
                "snippet": snippet,
                "host": host,
                "chunk_index": 0,
                "format": "snippet",
            })

    log.info("web_chunks_extracted", chunks=len(chunks))
    return chunks
