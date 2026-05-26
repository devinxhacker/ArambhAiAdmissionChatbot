"""Async breadth-first crawler that goes deep within the seed domain.

Design highlights:
- One shared httpx.AsyncClient with a connection pool (HTTP/1.1 keep-alive)
- N parallel fetch workers consuming from an asyncio.Queue (bounded)
- M parallel ingest workers consuming from a separate asyncio.Queue
- HTML cleaning + PDF text extraction run in a thread pool so they don't
  block the event loop
- Sitemap.xml is parsed up-front to seed the frontier with hundreds of URLs
- URL canonicalization + per-job seen-set + content-hash dedup
- max_pages hard cap so a runaway site doesn't drown ingestion
- Per-page progress events pushed to Redis for live UI streaming
- Mongo job stats updated periodically for crash-safe progress
"""
from __future__ import annotations
import asyncio
import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

import httpx

from .config import get_settings
from .fetcher import fetch_static, fetch_dynamic, fetch_pdf, make_client, likely_needs_render
from .frontier import (
    acquire_slot,
    add_seen,
    add_content_hash,
    cleanup_job,
    push_event,
)
from .ingest_client import apush_to_ingest
from .parser import clean, extract_links, extract_pdf_links
from .pdf_extractor import extract_pdf_text
from .robots import allowed
from .sitemap import fetch_sitemaps
from .url_filter import canonicalize, in_scope, is_pdf_url, is_skippable, host_of


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ───────────────────────────── State helpers ─────────────────────────────
class CrawlState:
    """Mutable counters shared across coroutines (single event loop -> no lock needed)."""

    __slots__ = (
        "pages_crawled", "pages_indexed", "pdfs_indexed",
        "errors", "started", "frontier_size", "max_pages",
    )

    def __init__(self, max_pages: int) -> None:
        self.pages_crawled = 0
        self.pages_indexed = 0
        self.pdfs_indexed = 0
        self.errors: list[str] = []
        self.started = time.time()
        self.frontier_size = 0
        self.max_pages = max_pages

    def stats(self) -> dict:
        return {
            "pages_crawled": self.pages_crawled,
            "pages_indexed": self.pages_indexed,
            "pdfs_indexed": self.pdfs_indexed,
            "errors": self.errors[-20:],
            "frontier_size": self.frontier_size,
            "elapsed_sec": int(time.time() - self.started),
        }


