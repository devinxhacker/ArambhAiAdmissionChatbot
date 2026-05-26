"""Best-effort sitemap discovery so we can prime the frontier with hundreds
of URLs in seconds rather than relying on link-following alone."""
from __future__ import annotations
import asyncio
from typing import Iterable
from urllib.parse import urljoin
import httpx
from lxml import etree


async def fetch_sitemaps(seeds: Iterable[str], user_agent: str, timeout: float = 20.0) -> list[str]:
    """Return de-duplicated URLs discovered via robots.txt + /sitemap.xml on each seed origin."""
    headers = {"User-Agent": user_agent}
    out: set[str] = set()

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as cli:
        origins: set[str] = set()
        for s in seeds:
            try:
                from urllib.parse import urlparse
                p = urlparse(s)
                if p.scheme and p.netloc:
                    origins.add(f"{p.scheme}://{p.netloc}")
            except Exception:
                continue

        for origin in origins:
            sitemap_urls: list[str] = [urljoin(origin, "/sitemap.xml")]
            # Try robots.txt for additional sitemap declarations
            try:
                r = await cli.get(urljoin(origin, "/robots.txt"))
                if r.status_code == 200:
                    for line in r.text.splitlines():
                        if line.lower().startswith("sitemap:"):
                            sitemap_urls.append(line.split(":", 1)[1].strip())
            except Exception:
                pass

            for sm in set(sitemap_urls):
                urls = await _expand_sitemap(cli, sm, depth=0)
                out.update(urls)

    return sorted(out)


async def _expand_sitemap(cli: httpx.AsyncClient, sitemap_url: str, depth: int) -> list[str]:
    if depth > 2:
        return []
    try:
        r = await cli.get(sitemap_url)
        if r.status_code != 200 or not r.content:
            return []
    except Exception:
        return []

    try:
        root = etree.fromstring(r.content)
    except Exception:
        return []

    tag = etree.QName(root).localname.lower()
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

    if tag == "sitemapindex":
        # nested sitemaps -> recurse
        nested = root.xpath("//sm:sitemap/sm:loc/text()", namespaces=ns) or root.xpath("//sitemap/loc/text()")
        results: list[str] = []
        for n in nested[:50]:  # cap fan-out
            results.extend(await _expand_sitemap(cli, n.strip(), depth + 1))
        return results

    if tag == "urlset":
        locs = root.xpath("//sm:url/sm:loc/text()", namespaces=ns) or root.xpath("//url/loc/text()")
        return [str(u).strip() for u in locs]

    return []
