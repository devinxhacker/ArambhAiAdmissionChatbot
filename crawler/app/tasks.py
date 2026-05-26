"""Celery tasks. Names use a `crawler.tasks.*` prefix for routing."""
from __future__ import annotations
import asyncio
from datetime import datetime, timezone

from .celery_app import celery
from .crawler import crawl_source
from .db import get_db


def _now():
    return datetime.now(timezone.utc)


@celery.task(name="crawler.tasks.tick")
def tick():
    """Periodic kicker: pick enabled sources whose 'next_run_at' is due (or never run)."""
    db = get_db()
    sources = list(db.crawl_sources.find({"enabled": True}))
    queued = []
    for src in sources:
        nr = src.get("next_run_at")
        if nr and nr > _now():
            continue
        run_crawl.delay({"source_id": str(src["_id"])})
        queued.append(str(src["_id"]))
    return {"queued": queued}


@celery.task(name="crawler.tasks.run_crawl", bind=True, max_retries=2)
def run_crawl(self, payload: dict):
    db = get_db()
    src = None

    if payload.get("source_id"):
        from bson import ObjectId
        src = db.crawl_sources.find_one({"_id": ObjectId(payload["source_id"])})
    elif payload.get("url"):
        # Ad-hoc URL: derive seed_hosts from the URL itself, allow deep crawl.
        url = payload["url"]
        src = {
            "name": "ad-hoc",
            "seed_urls": [url],
            "allowed_domains": [],  # auto-derived from seed
            "max_depth": payload.get("max_depth", 4),
            "max_pages": payload.get("max_pages", 500),
            "metadata": payload.get("metadata", {}),
        }

    if not src:
        return {"ok": False, "reason": "no source"}

    job_doc = {
        "source_id": str(src.get("_id")) if src.get("_id") else None,
        "source_name": src.get("name"),
        "status": "running",
        "started_at": _now(),
        "pages_crawled": 0,
        "pages_indexed": 0,
        "pdfs_indexed": 0,
        "frontier_size": 0,
        "elapsed_sec": 0,
        "created_at": _now(),
    }
    job_id = db.crawl_jobs.insert_one(job_doc).inserted_id

    def _on_progress(stats: dict) -> None:
        db.crawl_jobs.update_one(
            {"_id": job_id},
            {"$set": {
                "pages_crawled": stats.get("pages_crawled", 0),
                "pages_indexed": stats.get("pages_indexed", 0),
                "pdfs_indexed": stats.get("pdfs_indexed", 0),
                "frontier_size": stats.get("frontier_size", 0),
                "elapsed_sec": stats.get("elapsed_sec", 0),
                "last_progress_at": _now(),
            }},
        )

    try:
        stats = asyncio.run(crawl_source(src, job_id=str(job_id), on_progress=_on_progress))
        db.crawl_jobs.update_one(
            {"_id": job_id},
            {
                "$set": {
                    "status": "success",
                    "finished_at": _now(),
                    "pages_crawled": stats.get("pages_crawled", 0),
                    "pages_indexed": stats.get("pages_indexed", 0),
                    "pdfs_indexed": stats.get("pdfs_indexed", 0),
                    "elapsed_sec": stats.get("elapsed_sec", 0),
                    "errors": stats.get("errors", []),
                }
            },
        )
        if src.get("_id"):
            from datetime import timedelta
            db.crawl_sources.update_one(
                {"_id": src["_id"]},
                {"$set": {"last_run_at": _now(), "next_run_at": _now() + timedelta(hours=24)}},
            )
        return {"ok": True, "job_id": str(job_id), **stats}
    except Exception as exc:  # noqa: BLE001
        db.crawl_jobs.update_one(
            {"_id": job_id},
            {"$set": {"status": "failed", "finished_at": _now(), "error": str(exc)}},
        )
        raise self.retry(exc=exc, countdown=60)
