from pymongo import MongoClient
from .config import get_settings

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        uri = get_settings().mongo_uri
        if not uri:
            raise RuntimeError(
                "MONGO_URI is not set. Paste your MongoDB Atlas SRV connection string into .env."
            )
        _client = MongoClient(
            uri,
            tz_aware=True,
            serverSelectionTimeoutMS=15000,
            appname="arambh-crawler",
        )
    return _client


def get_db():
    return get_client()[get_settings().mongo_db]
