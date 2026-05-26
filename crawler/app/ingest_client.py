"""Push extracted text + metadata to ai-services /ingest/document.

Sync helper kept for tasks that already run in a thread pool; async helper used
inside the crawler so we can fan out hundreds of ingests concurrently without
blocking the crawl loop.
"""
from __future__ import annotations
import asyncio
from typing import Iterable
import httpx

from .config import get_settings


def push_to_ingest(*, content: str, metadata: dict) -> dict:
    """Synchronous variant (used by Celery tasks running off the crawl loop)."""
    s = get_settings()
    with httpx.Client(timeout=120.0) as cli:
        r = cli.post(f"{s.ai_service_url}/ingest/document", json={"content": content, "metadata": metadata})
        r.raise_for_status()
        return r.json()


async def apush_to_ingest(cli: httpx.AsyncClient, *, content: str, metadata: dict) -> bool:
    s = get_settings()
    try:
        r = await cli.post(
            f"{s.ai_service_url}/ingest/document",
            json={"content": content, "metadata": metadata},
            timeout=120.0,
        )
        return r.status_code < 400
    except Exception:
        return False


async def apush_many(items: Iterable[dict], concurrency: int = 4) -> int:
    """Concurrent ingestion. `items` is iterable of {content, metadata}."""
    s = get_settings()
    sem = asyncio.Semaphore(concurrency)
    successes = 0

    async with httpx.AsyncClient(timeout=120.0) as cli:
        async def _one(item: dict) -> None:
            nonlocal successes
            async with sem:
                ok = await apush_to_ingest(cli, content=item["content"], metadata=item["metadata"])
                if ok:
                    successes += 1

        await asyncio.gather(*[_one(i) for i in items])
    return successes
