"""End-to-end ingestion pipeline:
   raw (text/html/pdf) -> clean -> chunk -> embed -> upsert(Qdrant) + meta(Mongo).
"""
from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from .cleaner import clean_html, extract_pdf, clean_text_file, hash_text, detect_extension
from .chunker import chunk_text
from .embeddings import embed_texts
from .vectorstore import upsert_chunks, delete_by_filter
from .bm25_index import get_bm25
from ..core.database import get_db
from ..core.logging import get_logger

log = get_logger("ingestion")


async def ingest_raw_text(
    *,
    text: str,
    metadata: dict,
) -> dict:
    """Ingest pre-cleaned text content."""
    if not text or not text.strip():
        return {"ok": False, "reason": "empty text"}

    chunks = chunk_text(text)
    if not chunks:
        return {"ok": False, "reason": "no chunks"}

    h = hash_text(text)
    metadata = {**metadata}
    metadata.setdefault("language", "en")

    db = get_db()
    doc_id = metadata.get("doc_id") or str(uuid.uuid4())
    metadata["doc_id"] = doc_id

    # remove old chunks for same doc_id (if reindexing)
    delete_by_filter({"doc_id": doc_id})

    payloads = []
    for i, c in enumerate(chunks):
        payloads.append(
            {
                "id": str(uuid.uuid4()),
                "doc_id": doc_id,
                "chunk_index": i,
                "text": c,
                "title": metadata.get("title"),
                "source_url": metadata.get("source_url"),
                "source_type": metadata.get("source_type", "text"),
                "college": metadata.get("college"),
                "state": metadata.get("state"),
                "category": metadata.get("category"),
                "year": metadata.get("year"),
                "language": metadata.get("language"),
                "tags": metadata.get("tags", []),
                "ingested_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    vectors = embed_texts([p["text"] for p in payloads])
    n = upsert_chunks(payloads, vectors)
    get_bm25().mark_stale()

    # mongo metadata
    await db.documents.update_one(
        {"doc_id": doc_id},
        {
            "$set": {
                "doc_id": doc_id,
                "title": metadata.get("title"),
                "source_url": metadata.get("source_url"),
                "source_type": metadata.get("source_type", "text"),
                "metadata": {
                    "college": metadata.get("college"),
                    "state": metadata.get("state"),
                    "category": metadata.get("category"),
                    "year": metadata.get("year"),
                    "language": metadata.get("language"),
                    "tags": metadata.get("tags", []),
                },
                "chunk_count": n,
                "hash": h,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )

    log.info("ingested", doc_id=doc_id, chunks=n, title=metadata.get("title"))
    return {"ok": True, "doc_id": doc_id, "chunks": n}


async def ingest_file(file_path: str, metadata: Optional[dict] = None) -> dict:
    metadata = metadata or {}
    ext = detect_extension(file_path)
    if ext == ".pdf":
        text = extract_pdf(file_path)
        metadata.setdefault("source_type", "pdf")
    elif ext in {".html", ".htm"}:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = clean_html(f.read())
        metadata.setdefault("source_type", "html")
    elif ext in {".txt", ".md"}:
        text = clean_text_file(file_path)
        metadata.setdefault("source_type", "text")
    else:
        return {"ok": False, "reason": f"unsupported extension {ext}"}

    metadata.setdefault("title", os.path.basename(file_path))
    return await ingest_raw_text(text=text, metadata=metadata)
