"""Backend gateway FastAPI app."""
from contextlib import asynccontextmanager
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from .core.config import get_settings
from .core.database import close_client, ensure_indexes
from .core.logging import configure_logging, get_logger
from .core.redis_client import close_redis
from .api import auth, conversations, admin, recommend, health, superadmin, colleges
from .scripts.seed import seed_admin

log = get_logger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log.info("starting backend")
    await ensure_indexes()
    await seed_admin()
    yield
    await close_client()
    await close_redis()
    log.info("backend stopped")


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Arambh Backend", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # Log the real traceback server-side and return a JSON body.
        # CORS middleware still attaches Access-Control-Allow-Origin to this
        # response, so the browser shows the real status, not a CORS error.
        log.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
            traceback=traceback.format_exc(),
        )
        return JSONResponse(
            status_code=500,
            content={"detail": f"{type(exc).__name__}: {exc}"},
        )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(conversations.router)
    app.include_router(admin.router)
    app.include_router(superadmin.router)
    app.include_router(colleges.router)
    app.include_router(recommend.router)

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
    return app


app = create_app()
