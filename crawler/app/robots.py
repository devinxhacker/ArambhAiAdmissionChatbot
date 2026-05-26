"""robots.txt cache."""
from __future__ import annotations
from urllib import robotparser
from urllib.parse import urlparse

_cache: dict[str, robotparser.RobotFileParser] = {}


def allowed(url: str, user_agent: str) -> bool:
    p = urlparse(url)
    if not p.scheme or not p.netloc:
        return False
    base = f"{p.scheme}://{p.netloc}"
    rp = _cache.get(base)
    if rp is None:
        rp = robotparser.RobotFileParser()
        rp.set_url(f"{base}/robots.txt")
        try:
            rp.read()
        except Exception:
            return True
        _cache[base] = rp
    try:
        return rp.can_fetch(user_agent, url)
    except Exception:
        return True
