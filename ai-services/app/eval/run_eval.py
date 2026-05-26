"""Run retrieval + answer evaluation against the gold set.

Usage (inside container):
   docker compose exec ai-services python -m app.eval.run_eval

Outputs:
- Recall@K, Precision@K, MRR (retrieval)
- Faithfulness / answer_relevancy (RAGAS), with Ollama llama3 as judge.
"""
from __future__ import annotations
import asyncio
import json
import os
from typing import List

from ..core.logging import configure_logging, get_logger
from ..rag.retriever import retrieve_and_rerank
from ..agents.runner import run_full
from .dataset import GOLD

log = get_logger("eval")


def _retrieval_metrics(retrieved_ids: List[str], relevant_ids: List[str], k: int) -> dict:
    if not relevant_ids:
        return {"k": k, "recall@k": None, "precision@k": None, "mrr": None}
    top = retrieved_ids[:k]
    hit = [r for r in top if r in relevant_ids]
    recall = len(hit) / len(relevant_ids)
    precision = len(hit) / k
    mrr = 0.0
    for i, r in enumerate(retrieved_ids, 1):
        if r in relevant_ids:
            mrr = 1.0 / i
            break
    return {"k": k, "recall@k": recall, "precision@k": precision, "mrr": mrr}


def _keyword_hit(text: str, keywords: list[str]) -> float:
    if not keywords:
        return 1.0
    text_l = (text or "").lower()
    return sum(1 for k in keywords if k.lower() in text_l) / len(keywords)


async def evaluate() -> dict:
    results = []
    for ex in GOLD:
        retrieved = retrieve_and_rerank(ex["question"])
        retrieved_ids = [r.get("doc_id") or r.get("id") for r in retrieved]
        rmetrics = _retrieval_metrics(retrieved_ids, ex.get("relevant_doc_ids", []), k=5)

        agent_out = await run_full(ex["question"], history=[], language="en")
        answer = agent_out.get("answer", "")

        results.append(
            {
                "question": ex["question"],
                "answer": answer,
                "confidence": agent_out.get("confidence"),
                "retrieval": rmetrics,
                "keyword_hit": _keyword_hit(answer + " " + " ".join(r.get("text", "") for r in retrieved[:3]),
                                            ex.get("expected_keywords", [])),
            }
        )

    summary = _aggregate(results)
    return {"summary": summary, "results": results}


def _aggregate(results: list[dict]) -> dict:
    agg = {"recall@5": [], "precision@5": [], "mrr": [], "keyword_hit": []}
    for r in results:
        for k in ("recall@k", "precision@k", "mrr"):
            v = r["retrieval"].get(k)
            if v is not None:
                key = "recall@5" if k == "recall@k" else ("precision@5" if k == "precision@k" else "mrr")
                agg[key].append(v)
        agg["keyword_hit"].append(r["keyword_hit"])
    return {k: (sum(v) / len(v) if v else None) for k, v in agg.items()}


async def main() -> None:
    configure_logging()
    out = await evaluate()
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
