from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import current_user
from ..models.user import UserCreate, UserLogin, UserOut, TokenPair, Role
from ..repositories.user_repo import UserRepo
from ..services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _to_user_out(u: dict) -> UserOut:
    return UserOut(
        id=str(u["_id"]),
        email=u["email"],
        name=u["name"],
        role=Role(u["role"]),
        created_at=u["created_at"],
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    svc = AuthService(UserRepo(db))
    user = await svc.register(body)
    return _to_user_out(user)


@router.post("/login", response_model=TokenPair)
async def login(body: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await AuthService(UserRepo(db)).login(body)


class RefreshBody(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshBody, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await AuthService(UserRepo(db)).refresh(body.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return _to_user_out(user)


class UpdateProfileBody(BaseModel):
    name: str | None = None
    profileImage: str | None = None


@router.patch("/me", response_model=UserOut)
async def update_me(body: UpdateProfileBody, user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    update = {}
    if body.name is not None:
        update["name"] = body.name
    if body.profileImage is not None:
        update["profileImage"] = body.profileImage
    if not update:
        return _to_user_out(user)
    from datetime import datetime, timezone
    update["updated_at"] = datetime.now(timezone.utc)
    from bson import ObjectId
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update})
    updated = await db.users.find_one({"_id": ObjectId(user["_id"])})
    updated["_id"] = str(updated["_id"])
    return _to_user_out(updated)
