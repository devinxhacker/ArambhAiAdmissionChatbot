# Arambh

**Arambh** — A Scalable Multi-Agent RAG-Powered Admission Assistance Chatbot with Real-Time College Data Retrieval.

> Local-first, free/open-source, production-grade. Runs end-to-end on a laptop with `docker compose up`.

## What it does

Helps students query engineering / polytechnic college information — fees, placements, cutoffs, scholarships, hostels, seat availability, admission criteria, branches, rankings, government notices — grounded in real, retrieved sources (no hallucination).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind, ShadCN UI, Zustand, React Query, SSE |
| Backend API | Python 3.11, FastAPI, JWT, RBAC, Motor (async Mongo) |
| AI Services | LangChain, LangGraph (MCP-style multi-agent), Ollama `llama3` (also used for translation), HuggingFace embeddings (`BAAI/bge-small-en-v1.5`), cross-encoder reranker |
| Crawler | Playwright, BeautifulSoup, Trafilatura, pypdf, pdfplumber, Tesseract OCR, Celery + Redis |
| Data | MongoDB Atlas, Qdrant (vectors), Redis (cache + queue) |
| Observability | Prometheus, Grafana, structured JSON logs, RAGAS eval |
| Orchestration | Docker Compose |

## Quick start

```bash
# 1. Provision MongoDB Atlas (free M0 tier is fine)
#    - create a cluster, add a DB user, allow your IP (0.0.0.0/0 for dev)
#    - copy the SRV connection string

# 2. Clone and copy env
cp .env.example .env
# edit .env -> set MONGO_URI to your Atlas SRV string

# 3. Run Ollama on the host (not in Docker)
ollama pull llama3                        # one-time, ~4.7GB
OLLAMA_HOST=0.0.0.0:11434 ollama serve    # bind so containers can reach it

# 4. Boot the rest of the stack
docker compose up -d

# 5. Open
# Frontend  : http://localhost:5173
# Backend   : http://localhost:8000/docs
# AI Service: http://localhost:8100/docs
# Qdrant UI : http://localhost:6333/dashboard
# Grafana   : http://localhost:3001  (admin / admin)
```

Default admin user is created on first boot — see `.env.example` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

## Repo layout

```
arambh/
├── frontend/        React + Vite + Tailwind + ShadCN
├── backend/         FastAPI gateway (auth, conversations, admin)
├── ai-services/     LangGraph multi-agent + RAG pipeline
├── crawler/         Async crawler + Celery workers
├── shared/          Cross-service schemas & contracts
├── devops/          nginx, prometheus, grafana configs
├── docs/            Architecture, setup, evaluation, AWS migration
├── data/            Local volumes (raw, processed, uploads)
└── docker-compose.yml
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Local setup & troubleshooting](docs/LOCAL_SETUP.md)
- [API reference](docs/API.md)
- [Testing strategy](docs/TESTING.md)
- [Evaluation (RAGAS, Recall@K)](docs/EVALUATION.md)
- [Monitoring](docs/MONITORING.md)
- [Future AWS migration plan](docs/AWS_MIGRATION.md)

## License

MIT (academic / educational use).
