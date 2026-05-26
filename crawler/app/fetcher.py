"""Async HTML/PDF fetcher with optional Playwright JS rendering + retries.

A single shared httpx.AsyncClient is used for the whole crawl so we keep
HTTP/2 multiplexing, connection pooling, and DNS cache benefits.
"""
from __future__ import annotations
import asyncio
import os
import hashlib
from typing import Optional, Tuple
import httpx
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception_type

from .config import get_settings


def make_client(user_agent: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=30.0, write=15.0, pool=10.0),
        follow_redirects=True,
        headers={
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8,mr;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
        },
        http2=False,  # http/2 needs h2; keep simple/portable
        limits=httpx.Limits(max_connections=64, max_keepalive_connections=32),
    )


_RETRYABLE = (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RemoteProtocolError, httpx.NetworkError)


async def fetch_static(cli: httpx.AsyncClient, url: str) -> Tuple[int, str, bytes]:
    """Return (status, content_type, body_bytes). Retries only on transient errors."""
    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=0.5, max=4),
        retry=retry_if_exception_type(_RETRYABLE),
        reraise=True,
    ):
        with attempt:
            r = await cli.get(url)
            return r.status_code, r.headers.get("content-type", ""), r.content
    return 0, "", b""


async def fetch_pdf(cli: httpx.AsyncClient, url: str, dest_dir: str) -> Optional[str]:
    os.makedirs(dest_dir, exist_ok=True)
    try:
        r = await cli.get(url)
    except Exception:
        return None
    if r.status_code != 200 or not r.content:
        return None
    fname = hashlib.sha1(url.encode()).hexdigest() + ".pdf"
    path = os.path.join(dest_dir, fname)
    with open(path, "wb") as f:
        f.write(r.content)
    return path


async def fetch_dynamic(url: str, user_agent: str) -> Optional[str]:
    """Render page via Playwright. Used as a fallback for JS-heavy pages.

    Spinning up a Chromium per call is expensive, so callers should treat this
    as a last resort gated by a body-size heuristic.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(args=["--no-sandbox"])
            context = await browser.new_context(user_agent=user_agent)
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                # let SPAs settle a bit, but don't wait forever
                try:
                    await page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:
                    pass
                html = await page.content()
            except Exception:
                html = None
            finally:
                await browser.close()
            return html
    except Exception:
        return None


def likely_needs_render(html: str) -> bool:
    """Heuristic: very thin HTML with framework markers is probably JS-rendered."""
    if not html:
        return True
    if len(html) < 2000:
        return True
    lowered = html[:3000].lower()
    markers = ("__next_data__", "ng-app", "data-react", 'id="root"', "<noscript>")
    return any(m in lowered for m in markers) and len(html) < 8000
