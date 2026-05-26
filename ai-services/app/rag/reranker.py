"""Cross-encoder reranker (local)."""
from __future__ import annotations
import os
from typing import List, Tuple
from sentence_transformers import CrossEncoder
from ..core.config import get_settings

_ce: CrossEncoder | None = None


def _get_model() -> CrossEncoder:
    global _ce
    if _ce is None:
        s = get_settings()
        os.environ.setdefault("HF_HOME", f"{s.data_dir}/hf")
        # CrossEncoder uses `cache_dir` (NOT `cache_folder`).
        try:
            _ce = CrossEncoder(s.reranker_model, cache_dir=f"{s.data_dir}/hf")
        except TypeError:
            _ce = CrossEncoder(s.reranker_model)
    return _ce


def rerank(query: str, candidates: List[dict], top_k: int) -> List[dict]:
    if not candidates:
        return []
    pairs: List[Tuple[str, str]] = [(query, c.get("text", "")) for c in candidates]
    scores = _get_model().predict(pairs).tolist()
    for c, s in zip(candidates, scores):
        c["rerank_score"] = float(s)
    candidates.sort(key=lambda c: c["rerank_score"], reverse=True)
    return candidates[:top_k]
