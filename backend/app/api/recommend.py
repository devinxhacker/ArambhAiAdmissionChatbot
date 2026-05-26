from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from ..core.deps import current_user
from ..services.ai_client import get_ai_client

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


class RecommendBody(BaseModel):
    rank: Optional[int] = None
    budget: Optional[int] = None  # INR / year
    state: Optional[str] = None
    branch: Optional[str] = None
    needs_hostel: Optional[bool] = None
    placement_min_lpa: Optional[float] = None
    language: Optional[str] = "en"


@router.post("")
async def recommend(body: RecommendBody, _: dict = Depends(current_user)) -> dict:
    return await get_ai_client().recommend(body.model_dump())
