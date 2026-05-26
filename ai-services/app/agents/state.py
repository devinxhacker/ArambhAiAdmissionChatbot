"""Shared state object for the LangGraph workflow."""
from __future__ import annotations
from typing import Optional, TypedDict, List


class AgentState(TypedDict, total=False):
    # Input
    user_message: str
    history: List[dict]
    requested_language: Optional[str]
    web_search: Optional[bool]  # explicit "use web" toggle from user

    # Query understanding
    detected_language: str
    intent: str
    entities: dict
    needs_retrieval: bool

    # Translated working query (always English for retrieval)
    working_query: str

    # Retrieval
    candidates: List[dict]
    reranked: List[dict]
    filters: dict

    # Live web search
    web_used: bool
    web_count: int
    web_error: str

    # Generation
    draft_answer: str
    citations: List[dict]
    confidence: float
    supported: bool
    unsupported_claims: List[str]
    final_answer: str
    follow_ups: List[str]

    # Errors
    errors: List[str]
