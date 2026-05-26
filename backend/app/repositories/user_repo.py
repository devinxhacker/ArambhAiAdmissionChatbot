from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId


class UserRepo:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.users

    async def get_by_email(self, email: str) -> Optional[dict]:
        return await self.col.find_one({"email": email.lower()})

    async def get_by_id(self, uid: str) -> Optional[dict]:
        try:
            return await self.col.find_one({"_id": ObjectId(uid)})
        except Exception:
            return None

    async def create(self, *, email: str, name: str, password_hash: str, role: str = "user") -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "email": email.lower(),
            "name": name,
            "password_hash": password_hash,
            "role": role,
            "created_at": now,
            "updated_at": now,
        }
        res = await self.col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return doc

    async def list_users(self, limit: int = 100) -> list[dict]:
        return [u async for u in self.col.find().sort("created_at", -1).limit(limit)]
