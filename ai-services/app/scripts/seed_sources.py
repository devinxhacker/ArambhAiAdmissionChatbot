"""Seed a couple of crawl sources so the crawler has something to do on first boot."""
import asyncio
from datetime import datetime, timezone
from ..core.database import get_db


SAMPLE_SOURCES = [
    {
        "name": "AICTE - Approved Institutions",
        "seed_urls": ["https://www.aicte-india.org/"],
        "allowed_domains": ["aicte-india.org"],
        "max_depth": 2,
        "enabled": True,
        "metadata": {"category": "government_notice", "language": "en"},
    },
    {
        "name": "MHRD / Ministry of Education",
        "seed_urls": ["https://www.education.gov.in/"],
        "allowed_domains": ["education.gov.in"],
        "max_depth": 2,
        "enabled": True,
        "metadata": {"category": "government_notice", "language": "en"},
    },
]


async def main() -> None:
    db = get_db()
    for src in SAMPLE_SOURCES:
        existing = await db.crawl_sources.find_one({"name": src["name"]})
        if existing:
            continue
        src.setdefault("created_at", datetime.now(timezone.utc))
        await db.crawl_sources.insert_one(src)


if __name__ == "__main__":
    asyncio.run(main())
