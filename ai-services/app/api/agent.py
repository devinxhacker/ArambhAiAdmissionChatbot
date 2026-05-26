import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict

from ..agents.runner import run_full, run_streaming
from ..agents.recommend import recommend as recommend_agent

router = APIRouter(prefix="/agent", tags=["agent"])


class AskBody(BaseModel):
    message: str
    history: List[Dict] = []
    language: Optional[str] = None
    stream: bool = True
    web_search: Optional[bool] = None  # explicit user toggle; None = auto


@router.post("/ask")
async def ask(body: AskBody):
    if not body.stream:
        return await run_full(body.message, body.history, body.language, web_search=body.web_search)

    async def gen():
        try:
            async for evt in run_streaming(body.message, body.history, body.language, web_search=body.web_search):
                yield json.dumps(evt) + "\n"
        except Exception as e:  # noqa: BLE001
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.post("/recommend")
async def recommend_route(payload: dict):
    return await recommend_agent(payload)
