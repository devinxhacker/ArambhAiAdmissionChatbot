"""Hybrid retrieval (dense + BM25) with optional metadata filters and reranking."""
from __future__ import annotations
from typing import Optional

from ..core.config import get_settings
from .embeddings import embed_query
from .vectorstore import search as dense_search
from .bm25_index import get_bm25
from .reranker import rerank


def _normalize(scores: list[float]) -> list[float]:
    if not scores:
        return scores
    lo, hi = min(scores), max(scores)
    if hi - lo < 1e-9:
        return [1.0 for _ in scores]
    return [(s - lo) / (hi - lo) for s in scores]


def hybrid_retrieve(
    query: str,
    top_k: int | None = None,
    filters: Optional[dict] = None,
) -> list[dict]:
    s = get_settings()
    k = top_k or s.retrieval_top_k

    qvec = embed_query(query)
    dense = dense_search(qvec, k, filters=filters)
    sparse = get_bm25().search(query, top_k=k, filters=filters)

    by_id: dict[str, dict] = {}

    dense_scores = _normalize([d.get("score", 0.0) for d in dense])
    for d, ns in zip(dense, dense_scores):
        d = {**d, "_dense": ns}
        by_id[d["id"]] = d

    sparse_scores = _normalize([d.get("score", 0.0) for d in sparse])
    for d, ns in zip(sparse, sparse_scores):
        existing = by_id.get(d["id"])
        if existing:
            existing["_sparse"] = ns
        else:
            by_id[d["id"]] = {**d, "_sparse": ns}

    fused: list[dict] = []
    for c in by_id.values():
        ds = c.get("_dense", 0.0)
        ss = c.get("_sparse", 0.0)
        c["fused_score"] = s.hybrid_alpha * ds + (1 - s.hybrid_alpha) * ss
        fused.append(c)

    fused.sort(key=lambda x: x["fused_score"], reverse=True)
    return fused[:k]


def retrieve_and_rerank(
    query: str,
    filters: Optional[dict] = None,
) -> list[dict]:
    s = get_settings()
    candidates = hybrid_retrieve(query, top_k=s.retrieval_top_k, filters=filters)
    return rerank(query, candidates, top_k=s.rerank_top_k)
