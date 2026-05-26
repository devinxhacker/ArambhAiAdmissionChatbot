from fastapi import APIRouter
import httpx
from ..core.config import get_settings
from ..rag.vectorstore import get_qdrant, ensure_collection

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    s = get_settings()
    out = {"ai": "ok"}
    try:
        ensure_collection()
        info = get_qdrant().get_collection(s.qdrant_collection)
        out["qdrant"] = {"vectors_count": info.points_count}
    except Exception as e:  # noqa: BLE001
        out["qdrant"] = f"error: {e}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as cli:
            r = await cli.get(f"{s.ollama_base_url}/api/tags")
        out["ollama"] = "ok" if r.status_code < 500 else f"status:{r.status_code}"
    except Exception as e:  # noqa: BLE001
        out["ollama"] = f"error: {e}"
    return out
