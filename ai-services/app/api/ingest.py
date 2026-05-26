from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

from ..rag.ingestion import ingest_raw_text, ingest_file
from ..rag.bm25_index import get_bm25
from ..rag.vectorstore import delete_by_filter

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
