from fastapi import APIRouter, Depends, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from ..core.database import get_db
from ..services.ai_client import get_ai_client

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: AsyncIOMotorDatabase = Depends(get_db)):
    out = {"backend": "ok"}
    try:
        await db.command("ping")
        out["mongo"] = "ok"
    except Exception as e:  # noqa: BLE001
        out["mongo"] = f"error: {e}"
    try:
        ai = await get_ai_client().health()
        out["ai"] = ai
    except Exception as e:  # noqa: BLE001
        out["ai"] = f"error: {e}"
    return out


@router.post("/internal/auto-refresh")
async def internal_auto_refresh(
    db: AsyncIOMotorDatabase = Depends(get_db),
    x_internal_token: Optional[str] = Header(None),
):
    """
    Internal endpoint called by the Celery beat scheduler to trigger
    automatic re-crawling of website URLs that are due for refresh.

    No user auth required — protected by internal network + optional token.
    """
    import os
    expected = os.getenv("INTERNAL_SCHEDULER_TOKEN", "arambh-internal-scheduler")
    if x_internal_token and x_internal_token != expected:
        from fastapi import HTTPException
        raise HTTPException(403, "invalid internal token")

    from .admin import _run_auto_refresh
    return await _run_auto_refresh(db)
