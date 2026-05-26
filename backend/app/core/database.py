"""Async Mongo client (Motor) — works for both local Mongo and MongoDB Atlas."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import get_settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        uri = get_settings().mongo_uri
        if not uri:
            raise RuntimeError(
                "MONGO_URI is not set. Paste your MongoDB Atlas SRV connection string into .env."
            )
        _client = AsyncIOMotorClient(
            uri,
            tz_aware=True,
            serverSelectionTimeoutMS=15000,
            appname="arambh-backend",
        )
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[get_settings().mongo_db]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.conversations.create_index([("user_id", 1), ("updated_at", -1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.documents.create_index("source_url")
    await db.documents.create_index("hash", unique=True, sparse=True)
    await db.crawl_jobs.create_index([("status", 1), ("scheduled_for", 1)])
    await db.analytics.create_index([("event", 1), ("ts", -1)])
