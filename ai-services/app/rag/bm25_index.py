"""Lightweight BM25 keyword index, persisted to disk per collection slice.

Note: For local-first scope we keep this in-memory and rebuild on demand from
Qdrant scrolls. For larger corpora swap in OpenSearch / Meilisearch later.
"""
from __future__ import annotations
import re
import threading
from typing import Optional

from rank_bm25 import BM25Okapi

from .vectorstore import scroll_all

_TOKEN = re.compile(r"\w+", re.UNICODE)


class BM25Index:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._bm25: BM25Okapi | None = None
        self._docs: list[dict] = []
        self._stale = True

    def _tokenize(self, text: str) -> list[str]:
        return [t.lower() for t in _TOKEN.findall(text or "")]

    def mark_stale(self) -> None:
        with self._lock:
            self._stale = True

    def _build(self) -> None:
        docs = []
        corpus_tokens: list[list[str]] = []
        for rec in scroll_all():
            txt = rec.get("text") or ""
            if not txt:
                continue
            docs.append(rec)
            corpus_tokens.append(self._tokenize(txt))
        self._docs = docs
        self._bm25 = BM25Okapi(corpus_tokens) if corpus_tokens else None
        self._stale = False

    def search(self, query: str, top_k: int = 20, filters: Optional[dict] = None) -> list[dict]:
        with self._lock:
            if self._stale or self._bm25 is None:
                self._build()
            if self._bm25 is None or not self._docs:
                return []
            scores = self._bm25.get_scores(self._tokenize(query))
        # rank
        idxs = sorted(range(len(self._docs)), key=lambda i: scores[i], reverse=True)
        out: list[dict] = []
        for i in idxs:
            d = self._docs[i]
            if filters and not _matches(d, filters):
                continue
            out.append({**d, "score": float(scores[i])})
            if len(out) >= top_k:
                break
        return out


def _matches(doc: dict, filters: dict) -> bool:
    for k, v in filters.items():
        if v is None:
            continue
        dv = doc.get(k)
        if isinstance(v, list):
            if dv not in v:
                return False
        else:
            if dv != v:
                return False
    return True


_singleton = BM25Index()


def get_bm25() -> BM25Index:
    return _singleton
