from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

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
    max_depth: int = 2
    max_pages: int = 15
    force_refresh: bool = False


@router.post("/crawl-url")
async def crawl_url(body: CrawlUrlBody):
    """
    Dynamic RAG: Scrape a URL recursively (Crawl4AI BFS + BS4 fallback),
    then chunk and index into Qdrant immediately.

    This is the real-time ingestion endpoint used by the admin dashboard
    when adding website URLs to a college's knowledge base.
    """
    if not body.url or not body.url.startswith(("http://", "https://")):
        raise HTTPException(400, "url must start with http:// or https://")

    log.info("crawl_url_start", url=body.url, entity=body.entity_name, depth=body.max_depth, pages=body.max_pages)

    try:
        text = scrape_url(body.url, max_depth=body.max_depth, max_pages=body.max_pages)
    except Exception as exc:
        log.error("crawl_url_scrape_failed", url=body.url, error=str(exc))
        raise HTTPException(502, f"Scraping failed: {exc}")

    if not text or len(text) < 100:
        raise HTTPException(422, "Scraped content is too short or empty")

    # Ingest into Qdrant via the existing pipeline
    metadata = {
        "title": body.entity_name or body.url,
        "source_url": body.url,
        "source_type": "web_crawl",
        "college": body.college,
        "doc_id": f"crawl:{body.url}",
    }

    result = await ingest_raw_text(text=text, metadata=metadata)

    if not result.get("ok"):
        raise HTTPException(500, f"Ingestion failed: {result.get('reason', 'unknown')}")

    log.info("crawl_url_complete", url=body.url, chunks=result.get("chunks", 0))
    return {
        "success": True,
        "url": body.url,
        "entity_name": body.entity_name,
        "chunks_indexed": result.get("chunks", 0),
        "doc_id": result.get("doc_id"),
        "message": f"Successfully scraped and indexed {result.get('chunks', 0)} chunks from {body.url}",
    }
