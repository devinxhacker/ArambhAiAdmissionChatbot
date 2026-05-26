from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
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
