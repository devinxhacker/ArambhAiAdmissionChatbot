# Evaluation framework

Two complementary signals:

## 1. Retrieval quality (offline)

Implemented in `ai-services/app/eval/run_eval.py`:

- **Recall@K**: fraction of gold-relevant chunks present in top-K retrieved.
- **Precision@K**: fraction of top-K that are gold-relevant.
- **MRR**: 1 / rank of first relevant.
- **Keyword hit rate**: cheap proxy when no labelled chunk IDs are available.

Edit `ai-services/app/eval/dataset.py` to grow your gold set. Each example needs:
- `question`
- `expected_keywords`
- (optional) `relevant_doc_ids` for true Recall@K
- `ground_truth` reference answer

Run:
```bash
docker compose exec ai-services python -m app.eval.run_eval
```

Sample output:
```json
{
  "summary": { "recall@5": 0.74, "precision@5": 0.21, "mrr": 0.62, "keyword_hit": 0.86 },
  "results": [...]
}
```

## 2. Answer quality (RAGAS)

The dependency `ragas` is installed in `ai-services`. To extend `run_eval.py` to use it, wire its
`Faithfulness`, `AnswerRelevancy`, `ContextPrecision`, and `ContextRecall` metrics with `langchain_ollama.ChatOllama` as the judge model. (Kept simple here to remain CPU-friendly; the harness is in place.)

## 3. Online metrics (production)

Exposed by `prometheus-fastapi-instrumentator` on `/metrics`:

- request rate / latency / error rate per route
- p50 / p95 latency for `/ask`

Custom counters worth adding:
- `arambh_retrieval_empty_total` (when the retriever returns 0)
- `arambh_validation_unsupported_total`
- `arambh_low_confidence_total`

Hook them in `ai-services/app/agents/runner.py`.
