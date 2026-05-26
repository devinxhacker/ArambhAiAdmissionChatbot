"""Local HuggingFace sentence-transformer embeddings (lazy-loaded singleton)."""
from __future__ import annotations
from typing import List
from sentence_transformers import SentenceTransformer
from ..core.config import get_settings

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        s = get_settings()
        # SentenceTransformer accepts `cache_folder`; CrossEncoder uses `cache_dir`.
        _model = SentenceTransformer(s.embedding_model, cache_folder=f"{s.data_dir}/hf")
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    m = _get_model()
    vectors = m.encode(texts, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
    return vectors.tolist()


def embed_query(text: str) -> List[float]:
    return embed_texts([text])[0]
