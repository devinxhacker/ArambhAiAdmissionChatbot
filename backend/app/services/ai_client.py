"""HTTP client for the ai-services FastAPI."""
import json
from typing import AsyncIterator
import httpx
from ..core.config import get_settings


class AIClient:
    def __init__(self) -> None:
        self.base = get_settings().ai_service_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, read=300.0))

    async def close(self) -> None:
        await self._client.aclose()

    async def health(self) -> dict:
        r = await self._client.get(f"{self.base}/health")
        r.raise_for_status()
        return r.json()

    async def ask_stream(self, *, message: str, history: list[dict], language: str | None = None, web_search: bool | None = None) -> AsyncIterator[dict]:
        """Stream chunks from /agent/ask (NDJSON over chunked transfer)."""
        payload = {"message": message, "history": history, "language": language, "web_search": web_search}
        async with self._client.stream("POST", f"{self.base}/agent/ask", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue

    async def ask(self, *, message: str, history: list[dict], language: str | None = None, web_search: bool | None = None) -> dict:
        payload = {"message": message, "history": history, "language": language, "stream": False, "web_search": web_search}
        r = await self._client.post(f"{self.base}/agent/ask", json=payload)
        r.raise_for_status()
        return r.json()

    async def ingest_document(self, *, content: str, metadata: dict) -> dict:
        r = await self._client.post(f"{self.base}/ingest/document", json={"content": content, "metadata": metadata})
        r.raise_for_status()
        return r.json()

    async def trigger_reindex(self, source_id: str | None = None) -> dict:
        r = await self._client.post(f"{self.base}/ingest/reindex", json={"source_id": source_id})
        r.raise_for_status()
        return r.json()

    async def recommend(self, payload: dict) -> dict:
        r = await self._client.post(f"{self.base}/agent/recommend", json=payload)
        r.raise_for_status()
        return r.json()


_singleton: AIClient | None = None


def get_ai_client() -> AIClient:
    global _singleton
    if _singleton is None:
        _singleton = AIClient()
    return _singleton