# ───────────────────────────── Main entry ─────────────────────────────
async def crawl_source(
    source: dict,
    *,
    job_id: str,
    on_progress=None,
) -> dict:
    """Crawl a source. Returns final stats. `on_progress(state.stats())` is called
    every ~2s and at completion. `job_id` is used for per-job dedup + events."""
    s = get_settings()

    seed_urls = [u.strip() for u in (source.get("seed_urls") or []) if u.strip()]
    if not seed_urls:
        return {"ok": False, "reason": "no seed urls", **CrawlState(0).stats()}

    # Auto-derive allowed hosts from seeds (so user only provides URL).
    user_allowed = set(d.lower() for d in (source.get("allowed_domains") or []))
    seed_hosts = {host_of(u) for u in seed_urls if u}
    seed_hosts |= user_allowed

    max_depth = int(source.get("max_depth", s.max_depth))
    max_pages = int(source.get("max_pages") or s.max_pages)
    metadata = dict(source.get("metadata") or {})

    state = CrawlState(max_pages)
    seen_in_job: set[str] = set()  # local fast-path dedup before hitting Redis

    queue: asyncio.Queue = asyncio.Queue(maxsize=10000)
    ingest_queue: asyncio.Queue = asyncio.Queue(maxsize=2000)

    # Cleanup any prior leftover state for this job_id (rare, but safe).
    cleanup_job(job_id)

    # ─── 0) Sitemap warm-up ───
    try:
        sm_urls = await fetch_sitemaps(seed_urls, s.user_agent)
        sm_added = 0
        for u in sm_urls:
            cu = canonicalize(u)
            if not in_scope(cu, seed_hosts) or is_skippable(cu) or cu in seen_in_job:
                continue
            seen_in_job.add(cu)
            await queue.put((cu, 0))
            sm_added += 1
            if sm_added >= 2000:  # cap initial fan-out
                break
        if sm_added:
            push_event(job_id, {"t": _now_iso(), "kind": "sitemap", "found": sm_added})
    except Exception as exc:
        state.errors.append(f"sitemap: {exc}")

    # Always queue the explicit seeds too
    for u in seed_urls:
        cu = canonicalize(u)
        if cu in seen_in_job:
            continue
        seen_in_job.add(cu)
        await queue.put((cu, 0))

    state.frontier_size = queue.qsize()

    # ─── HTTP client + thread pool for CPU-ish work ───
    cli = make_client(s.user_agent)
    cpu_pool = ThreadPoolExecutor(max_workers=max(2, s.concurrency // 2))
    loop = asyncio.get_running_loop()

    async def _to_thread(fn, *args):
        return await loop.run_in_executor(cpu_pool, fn, *args)

    # ─── Workers ───
    fetch_workers_n = max(2, s.concurrency)
    ingest_workers_n = 4

    done = asyncio.Event()  # set when no more work is expected

    async def _process_html(url: str, depth: int, html: str) -> list[tuple[str, int]]:
        """Clean text, queue ingestion, expand frontier. Returns new (url, depth) tuples."""
        if not html:
            return []

        # Cheap content-hash dedup before we waste time embedding identical pages
        h = hashlib.sha256(html.encode("utf-8", errors="ignore")).hexdigest()
        if not add_content_hash(job_id, h):
            return []

        # CPU-bound steps in thread pool
        text, meta = await _to_thread(clean, html)
        next_links_all = await _to_thread(extract_links, url, html, list(seed_hosts))
        pdf_links = await _to_thread(extract_pdf_links, url, html)

        # Save raw html cheaply (best-effort)
        try:
            os.makedirs(s.raw_html_dir, exist_ok=True)
            fname = hashlib.sha1(url.encode()).hexdigest() + ".html"
            with open(os.path.join(s.raw_html_dir, fname), "w", encoding="utf-8") as f:
                f.write(html)
        except Exception:
            pass

        if text and text.strip():
            await ingest_queue.put({
                "content": text,
                "metadata": {
                    "title": meta.get("title") or url,
                    "source_url": url,
                    "source_type": "html",
                    "language": meta.get("lang") or metadata.get("language", "en"),
                    **{k: v for k, v in metadata.items() if k != "title"},
                },
            })

        # Frontier expansion
        out: list[tuple[str, int]] = []
        if depth + 1 <= max_depth:
            for nu in next_links_all:
                cu = canonicalize(nu)
                if not cu or cu in seen_in_job:
                    continue
                if is_skippable(cu) or not in_scope(cu, seed_hosts):
                    continue
                seen_in_job.add(cu)
                out.append((cu, depth + 1))
            for pu in pdf_links:
                cu = canonicalize(pu)
                if cu in seen_in_job or not in_scope(cu, seed_hosts):
                    continue
                seen_in_job.add(cu)
                out.append((cu, depth + 1))
        return out

    async def _process_pdf(url: str) -> None:
        path = await fetch_pdf(cli, url, s.raw_pdf_dir)
        if not path:
            return
        text = await _to_thread(extract_pdf_text, path)
        if text and text.strip():
            await ingest_queue.put({
                "content": text,
                "metadata": {
                    "title": os.path.basename(path),
                    "source_url": url,
                    "source_type": "pdf",
                    **metadata,
                },
            })
            state.pdfs_indexed += 1
            push_event(job_id, {"t": _now_iso(), "kind": "pdf", "url": url})

    async def fetch_worker(wid: int) -> None:
        while not done.is_set():
            try:
                url, depth = await asyncio.wait_for(queue.get(), timeout=2.0)
            except asyncio.TimeoutError:
                if queue.empty():
                    return
                continue

            try:
                if state.pages_crawled >= max_pages:
                    return

                if s.respect_robots and not allowed(url, s.user_agent):
                    continue
                if not add_seen(job_id, url):
                    continue

                if not acquire_slot(url):
                    # back off briefly and re-queue
                    await asyncio.sleep(0.3)
                    if not acquire_slot(url):
                        await queue.put((url, depth))
                        await asyncio.sleep(0.5)
                        continue

                if is_pdf_url(url):
                    await _process_pdf(url)
                    state.pages_crawled += 1
                    continue

                try:
                    status, ctype, body = await fetch_static(cli, url)
                except Exception as e:
                    state.errors.append(f"{url}: {e}")
                    continue

                state.pages_crawled += 1
                if status >= 400:
                    continue

                if "pdf" in (ctype or "").lower():
                    # served as html link but actually pdf
                    await _process_pdf(url)
                    continue

                html = body.decode("utf-8", errors="ignore") if body else ""

                # Render fallback for JS-heavy pages
                if likely_needs_render(html):
                    rendered = await fetch_dynamic(url, s.user_agent)
                    if rendered:
                        html = rendered

                added = await _process_html(url, depth, html)
                if html and html.strip():
                    state.pages_indexed += 1
                    push_event(job_id, {
                        "t": _now_iso(), "kind": "page", "url": url,
                        "depth": depth, "indexed": state.pages_indexed,
                        "crawled": state.pages_crawled,
                    })
                for item in added:
                    if state.pages_crawled + queue.qsize() >= max_pages:
                        break
                    try:
                        queue.put_nowait(item)
                    except asyncio.QueueFull:
                        break
                state.frontier_size = queue.qsize()
            finally:
                queue.task_done()

    async def ingest_worker(wid: int) -> None:
        # Single shared client so the sentence-transformer endpoint sees keep-alive.
        async with httpx.AsyncClient(timeout=180.0) as ing_cli:
            while not done.is_set() or not ingest_queue.empty():
                try:
                    item = await asyncio.wait_for(ingest_queue.get(), timeout=2.0)
                except asyncio.TimeoutError:
                    if done.is_set() and ingest_queue.empty():
                        return
                    continue
                try:
                    await apush_to_ingest(ing_cli, content=item["content"], metadata=item["metadata"])
                except Exception as e:
                    state.errors.append(f"ingest: {e}")
                finally:
                    ingest_queue.task_done()

    async def progress_reporter() -> None:
        while not done.is_set():
            await asyncio.sleep(2.0)
            if on_progress:
                try:
                    on_progress(state.stats())
                except Exception:
                    pass

    fetchers = [asyncio.create_task(fetch_worker(i)) for i in range(fetch_workers_n)]
    ingesters = [asyncio.create_task(ingest_worker(i)) for i in range(ingest_workers_n)]
    reporter = asyncio.create_task(progress_reporter())

    try:
        # Wait until all fetch workers exit (queue drained / cap hit)
        await asyncio.gather(*fetchers, return_exceptions=True)
        # Wait for the remaining ingestion to finish
        await ingest_queue.join()
    finally:
        done.set()
        for t in ingesters:
            t.cancel()
        reporter.cancel()
        await asyncio.gather(*ingesters, *[reporter], return_exceptions=True)
        await cli.aclose()
        cpu_pool.shutdown(wait=False, cancel_futures=True)
        cleanup_job(job_id)

    final = state.stats()
    final["finished_at"] = _now_iso()
    if on_progress:
        try:
            on_progress(final)
        except Exception:
            pass
    return final
