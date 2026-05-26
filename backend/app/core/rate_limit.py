"""Tiny Redis-backed token-bucket rate limiter."""
import time
from fastapi import HTTPException, Request, status
from .config import get_settings
from .redis_client import get_redis


async def rate_limit(request: Request) -> None:
    s = get_settings()
    key_id = request.client.host if request.client else "anon"
    window = int(time.time() // 60)
    key = f"rl:{key_id}:{window}"
    r = get_redis()
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, 65)
    if count > s.rate_limit_per_minute:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "rate limit exceeded")
