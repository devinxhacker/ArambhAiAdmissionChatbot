"""Qdrant client wrapper for upsert + dense search."""
from __future__ import annotations
import uuid
from typing import Iterable, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from ..core.config import get_settings

_client: QdrantClient | None = None


def get_qdrant() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=get_settings().qdrant_url, prefer_grpc=False, timeout=60)
    return _client


def ensure_collection() -> None:
    s = get_settings()
    cli = get_qdrant()
    existing = {c.name for c in cli.get_collections().collections}
    if s.qdrant_collection in existing:
        return
    cli.create_collection(
        collection_name=s.qdrant_collection,
        vectors_config=qm.VectorParams(size=s.embedding_dim, distance=qm.Distance.COSINE),
    )
    # payload indexes for filtered retrieval
    for field, schema in [
        ("college", qm.PayloadSchemaType.KEYWORD),
        ("category", qm.PayloadSchemaType.KEYWORD),
        ("state", qm.PayloadSchemaType.KEYWORD),
        ("language", qm.PayloadSchemaType.KEYWORD),
        ("source_url", qm.PayloadSchemaType.KEYWORD),
        ("doc_id", qm.PayloadSchemaType.KEYWORD),
        ("year", qm.PayloadSchemaType.INTEGER),
    ]:
        try:
            cli.create_payload_index(s.qdrant_collection, field_name=field, field_schema=schema)
        except Exception:
            pass


def upsert_chunks(chunks: list[dict], vectors: list[list[float]]) -> int:
    s = get_settings()
    cli = get_qdrant()
    ensure_collection()
    points = []
    for c, v in zip(chunks, vectors):
        pid = c.get("id") or str(uuid.uuid4())
        points.append(qm.PointStruct(id=pid, vector=v, payload=c))
    if not points:
        return 0
    cli.upsert(collection_name=s.qdrant_collection, points=points, wait=True)
    return len(points)


def search(
    vector: list[float],
    top_k: int,
    filters: Optional[dict] = None,
) -> list[dict]:
    s = get_settings()
    cli = get_qdrant()
    ensure_collection()
    flt = _build_filter(filters)
    res = cli.search(
        collection_name=s.qdrant_collection,
        query_vector=vector,
        limit=top_k,
        query_filter=flt,
        with_payload=True,
    )
    out = []
    for r in res:
        payload = dict(r.payload or {})
        payload["score"] = float(r.score)
        payload["id"] = str(r.id)
        out.append(payload)
    return out


def scroll_all(filters: Optional[dict] = None, limit: int = 1000) -> Iterable[dict]:
    s = get_settings()
    cli = get_qdrant()
    ensure_collection()
    flt = _build_filter(filters)
    next_page = None
    while True:
        records, next_page = cli.scroll(
            collection_name=s.qdrant_collection,
            scroll_filter=flt,
            limit=limit,
            offset=next_page,
            with_payload=True,
        )
        for r in records:
            payload = dict(r.payload or {})
            payload["id"] = str(r.id)
            yield payload
        if not next_page:
            break


def _build_filter(filters: Optional[dict]) -> Optional[qm.Filter]:
    if not filters:
        return None
    must = []
    for k, v in filters.items():
        if v is None:
            continue
        if isinstance(v, list):
            must.append(qm.FieldCondition(key=k, match=qm.MatchAny(any=v)))
        else:
            must.append(qm.FieldCondition(key=k, match=qm.MatchValue(value=v)))
    return qm.Filter(must=must) if must else None


def delete_by_filter(filters: dict) -> int:
    s = get_settings()
    cli = get_qdrant()
    flt = _build_filter(filters)
    if not flt:
        return 0
    cli.delete(collection_name=s.qdrant_collection, points_selector=qm.FilterSelector(filter=flt))
    return 1
