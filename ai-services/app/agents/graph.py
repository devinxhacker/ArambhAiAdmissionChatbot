"""LangGraph definition (kept for non-streaming / evaluation use).

The streaming runner (runner.py) now orchestrates manually for speed and
parallel execution. This graph is used only by run_full() as a fallback
and for evaluation scripts.
"""
from __future__ import annotations
from langgraph.graph import StateGraph, END

from .state import AgentState
from .nodes import (
    query_understanding,
    retrieval,
    live_search,
    generation,
    validation,
    followups_node,
)


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("query_understanding", query_understanding)
    g.add_node("retrieval", retrieval)
    g.add_node("live_search", live_search)
    g.add_node("generation", generation)
    g.add_node("validation", validation)
    g.add_node("followups", followups_node)

    g.set_entry_point("query_understanding")

    def _should_retrieve(state: AgentState) -> str:
        return "retrieval" if state.get("needs_retrieval", True) else "generation"

    g.add_conditional_edges("query_understanding", _should_retrieve, {
        "retrieval": "retrieval",
        "generation": "generation",
    })
    g.add_edge("retrieval", "live_search")
    g.add_edge("live_search", "generation")
    g.add_edge("generation", "validation")
    g.add_edge("validation", "followups")
    g.add_edge("followups", END)

    return g.compile()


_app = None


def get_graph():
    global _app
    if _app is None:
        _app = build_graph()
    return _app
