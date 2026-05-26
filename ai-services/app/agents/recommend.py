"""Recommendation agent — uses retrieval + LLM ranking with constraints."""
from __future__ import annotations
from langchain_core.messages import SystemMessage, HumanMessage

from ..rag.llm import chat
from ..rag.prompts import RECOMMEND_SYSTEM
from ..rag.retriever import retrieve_and_rerank
from .json_utils import extract_json


async def recommend(payload: dict) -> dict:
    parts = []
    if payload.get("branch"): parts.append(f"branch:{payload['branch']}")
    if payload.get("state"): parts.append(f"state:{payload['state']}")
    if payload.get("rank") is not None: parts.append(f"rank:{payload['rank']}")
    if payload.get("budget"): parts.append(f"budget:{payload['budget']}")
    if payload.get("placement_min_lpa"): parts.append(f"placement_min:{payload['placement_min_lpa']}lpa")
    if payload.get("needs_hostel"): parts.append("hostel:yes")

    query = "engineering colleges " + " ".join(parts) if parts else "engineering colleges admission"
    filters = {"state": payload.get("state")} if payload.get("state") else None
    candidates = retrieve_and_rerank(query, filters=filters)

    if not candidates:
        return {"recommendations": [], "reason": "no candidates retrieved"}

    candidate_dump = "\n\n".join(
        f"[{i+1}] {c.get('title','')} ({c.get('source_url','')})\n{(c.get('text','') or '')[:600]}"
        for i, c in enumerate(candidates)
    )

    msgs = [
        SystemMessage(content=RECOMMEND_SYSTEM),
        HumanMessage(
            content=f"User constraints:\n{payload}\n\nCandidates:\n{candidate_dump}"
        ),
    ]
    resp = await chat(msgs, temperature=0.2)
    parsed = extract_json(resp) or {}
    parsed.setdefault("recommendations", [])
    parsed["candidate_sources"] = [
        {
            "index": i + 1,
            "title": c.get("title"),
            "source_url": c.get("source_url"),
            "score": c.get("rerank_score") or c.get("fused_score"),
        }
        for i, c in enumerate(candidates)
    ]
    return parsed
