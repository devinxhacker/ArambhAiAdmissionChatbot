"""Individual MCP-style agent nodes used inside the LangGraph workflow."""
from __future__ import annotations
from typing import Any
from langchain_core.messages import SystemMessage, HumanMessage

from ..core.config import get_settings
from ..core.logging import get_logger
from ..rag.llm import chat
from ..rag.prompts import (
    INTENT_SYSTEM,
    VALIDATE_SYSTEM,
    FOLLOWUP_SYSTEM,
    SYSTEM_GROUNDED,
    USER_TEMPLATE,
)
from ..rag.retriever import retrieve_and_rerank
from ..rag.reranker import rerank
from ..rag.translation import detect_language, atranslate
from ..rag.web_search import live_web_chunks
from .json_utils import extract_json
from .safety import looks_like_injection, sanitize_question
from .state import AgentState

log = get_logger("agents")


# ─────────────────── Query Understanding ───────────────────
async def query_understanding(state: AgentState) -> dict[str, Any]:
    s = get_settings()
    raw = sanitize_question(state.get("user_message", ""))

    if looks_like_injection(raw):
        return {
            "errors": ["prompt_injection_blocked"],
            "intent": "other",
            "entities": {},
            "needs_retrieval": False,
            "detected_language": "en",
            "working_query": raw,
        }

    # Detect language
    requested = state.get("requested_language")
    detected = requested or detect_language(raw)
    if detected not in s.langs:
        detected = "en"

    # Translate to English working query for retrieval
    working = await atranslate(raw, src=detected, tgt="en") if detected != "en" else raw

    # Ask LLM to classify intent
    msgs = [SystemMessage(content=INTENT_SYSTEM), HumanMessage(content=working)]
    try:
        resp = await chat(msgs, temperature=0.0)
        parsed = extract_json(resp) or {}
    except Exception as exc:
        log.warning("intent_llm_failed", error=str(exc))
        parsed = {}

    return {
        "detected_language": detected,
        "working_query": working,
        "intent": parsed.get("intent", "other"),
        "entities": parsed.get("entities", {}) or {},
        "needs_retrieval": parsed.get("needs_retrieval", True),
    }


# ─────────────────── Retrieval ───────────────────
async def retrieval(state: AgentState) -> dict[str, Any]:
    if not state.get("needs_retrieval", True):
        return {"reranked": [], "candidates": [], "filters": {}}

    entities = state.get("entities", {}) or {}
    filters = {
        "college": entities.get("college"),
        "state": entities.get("state"),
        "year": entities.get("year"),
    }
    filters = {k: v for k, v in filters.items() if v}

    try:
        reranked = retrieve_and_rerank(state["working_query"], filters=filters or None)
    except Exception as exc:
        log.warning("retrieval_failed", error=str(exc))
        reranked = []

    return {"reranked": reranked, "filters": filters}


# ─────────────────── Live web search (Perplexity-style) ───────────────────
def _top_score(chunks: list[dict]) -> float:
    if not chunks:
        return 0.0
    return max(
        (c.get("rerank_score") or c.get("fused_score") or c.get("score") or 0.0)
        for c in chunks
    )


