from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId


class ConversationRepo:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.conversations = db.conversations
        self.messages = db.messages

    async def create_conversation(self, user_id: str, title: str = "New chat") -> dict:
        now = datetime.now(timezone.utc)
        doc = {"user_id": user_id, "title": title, "created_at": now, "updated_at": now}
        res = await self.conversations.insert_one(doc)
        doc["_id"] = res.inserted_id
        return doc

    async def get_conversation(self, conv_id: str, user_id: str) -> Optional[dict]:
        try:
            return await self.conversations.find_one({"_id": ObjectId(conv_id), "user_id": user_id})
        except Exception:
            return None

    async def list_for_user(self, user_id: str, limit: int = 50) -> list[dict]:
        cursor = self.conversations.find({"user_id": user_id}).sort("updated_at", -1).limit(limit)
        return [c async for c in cursor]

    async def touch(self, conv_id: str) -> None:
        await self.conversations.update_one(
            {"_id": ObjectId(conv_id)},
            {"$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    async def update_title(self, conv_id: str, title: str) -> None:
        await self.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": {"title": title}})

    async def delete(self, conv_id: str, user_id: str) -> int:
        await self.messages.delete_many({"conversation_id": conv_id})
        res = await self.conversations.delete_one({"_id": ObjectId(conv_id), "user_id": user_id})
        return res.deleted_count

    # Messages
    async def add_message(
        self,
        *,
        conversation_id: str,
        role: str,
        content: str,
        citations: list | None = None,
        confidence: float | None = None,
        language: str | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "citations": citations or [],
            "confidence": confidence,
            "language": language,
            "created_at": now,
        }
        res = await self.messages.insert_one(doc)
        doc["_id"] = res.inserted_id
        await self.touch(conversation_id)
        return doc

    async def list_messages(self, conv_id: str, limit: int = 50) -> list[dict]:
        cursor = self.messages.find({"conversation_id": conv_id}).sort("created_at", 1).limit(limit)
        return [m async for m in cursor]
