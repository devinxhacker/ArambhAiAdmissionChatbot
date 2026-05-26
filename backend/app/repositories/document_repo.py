from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId


class DocumentRepo:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db.documents
        self.sources = db.crawl_sources
        self.jobs = db.crawl_jobs

    # Documents
    async def upsert_document(self, doc: dict) -> dict:
        doc.setdefault("created_at", datetime.now(timezone.utc))
        doc["updated_at"] = datetime.now(timezone.utc)
        if "hash" in doc and doc["hash"]:
            await self.col.update_one(
                {"hash": doc["hash"]}, {"$set": doc}, upsert=True
            )
            stored = await self.col.find_one({"hash": doc["hash"]})
        else:
            res = await self.col.insert_one(doc)
            stored = await self.col.find_one({"_id": res.inserted_id})
        return stored

    async def list_documents(self, limit: int = 100, q: Optional[str] = None) -> list[dict]:
        flt: dict = {}
        if q:
            flt["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"source_url": {"$regex": q, "$options": "i"}},
            ]
        cursor = self.col.find(flt).sort("updated_at", -1).limit(limit)
        return [d async for d in cursor]

    async def delete_document(self, doc_id: str) -> int:
        res = await self.col.delete_one({"_id": ObjectId(doc_id)})
        return res.deleted_count

    # Crawl sources
    async def list_sources(self) -> list[dict]:
        return [s async for s in self.sources.find().sort("name", 1)]

    async def add_source(self, source: dict) -> dict:
        source.setdefault("created_at", datetime.now(timezone.utc))
        res = await self.sources.insert_one(source)
        source["_id"] = res.inserted_id
        return source

    async def update_source(self, source_id: str, patch: dict) -> int:
        res = await self.sources.update_one({"_id": ObjectId(source_id)}, {"$set": patch})
        return res.modified_count

    async def delete_source(self, source_id: str) -> int:
        res = await self.sources.delete_one({"_id": ObjectId(source_id)})
        return res.deleted_count

    # Crawl jobs
    async def add_job(self, job: dict) -> dict:
        job.setdefault("created_at", datetime.now(timezone.utc))
        res = await self.jobs.insert_one(job)
        job["_id"] = res.inserted_id
        return job

    async def list_jobs(self, limit: int = 50) -> list[dict]:
        return [j async for j in self.jobs.find().sort("created_at", -1).limit(limit)]
