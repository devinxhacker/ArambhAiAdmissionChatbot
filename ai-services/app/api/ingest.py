from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import hashlib
import os
import re

from ..rag.ingestion import ingest_raw_text, ingest_file
from ..rag.bm25_index import get_bm25
from ..rag.vectorstore import delete_by_filter
from ..rag.web_scraper import scrape_url
from ..core.logging import get_logger

log = get_logger("api.ingest")

router = APIRouter(prefix="/ingest", tags=["ingest"])


class DocBody(BaseModel):
    content: str = ""
    metadata: dict


@router.post("/document")
async def ingest_document(body: DocBody):
    md = body.metadata or {}
    if "file_path" in md and os.path.exists(md["file_path"]):
        return await ingest_file(md["file_path"], metadata=md)
    if not body.content.strip():
        raise HTTPException(400, "either content or metadata.file_path is required")
    return await ingest_raw_text(text=body.content, metadata=md)


class ReindexBody(BaseModel):
    source_id: Optional[str] = None
    doc_id: Optional[str] = None


@router.post("/reindex")
async def reindex(body: ReindexBody):
    """Mark BM25 stale + (optional) delete a doc/source's vectors so the
    crawler/uploader can re-add them."""
    if body.doc_id:
        delete_by_filter({"doc_id": body.doc_id})
    get_bm25().mark_stale()
    return {"ok": True}


class CrawlUrlBody(BaseModel):
    url: str
    entity_name: Optional[str] = None
    college: Optional[str] = None
    max_depth: int = 10
    max_pages: int = 200
    force_refresh: bool = False


@router.post("/crawl-url")
async def crawl_url(body: CrawlUrlBody):
    """
    Deep recursive crawl: Scrapes the entire website (all subpages) using BFS,
    indexes each page separately with its own doc_id for granular updates.

    Features:
    - Deep crawling: follows ALL internal links (default depth=10, pages=200)
    - Per-page indexing: each subpage is independently chunked and embedded
    - Change detection: uses content hashing to skip unchanged pages on re-crawl
    - Automatic cleanup: removes stale pages that no longer exist on the site
    """
    from ..rag.web_scraper import scrape_url_pages

    if not body.url or not body.url.startswith(("http://", "https://")):
        raise HTTPException(400, "url must start with http:// or https://")

    log.info("crawl_url_start", url=body.url, entity=body.entity_name, depth=body.max_depth, pages=body.max_pages)

    try:
        pages = scrape_url_pages(body.url, max_depth=body.max_depth, max_pages=body.max_pages)
    except Exception as exc:
        log.error("crawl_url_scrape_failed", url=body.url, error=str(exc))
        raise HTTPException(502, f"Scraping failed: {exc}")

    if not pages:
        raise HTTPException(422, "No pages with usable content found on this website")

    # Load existing page hashes from MongoDB to detect changes
    from ..core.database import get_db as get_mongo_db
    mongo_db = get_mongo_db()

    existing_docs = {}
    cursor = mongo_db.documents.find(
        {"doc_id": {"$regex": f"^crawl:{re.escape(body.url)}"}},
        {"doc_id": 1, "content_hash": 1, "source_url": 1}
    )
    async for doc in cursor:
        existing_docs[doc.get("source_url", "")] = {
            "doc_id": doc["doc_id"],
            "content_hash": doc.get("content_hash", ""),
        }

    total_chunks = 0
    pages_indexed = 0
    pages_skipped = 0
    pages_updated = 0
    crawled_urls = set()

    for page in pages:
        page_url = page["url"]
        page_content = page["content"]
        page_hash = page["content_hash"]
        crawled_urls.add(page_url)

        # Check if content has changed since last crawl
        existing = existing_docs.get(page_url)
        if existing and existing.get("content_hash") == page_hash and not body.force_refresh:
            pages_skipped += 1
            continue

        # Generate a unique doc_id per page (deterministic from URL)
        page_doc_id = f"crawl:{body.url}:{hashlib.sha256(page_url.encode()).hexdigest()[:12]}"

        metadata = {
            "title": page.get("title") or page_url,
            "source_url": page_url,
            "source_type": "web_crawl",
            "college": body.college,
            "doc_id": page_doc_id,
            "content_hash": page_hash,
            "crawl_seed": body.url,
            "crawl_depth": page.get("depth", 0),
        }

        result = await ingest_raw_text(text=page_content, metadata=metadata)

        if result.get("ok"):
            total_chunks += result.get("chunks", 0)
            if existing:
                pages_updated += 1
            else:
                pages_indexed += 1

    # Remove stale pages (pages that existed before but are no longer on the site)
    stale_removed = 0
    for url, info in existing_docs.items():
        if url not in crawled_urls:
            delete_by_filter({"doc_id": info["doc_id"]})
            await mongo_db.documents.delete_one({"doc_id": info["doc_id"]})
            stale_removed += 1

    if total_chunks > 0 or stale_removed > 0:
        get_bm25().mark_stale()

    log.info(
        "crawl_url_complete",
        url=body.url,
        pages_found=len(pages),
        pages_indexed=pages_indexed,
        pages_updated=pages_updated,
        pages_skipped=pages_skipped,
        stale_removed=stale_removed,
        total_chunks=total_chunks,
    )

    return {
        "success": True,
        "url": body.url,
        "entity_name": body.entity_name,
        "chunks_indexed": total_chunks,
        "pages_crawled": len(pages),
        "pages_indexed": pages_indexed,
        "pages_updated": pages_updated,
        "pages_unchanged": pages_skipped,
        "stale_pages_removed": stale_removed,
        "message": (
            f"Deep crawl complete: {len(pages)} pages found, "
            f"{pages_indexed} new, {pages_updated} updated, "
            f"{pages_skipped} unchanged, {stale_removed} stale removed. "
            f"Total {total_chunks} chunks indexed."
        ),
    }


