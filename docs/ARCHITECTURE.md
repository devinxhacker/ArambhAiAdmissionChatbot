# Architecture

## Overview

Arambh is a six-service monorepo:

| Service | Port | Role |
|---|---|---|
| `frontend` | 5173 | React + Vite chat / admin UI |
| `backend` | 8000 | FastAPI gateway: auth, conversations, admin |
| `ai-services` | 8100 | LangGraph multi-agent + RAG |
| `crawler` | — | Celery worker + Beat |
| MongoDB Atlas | (cloud) | persistent metadata |
| `qdrant` | 6333 | vector store |
| `redis` | 6379 | cache + queue |
| Ollama (host) | 11434 | local LLM, runs on the laptop directly (also handles translation) |

## Request lifecycle (chat)

1. **Frontend** sends `POST /api/conversations/{id}/ask` (SSE) with the user message.
2. **Backend** persists the user message, then calls `ai-services /agent/ask` (streaming NDJSON).
3. **AI service** runs the LangGraph workflow:

   ```
   query_understanding → retrieval → generation → validation → translate_response → follow_ups
   ```

   - `query_understanding` detects language, translates to English working query, classifies intent
   - `retrieval` runs hybrid (Qdrant dense + BM25) + cross-encoder rerank
   - `generation` calls `Ollama / llama3` with the grounded prompt and streams tokens
   - `validation` does a self-check to score factual support; combined with retrieval scores
   - `translate_response` re-localizes the answer if the user wrote in Hindi/Marathi
   - `follow_ups` proposes 3 next questions
4. **Backend** forwards SSE events to the browser and persists the final assistant message.

## Ingestion lifecycle

1. **Source** (admin upload, crawler page, or PDF) lands at the AI service via `POST /ingest/document`.
2. Pipeline: clean → chunk (recursive char + overlap) → embed (BGE-small) → upsert(Qdrant) + meta(Mongo).
3. **BM25 index** is marked stale and rebuilt on next query (in-memory).
4. **De-dup**: SHA-256 hash of cleaned text guards against duplicate uploads.

## Crawler

- Celery Beat ticks every 30 minutes, picking enabled sources whose `next_run_at` has passed.
- BFS crawl with `aiohttp/httpx` static fetch; falls back to **Playwright Chromium** if static HTML is too thin.
- Respects `robots.txt`, applies per-domain rate limiting via Redis, dedupes URLs in a Redis set.
- PDFs go through **pdfplumber → pypdf → tesseract OCR** as fallback chain.
- Cleaned text is pushed to AI service ingestion.

## Retrieval design

- **Dense**: cosine over BGE-small-en-v1.5 (384 dim) with payload filters (college, state, year).
- **Sparse**: BM25Okapi rebuilt from Qdrant scrolls (small corpus friendly).
- **Fusion**: min-max normalize each, weighted sum (`HYBRID_ALPHA`), top-K.
- **Rerank**: cross-encoder `ms-marco-MiniLM-L-6-v2` over top candidates; final top-K (~6).
- **Confidence floor**: max of validator score and rerank score; below `MIN_CONFIDENCE` → cautious answer.

## Memory

Conversation memory is implemented gateway-side: the last 8 turns are appended to the `<question>` block before the LLM prompt. Long-term cross-conversation memory is intentionally avoided in v1 to keep grounding strict.

## Security

- JWT (HS256) with separate access/refresh tokens; refresh sets a fresh pair.
- Bcrypt password hashing.
- RBAC via `require_role("admin")` dependency.
- Redis-backed per-IP rate limiting on `/ask`.
- Prompt-injection heuristic in `agents/safety.py`; user input length-capped.
- CORS restricted to configured origins; admin endpoints isolated under `/api/admin`.
- All external content treated as untrusted; LLM is forced to ground in retrieved context.

## Scalability levers (already wired)

- Stateless services horizontally scalable behind a load balancer.
- Vector store is Qdrant (single-node now; cluster swap is a flag flip).
- Celery workers scale by replicas (`--concurrency`, multiple worker containers).
- HuggingFace models cached at `/data/hf` for warm starts.
- Ollama can be replaced by vLLM or any OpenAI-compatible endpoint via env var.

## Deployment future (AWS)

See `docs/AWS_MIGRATION.md`. Short version:
- ECS Fargate / EKS for services
- Atlas Mongo or DocumentDB
- ElastiCache Redis
- Qdrant Cloud or self-hosted on EC2 + EBS
- S3 for raw HTML / PDF; CloudFront for frontend
- Bedrock or self-hosted GPU EC2 for LLM
