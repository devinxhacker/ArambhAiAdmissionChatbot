"""Admin-only routes: user mgmt, document upload, crawler control, analytics."""
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from ..core.config import get_settings
from ..core.database import get_db
from ..core.deps import require_role
from ..repositories.document_repo import DocumentRepo
from ..repositories.user_repo import UserRepo
from ..services.ai_client import get_ai_client

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_role("admin", "superadmin"))])


# -------- Users --------
@router.get("/users")
async def list_users(db: AsyncIOMotorDatabase = Depends(get_db)):
    users = await UserRepo(db).list_users()
    return [
        {"id": str(u["_id"]), "email": u["email"], "name": u["name"], "role": u["role"], "created_at": u["created_at"]}
        for u in users
    ]


# -------- Documents (upload) --------
@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    college: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    s = get_settings()
    os.makedirs(s.upload_dir, exist_ok=True)
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in {".pdf", ".txt", ".html", ".md"}:
        raise HTTPException(400, "unsupported file type (allowed: pdf, txt, html, md)")
    target = os.path.join(s.upload_dir, f"{uuid.uuid4().hex}{suffix}")
    with open(target, "wb") as out:
        shutil.copyfileobj(file.file, out)

    # Hand off to AI service for parsing/chunking/embedding
    ai = get_ai_client()
    result = await ai.ingest_document(
        content="",  # ai-service will read file path
        metadata={
            "file_path": target,
            "title": file.filename,
            "source_type": "upload",
            "college": college,
            "category": category,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"path": target, "ingest": result}


@router.get("/documents")
async def list_documents(q: Optional[str] = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    docs = await DocumentRepo(db).list_documents(q=q)
    return [{**d, "_id": str(d["_id"])} for d in docs]


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    n = await DocumentRepo(db).delete_document(doc_id)
    return {"deleted": n}


# -------- Crawl sources --------
class SourceBody(BaseModel):
    name: str
    seed_urls: list[str]
    allowed_domains: list[str] = []
    schedule_cron: Optional[str] = None
    max_depth: int = 3
    enabled: bool = True
    metadata: dict = {}


@router.get("/sources")
async def list_sources(db: AsyncIOMotorDatabase = Depends(get_db)):
    items = await DocumentRepo(db).list_sources()
    return [{**s, "_id": str(s["_id"])} for s in items]


@router.post("/sources")
async def add_source(body: SourceBody, db: AsyncIOMotorDatabase = Depends(get_db)):
    res = await DocumentRepo(db).add_source(body.model_dump())
    res["_id"] = str(res["_id"])
    return res


@router.patch("/sources/{source_id}")
async def patch_source(source_id: str, body: dict, db: AsyncIOMotorDatabase = Depends(get_db)):
    n = await DocumentRepo(db).update_source(source_id, body)
    return {"modified": n}


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    n = await DocumentRepo(db).delete_source(source_id)
    return {"deleted": n}


# -------- Crawl control --------
class CrawlTrigger(BaseModel):
    source_id: Optional[str] = None
    url: Optional[str] = None  # ad-hoc one-off URL


@router.post("/crawl/trigger")
async def trigger_crawl(body: CrawlTrigger, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Push a job onto the celery queue.

    We don't import the Celery library here (the backend service doesn't ship
    it). Instead we publish a Celery-formatted message directly to Redis using
    the redis client already wired into the gateway. The crawler worker is
    subscribed to the same queue and picks it up.
    """
    import json
    import uuid
    import base64

    from ..core.redis_client import get_redis

    broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")
    queue = "celery"
    task_name = "crawler.tasks.run_crawl"
    task_id = str(uuid.uuid4())
    body_payload = base64.b64encode(
        json.dumps([[body.model_dump()], {}, {"callbacks": None, "errbacks": None, "chain": None, "chord": None}]).encode()
    ).decode()

    message = {
        "body": body_payload,
        "content-encoding": "utf-8",
        "content-type": "application/json",
        "headers": {
            "lang": "py",
            "task": task_name,
            "id": task_id,
            "shadow": None,
            "eta": None,
            "expires": None,
            "group": None,
            "group_index": None,
            "retries": 0,
            "timelimit": [None, None],
            "root_id": task_id,
            "parent_id": None,
            "argsrepr": repr([body.model_dump()]),
            "kwargsrepr": "{}",
            "origin": "arambh-backend",
        },
        "properties": {
            "correlation_id": task_id,
            "reply_to": "",
            "delivery_mode": 2,
            "delivery_info": {"exchange": "", "routing_key": queue},
            "priority": 0,
            "body_encoding": "base64",
            "delivery_tag": str(uuid.uuid4()),
        },
    }

    # Publish using a *separate* Redis connection because backend's default
    # client uses DB 0 while Celery uses DB 1.
    import redis.asyncio as redis_async
    cli = redis_async.from_url(broker_url, decode_responses=True)
    try:
        await cli.lpush(queue, json.dumps(message))
    finally:
        await cli.close()

    return {"task_id": task_id, "status": "queued"}


@router.get("/crawl/jobs")
async def list_jobs(db: AsyncIOMotorDatabase = Depends(get_db)):
    items = await DocumentRepo(db).list_jobs()
    return [{**j, "_id": str(j["_id"])} for j in items]


@router.get("/crawl/jobs/{job_id}")
async def get_job(job_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    from bson import ObjectId
    try:
        obj = ObjectId(job_id)
    except Exception:
        raise HTTPException(400, "invalid job_id")
    job = await db.crawl_jobs.find_one({"_id": obj})
    if not job:
        raise HTTPException(404, "job not found")
    job["_id"] = str(job["_id"])
    return job


@router.get("/crawl/jobs/{job_id}/events")
async def stream_job_events(job_id: str):
    """Server-Sent Events stream of per-page crawl events from Redis.

    Tail Redis list `crawl:events:<job_id>` and keep the connection open until
    the job is no longer running. The frontend uses this to render a live feed.
    """
    import asyncio as _asyncio
    import json as _json
    import redis.asyncio as _redis_async
    from sse_starlette.sse import EventSourceResponse

    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    cli = _redis_async.from_url(redis_url, decode_responses=True)
    key = f"crawl:events:{job_id}"

    async def _gen():
        cursor = 0
        idle = 0
        try:
            while True:
                # LRANGE is cheap on small lists; we keep cursor on the client side.
                items = await cli.lrange(key, cursor, -1)
                if items:
                    cursor += len(items)
                    idle = 0
                    for raw in items:
                        try:
                            yield {"event": "event", "data": _json.dumps(_json.loads(raw))}
                        except Exception:
                            continue
                else:
                    idle += 1
                    # send keep-alive comment so connection isn't dropped by proxies
                    yield {"event": "ping", "data": "{}"}
                if idle > 240:  # ~4 min of silence -> assume done
                    break
                await _asyncio.sleep(1.0)
        finally:
            await cli.close()

    return EventSourceResponse(_gen())


# -------- Reindex (rebuild vectors) --------
@router.post("/reindex")
async def reindex(body: CrawlTrigger):
    return await get_ai_client().trigger_reindex(body.source_id)


# -------- Analytics --------
@router.get("/analytics/summary")
async def analytics_summary(db: AsyncIOMotorDatabase = Depends(get_db)):
    users = await db.users.count_documents({})
    convs = await db.conversations.count_documents({})
    msgs = await db.messages.count_documents({})
    docs = await db.documents.count_documents({})
    failed = await db.crawl_jobs.count_documents({"status": "failed"})

    pipeline = [
        {"$match": {"role": "user"}},
        {"$group": {"_id": {"$substr": ["$content", 0, 80]}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 10},
    ]
    top_queries = [{"q": x["_id"], "n": x["n"]} async for x in db.messages.aggregate(pipeline)]
    return {
        "users": users,
        "conversations": convs,
        "messages": msgs,
        "documents": docs,
        "failed_crawls": failed,
        "top_queries": top_queries,
    }


# -------- Dynamic RAG: Crawl URL --------
class CrawlUrlBody(BaseModel):
    url: str
    entity_name: Optional[str] = None
    college: Optional[str] = None
    max_depth: int = 2
    max_pages: int = 15


@router.post("/crawl-url")
async def crawl_url_endpoint(body: CrawlUrlBody):
    """
    Trigger the Dynamic RAG scraper to crawl a URL and index it into Qdrant.
    Uses Crawl4AI for recursive BFS crawling with BS4 fallback.
    """
    import httpx

    ai_url = f"{get_settings().ai_service_url}/ingest/crawl-url"
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(ai_url, json=body.model_dump())
            if resp.status_code != 200:
                detail = resp.json().get("detail", resp.text)
                raise HTTPException(resp.status_code, detail)
            return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "Crawl timed out — the URL may be too large or slow")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Failed to reach AI service: {exc}")
