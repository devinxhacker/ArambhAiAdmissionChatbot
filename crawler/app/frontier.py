"""URL frontier with dedup + per-domain rate limiting using Redis.

Two scopes for "seen":
  - global  -> set("crawl:seen") survives across jobs, used for soft dedup.
  - per-job -> set("crawl:seen:<job_id>") used for hard dedup inside a single
               crawl, cleaned up at job end.

Per-domain rate limiting is enforced with a Redis-stored timestamp; this is a
lightweight token bucket that's good enough for friendly crawling.
"""
from __future__ import annotations
import time
from urllib.parse import urlparse
import redis

from .config import get_settings

_redis: redis.Redis | None = None


def _r() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(
            get_settings().redis_url,
            decode_responses=True,
            socket_keepalive=True,
        )
    return _redis


# ─────────────────── Per-job seen set ───────────────────
def seen_key(job_id: str) -> str:
    return f"crawl:seen:{job_id}"


def add_seen(job_id: str, url: str) -> bool:
    """Atomically add to the per-job seen set. Returns True if newly added."""
    return bool(_r().sadd(seen_key(job_id), url))


def cleanup_job(job_id: str) -> None:
    _r().delete(seen_key(job_id))
    _r().delete(f"crawl:hashes:{job_id}")


def add_content_hash(job_id: str, h: str) -> bool:
    """Track content hashes per job to skip duplicate-content pages quickly."""
    return bool(_r().sadd(f"crawl:hashes:{job_id}", h))


# ─────────────────── Per-domain rate limit ───────────────────
def acquire_slot(url: str) -> bool:
    s = get_settings()
    host = urlparse(url).netloc
    if not host:
        return True
    interval = 1.0 / max(s.rate_limit_per_domain, 0.1)
    now = time.time()
    key = f"crawl:rl:{host}"
    last = _r().get(key)
    if last and now - float(last) < interval:
        return False
    _r().set(key, now, ex=10)
    return True


# ─────────────────── Live progress writes ───────────────────
def push_event(job_id: str, event: dict) -> None:
    """Append a small event into a capped Redis list so the API can stream them."""
    import json
    pipe = _r().pipeline()
    pipe.rpush(f"crawl:events:{job_id}", json.dumps(event))
    pipe.ltrim(f"crawl:events:{job_id}", -200, -1)  # keep last 200 events
    pipe.expire(f"crawl:events:{job_id}", 60 * 60 * 6)  # 6h
    pipe.execute()


def list_events(job_id: str, since: int = 0) -> list[dict]:
    import json
    raw = _r().lrange(f"crawl:events:{job_id}", since, -1)
    out: list[dict] = []
    for r in raw:
        try:
            out.append(json.loads(r))
        except Exception:
            continue
    return out
