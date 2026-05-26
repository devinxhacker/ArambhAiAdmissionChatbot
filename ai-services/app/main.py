from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from .core.logging import configure_logging, get_logger
from .api import agent, ingest, health
from .rag.vectorstore import ensure_collection

log = get_logger("ai.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log.info("ai-services starting")
    try:
        ensure_collection()
    except Exception as exc:  # noqa: BLE001
        log.warning("qdrant_init_warning", error=str(exc))
    yield
    log.info("ai-services stopped")


def create_app() -> FastAPI:
    app = FastAPI(title="Arambh AI Services", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(agent.router)
    app.include_router(ingest.router)
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
    return app


app = create_app()