async def live_search(state: AgentState) -> dict[str, Any]:
    """Search the live web. Fully autonomous — runs only when called by the runner
    after it decides local retrieval is insufficient.

    Uses "fast mode" by default: 3 search hits, fetch top 2 pages, no PDF follow-up.
    This keeps total web search time under 4 seconds on average.
    """
    s = get_settings()
    from ..rag.web_search import live_web_chunks

    log.info("live_search_running")

    try:
        web_chunks = await live_web_chunks(
            state["working_query"],
            k=3,  # only 3 search hits for speed
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("live_search_failed", error=str(exc))
        return {"web_used": True, "web_count": 0, "web_error": str(exc)}

    log.info("live_search_done", web_chunks=len(web_chunks))

    if not web_chunks:
        return {"web_used": True, "web_count": 0}

    # Merge with local chunks and rerank together
    local_chunks = state.get("reranked", []) or []
    combined = list(local_chunks) + web_chunks
    try:
        reranked = rerank(state["working_query"], combined, top_k=s.rerank_top_k)
    except Exception as exc:
        log.warning("combined_rerank_failed", error=str(exc))
        reranked = combined[: s.rerank_top_k]

    return {
        "reranked": reranked,
        "web_used": True,
        "web_count": len(web_chunks),
    }


# ─────────────────── Generation ───────────────────
def _format_context(chunks: list[dict]) -> tuple[str, list[dict]]:
    """Build the LLM context block and a deduplicated citation list.

    The LLM sees every chunk with a source label. Citations are collapsed to
    one per unique URL so the user sees diverse sources.
    """
    blocks = []
    citations = []
    seen_urls: dict[str, int] = {}

    for i, c in enumerate(chunks, start=1):
        title = c.get("title") or "Source"
        url = c.get("source_url") or ""
        source_type = c.get("source_type") or "indexed"
        host = c.get("host") or ""

        # Give the LLM a human-readable source label
        if source_type == "web":
            label = f"[{i}] {title} ({host})"
        else:
            label = f"[{i}] {title} (Arambh Database)"

        blocks.append(f"{label}\n{c.get('text', '')}")

        # Citations: one per unique URL
        if url and url in seen_urls:
            continue
        seen_urls[url] = len(citations) + 1
        citations.append(
            {
                "index": len(citations) + 1,
                "source_url": url,
                "title": title,
                "snippet": (c.get("text") or "")[:240],
                "score": c.get("rerank_score") or c.get("fused_score") or c.get("score"),
                "chunk_id": c.get("id"),
                "source_type": source_type,
                "host": host,
                "format": c.get("format"),
            }
        )
    return "\n\n---\n\n".join(blocks), citations


async def generation(state: AgentState) -> dict[str, Any]:
    s = get_settings()
    chunks = state.get("reranked", []) or []

    if not chunks and state.get("needs_retrieval", True):
        return {
            "draft_answer": "I don't have enough verified information to answer that yet.",
            "citations": [],
            "confidence": 0.0,
        }

    context, citations = _format_context(chunks)

    # Light conversational memory: include last 4 user/assistant turns
    history = state.get("history", [])[-8:]
    history_text = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history)
    question = state["working_query"]
    if history_text:
        question = f"Previous conversation:\n{history_text}\n\nCurrent question: {question}"

    msgs = [
        SystemMessage(content=SYSTEM_GROUNDED),
        HumanMessage(content=USER_TEMPLATE.format(context=context, question=question)),
    ]
    try:
        draft = await chat(msgs, temperature=s.ollama_temperature)
    except Exception as exc:
        log.warning("generation_failed", error=str(exc))
        draft = "I'm having trouble reaching the model right now. Please retry."

    return {"draft_answer": draft, "citations": citations}


# ─────────────────── Validation ───────────────────
async def validation(state: AgentState) -> dict[str, Any]:
    s = get_settings()
    chunks = state.get("reranked", []) or []
    draft = state.get("draft_answer", "")
    if not draft:
        return {"supported": False, "confidence": 0.0, "unsupported_claims": []}

    if not chunks:
        return {"supported": False, "confidence": 0.0, "unsupported_claims": []}

    # Heuristic floor based on retrieval scores
    top_score = max(
        (c.get("rerank_score") or c.get("fused_score") or c.get("score") or 0.0) for c in chunks
    )

    context = "\n\n".join((c.get("text") or "") for c in chunks[:6])
    msgs = [
        SystemMessage(content=VALIDATE_SYSTEM),
        HumanMessage(content=f"DRAFT:\n{draft}\n\nCONTEXT:\n{context}"),
    ]
    try:
        resp = await chat(msgs, temperature=0.0)
        parsed = extract_json(resp) or {}
    except Exception:
        parsed = {}

    confidence = float(parsed.get("confidence", 0.5))
    confidence = max(confidence, min(1.0, top_score))  # combine

    return {
        "supported": bool(parsed.get("supported", confidence >= s.min_confidence)),
        "confidence": confidence,
        "unsupported_claims": list(parsed.get("unsupported_claims", []) or []),
    }


# ─────────────────── Translation back to user language ───────────────────
async def translate_response(state: AgentState) -> dict[str, Any]:
    s = get_settings()
    answer = state.get("draft_answer", "")
    if not answer:
        return {"final_answer": ""}

    # If validation low and retrieval present, append disclaimer
    if state.get("needs_retrieval", True):
        if not state.get("supported", False) and state.get("confidence", 0.0) < s.min_confidence:
            answer = (
                "Note: My retrieved sources don't fully support an answer here, "
                "so I'm being cautious.\n\n" + answer
            )

    lang = state.get("detected_language", "en")
    final = await atranslate(answer, src="en", tgt=lang) if lang != "en" else answer
    return {"final_answer": final}


# ─────────────────── Follow-up questions ───────────────────
async def followups_node(state: AgentState) -> dict[str, Any]:
    if not state.get("final_answer"):
        return {"follow_ups": []}
    msgs = [
        SystemMessage(content=FOLLOWUP_SYSTEM),
        HumanMessage(
            content=f"Question: {state['user_message']}\nAnswer: {state['final_answer']}"
        ),
    ]
    try:
        resp = await chat(msgs, temperature=0.5)
        parsed = extract_json(resp) or []
        if isinstance(parsed, list):
            return {"follow_ups": [str(x) for x in parsed[:3]]}
    except Exception:
        pass
    return {"follow_ups": []}
