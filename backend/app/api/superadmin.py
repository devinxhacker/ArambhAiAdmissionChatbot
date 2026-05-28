"""Superadmin-only routes: manage colleges, create/manage admins, platform analytics."""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field

from ..core.database import get_db
from ..core.deps import require_role
from ..core.security import hash_password
from ..repositories.user_repo import UserRepo

router = APIRouter(
    prefix="/api/superadmin",
    tags=["superadmin"],
    dependencies=[Depends(require_role("superadmin"))],
)


# ─── Schemas ───────────────────────────────────────────────────────────────────

class CreateCollegeBody(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    websiteUrl: str = ""
    contactEmail: str = ""
    contactPhone: str = ""
    type: str = "Private"
    address: dict = {}


class CreateAdminBody(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    collegeId: Optional[str] = None


class ResetPasswordBody(BaseModel):
    password: str = Field(min_length=8)


# ─── Colleges ──────────────────────────────────────────────────────────────────

@router.get("/colleges")
async def list_colleges(
    search: Optional[str] = None,
    limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    cursor = db.colleges.find(query).sort("created_at", -1).limit(limit)
    colleges = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        # Attach admin info if assigned
        if c.get("admin_id"):
            admin = await db.users.find_one({"_id": ObjectId(c["admin_id"])})
            c["admin"] = {"name": admin["name"], "email": admin["email"]} if admin else None
        else:
            c["admin"] = None
        colleges.append(c)
    total = await db.colleges.count_documents(query)
    return {"colleges": colleges, "total": total}


@router.post("/colleges")
async def create_college(body: CreateCollegeBody, db: AsyncIOMotorDatabase = Depends(get_db)):
    # Generate slug from name
    slug = body.name.lower().replace(" ", "-").replace(".", "")
    existing = await db.colleges.find_one({"slug": slug})
    if existing:
        raise HTTPException(409, "A college with this name already exists")

    now = datetime.now(timezone.utc)
    doc = {
        "name": body.name,
        "slug": slug,
        "description": body.description,
        "websiteUrl": body.websiteUrl,
        "contactEmail": body.contactEmail,
        "contactPhone": body.contactPhone,
        "type": body.type,
        "address": body.address,
        "admin_id": None,
        "isActive": True,
        "isVerified": False,
        "courses": [],
        "departments": [],
        "facilities": [],
        "faqs": [],
        "websiteUrls": [],
        "placements": [],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.colleges.insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    return doc


@router.delete("/colleges/{college_id}")
async def deactivate_college(college_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(college_id)
    except Exception:
        raise HTTPException(400, "invalid college_id")
    result = await db.colleges.update_one(
        {"_id": oid},
        {"$set": {"isActive": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "college not found")
    return {"deactivated": True}


# ─── Admin Management ──────────────────────────────────────────────────────────

@router.get("/admins")
async def list_admins(db: AsyncIOMotorDatabase = Depends(get_db)):
    cursor = db.users.find({"role": "admin"}).sort("created_at", -1)
    admins = []
    async for u in cursor:
        u["_id"] = str(u["_id"])
        # Attach college info
        college = await db.colleges.find_one({"admin_id": str(u["_id"])})
        u["college"] = {"name": college["name"], "_id": str(college["_id"])} if college else None
        u.pop("password_hash", None)
        admins.append(u)
    total = await db.users.count_documents({"role": "admin"})
    return {"admins": admins, "total": total}


@router.post("/admins")
async def create_admin(body: CreateAdminBody, db: AsyncIOMotorDatabase = Depends(get_db)):
    # Check if email already exists
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(409, "Email already registered")

    now = datetime.now(timezone.utc)
    user_doc = {
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "admin",
        "isSuspended": False,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.users.insert_one(user_doc)
    admin_id = str(res.inserted_id)

    # Assign to college if provided
    if body.collegeId:
        try:
            college_oid = ObjectId(body.collegeId)
        except Exception:
            raise HTTPException(400, "invalid collegeId")
        await db.colleges.update_one(
            {"_id": college_oid},
            {"$set": {"admin_id": admin_id, "updated_at": now}},
        )

    return {"id": admin_id, "email": body.email, "name": body.name}


@router.patch("/admins/{admin_id}")
async def patch_admin(admin_id: str, body: dict, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(admin_id)
    except Exception:
        raise HTTPException(400, "invalid admin_id")

    allowed = {"isSuspended", "name", "collegeId"}
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        raise HTTPException(400, "nothing to update")

    # Handle college assignment
    if "collegeId" in update:
        college_id = update.pop("collegeId")
        if college_id:
            await db.colleges.update_one(
                {"_id": ObjectId(college_id)},
                {"$set": {"admin_id": admin_id, "updated_at": datetime.now(timezone.utc)}},
            )
        # Unassign from previous college
        await db.colleges.update_many(
            {"admin_id": admin_id, "_id": {"$ne": ObjectId(college_id) if college_id else None}},
            {"$set": {"admin_id": None}},
        )

    if update:
        update["updated_at"] = datetime.now(timezone.utc)
        await db.users.update_one({"_id": oid}, {"$set": update})

    return {"modified": True}


@router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(admin_id)
    except Exception:
        raise HTTPException(400, "invalid admin_id")

    # Unassign from any college
    await db.colleges.update_many(
        {"admin_id": admin_id},
        {"$set": {"admin_id": None, "updated_at": datetime.now(timezone.utc)}},
    )
    result = await db.users.delete_one({"_id": oid, "role": "admin"})
    if result.deleted_count == 0:
        raise HTTPException(404, "admin not found")
    return {"deleted": True}


@router.post("/admins/{admin_id}/reset-password")
async def reset_admin_password(
    admin_id: str,
    body: ResetPasswordBody,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(admin_id)
    except Exception:
        raise HTTPException(400, "invalid admin_id")
    result = await db.users.update_one(
        {"_id": oid, "role": "admin"},
        {"$set": {"password_hash": hash_password(body.password), "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "admin not found")
    return {"reset": True}


# ─── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {"role": "user"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.users.find(query).sort("created_at", -1).limit(100)
    users = []
    async for u in cursor:
        u["_id"] = str(u["_id"])
        u.pop("password_hash", None)
        users.append(u)
    total = await db.users.count_documents(query)
    return {"users": users, "total": total}


@router.patch("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(400, "invalid user_id")
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "user not found")
    new_status = not user.get("isSuspended", False)
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"isSuspended": new_status, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"isSuspended": new_status}


# ─── Platform Stats ────────────────────────────────────────────────────────────

@router.get("/stats")
async def platform_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    total_users = await db.users.count_documents({"role": "user"})
    total_admins = await db.users.count_documents({"role": "admin"})
    total_colleges = await db.colleges.count_documents({})
    total_sessions = await db.conversations.count_documents({})

    # Active users today
    from datetime import date
    today_start = datetime.combine(date.today(), datetime.min.time())
    active_today = await db.messages.distinct("conversation_id", {"created_at": {"$gte": today_start}})
    queries_today = await db.messages.count_documents({"role": "user", "created_at": {"$gte": today_start}})

    # Daily signups (last 7 days)
    pipeline_signups = [
        {"$match": {"role": "user", "created_at": {"$gte": datetime(today_start.year, today_start.month, today_start.day - 6 if today_start.day > 6 else 1)}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    daily_signups = [x async for x in db.users.aggregate(pipeline_signups)]

    # Daily queries (last 7 days)
    pipeline_queries = [
        {"$match": {"role": "user", "created_at": {"$gte": datetime(today_start.year, today_start.month, today_start.day - 6 if today_start.day > 6 else 1)}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    daily_queries = [x async for x in db.messages.aggregate(pipeline_queries)]

    # Top colleges by query count (placeholder — would need college tagging on messages)
    top_colleges = []

    return {
        "totalUsers": total_users,
        "totalAdmins": total_admins,
        "totalColleges": total_colleges,
        "totalSessions": total_sessions,
        "activeUsersToday": len(active_today),
        "queriesToday": queries_today,
        "dailySignups": daily_signups,
        "dailyQueries": daily_queries,
        "topColleges": top_colleges,
    }


# ─── Crawl Analytics & Data Explorer ──────────────────────────────────────────

@router.get("/crawl/overview")
async def crawl_overview(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get overall crawl statistics across all colleges."""
    # Total documents indexed
    total_docs = await db.documents.count_documents({})
    total_web_crawl = await db.documents.count_documents({"source_type": "web_crawl"})
    total_upload = await db.documents.count_documents({"source_type": {"$in": ["upload", "pdf"]}})
    total_html = await db.documents.count_documents({"source_type": "html"})

    # Total chunks
    pipeline_chunks = [
        {"$group": {"_id": None, "total_chunks": {"$sum": "$chunk_count"}}}
    ]
    chunks_result = [x async for x in db.documents.aggregate(pipeline_chunks)]
    total_chunks = chunks_result[0]["total_chunks"] if chunks_result else 0

    # Crawl jobs stats
    total_jobs = await db.crawl_jobs.count_documents({})
    successful_jobs = await db.crawl_jobs.count_documents({"status": "success"})
    failed_jobs = await db.crawl_jobs.count_documents({"status": "failed"})
    running_jobs = await db.crawl_jobs.count_documents({"status": "running"})

    # Website URLs across all colleges
    pipeline_urls = [
        {"$unwind": "$websiteUrls"},
        {"$group": {
            "_id": "$websiteUrls.status",
            "count": {"$sum": 1},
            "total_chunks": {"$sum": "$websiteUrls.chunks_indexed"},
            "total_pages": {"$sum": "$websiteUrls.pages_crawled"},
        }},
    ]
    url_stats = [x async for x in db.colleges.aggregate(pipeline_urls)]
    url_by_status = {s["_id"]: s for s in url_stats}

    total_urls = sum(s["count"] for s in url_stats)
    indexed_urls = url_by_status.get("completed", {}).get("count", 0)
    pending_urls = url_by_status.get("pending", {}).get("count", 0)
    failed_urls = url_by_status.get("failed", {}).get("count", 0)
    scraping_urls = url_by_status.get("scraping", {}).get("count", 0)

    # Recent crawl activity (last 7 days)
    from datetime import timedelta
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    pipeline_daily = [
        {"$match": {"updated_at": {"$gte": seven_days_ago}, "source_type": "web_crawl"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$updated_at"}},
            "docs_indexed": {"$sum": 1},
            "chunks_created": {"$sum": "$chunk_count"},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily_activity = [x async for x in db.documents.aggregate(pipeline_daily)]

    # Top colleges by indexed content
    pipeline_top = [
        {"$match": {"websiteUrls": {"$exists": True, "$ne": []}}},
        {"$project": {
            "name": 1,
            "url_count": {"$size": "$websiteUrls"},
            "total_chunks": {"$sum": "$websiteUrls.chunks_indexed"},
            "total_pages": {"$sum": "$websiteUrls.pages_crawled"},
        }},
        {"$sort": {"total_chunks": -1}},
        {"$limit": 10},
    ]
    top_colleges = [x async for x in db.colleges.aggregate(pipeline_top)]
    for c in top_colleges:
        c["_id"] = str(c["_id"])

    return {
        "documents": {
            "total": total_docs,
            "web_crawl": total_web_crawl,
            "upload": total_upload,
            "html": total_html,
            "total_chunks": total_chunks,
        },
        "crawl_jobs": {
            "total": total_jobs,
            "successful": successful_jobs,
            "failed": failed_jobs,
            "running": running_jobs,
        },
        "website_urls": {
            "total": total_urls,
            "indexed": indexed_urls,
            "pending": pending_urls,
            "failed": failed_urls,
            "scraping": scraping_urls,
        },
        "daily_activity": daily_activity,
        "top_colleges": top_colleges,
    }


@router.get("/crawl/urls")
async def crawl_urls_list(
    status: Optional[str] = None,
    college: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all website URLs across all colleges with their crawl status."""
    pipeline = [
        {"$match": {"websiteUrls": {"$exists": True, "$ne": []}}},
        {"$unwind": "$websiteUrls"},
    ]

    if status:
        pipeline.append({"$match": {"websiteUrls.status": status}})
    if college:
        pipeline.append({"$match": {"name": {"$regex": college, "$options": "i"}}})

    pipeline.extend([
        {"$sort": {"websiteUrls.created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$project": {
            "college_name": "$name",
            "college_id": {"$toString": "$_id"},
            "url": "$websiteUrls.url",
            "label": "$websiteUrls.label",
            "status": "$websiteUrls.status",
            "chunks_indexed": "$websiteUrls.chunks_indexed",
            "pages_crawled": "$websiteUrls.pages_crawled",
            "max_depth": "$websiteUrls.max_depth",
            "max_pages": "$websiteUrls.max_pages",
            "auto_refresh": "$websiteUrls.auto_refresh",
            "refresh_interval_hours": "$websiteUrls.refresh_interval_hours",
            "last_crawled_at": "$websiteUrls.last_crawled_at",
            "next_refresh_at": "$websiteUrls.next_refresh_at",
            "last_refresh_result": "$websiteUrls.last_refresh_result",
            "created_at": "$websiteUrls.created_at",
            "url_id": "$websiteUrls._id",
        }},
    ])

    urls = [x async for x in db.colleges.aggregate(pipeline)]
    for u in urls:
        u["_id"] = str(u.get("_id", ""))

    # Count total
    count_pipeline = [
        {"$match": {"websiteUrls": {"$exists": True, "$ne": []}}},
        {"$unwind": "$websiteUrls"},
    ]
    if status:
        count_pipeline.append({"$match": {"websiteUrls.status": status}})
    if college:
        count_pipeline.append({"$match": {"name": {"$regex": college, "$options": "i"}}})
    count_pipeline.append({"$count": "total"})
    count_result = [x async for x in db.colleges.aggregate(count_pipeline)]
    total = count_result[0]["total"] if count_result else 0

    return {"urls": urls, "total": total}


@router.get("/crawl/documents")
async def crawl_documents_list(
    source_type: Optional[str] = None,
    college: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all indexed documents with their metadata — the data explorer."""
    query = {}
    if source_type:
        query["source_type"] = source_type
    if college:
        query["$or"] = [
            {"metadata.college": {"$regex": college, "$options": "i"}},
            {"title": {"$regex": college, "$options": "i"}},
        ]
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"source_url": {"$regex": search, "$options": "i"}},
            {"doc_id": {"$regex": search, "$options": "i"}},
        ]

    total = await db.documents.count_documents(query)
    cursor = db.documents.find(query).sort("updated_at", -1).skip(skip).limit(limit)
    docs = []
    async for d in cursor:
        d["_id"] = str(d["_id"])
        docs.append(d)

    return {"documents": docs, "total": total}


@router.get("/crawl/documents/{doc_id}")
async def get_document_detail(doc_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get detailed info about a specific document including its chunks."""
    doc = await db.documents.find_one({"doc_id": doc_id})
    if not doc:
        # Try by _id
        try:
            doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
        except Exception:
            pass
    if not doc:
        raise HTTPException(404, "document not found")

    doc["_id"] = str(doc["_id"])
    return doc


@router.delete("/crawl/documents/{doc_id}")
async def delete_document_by_doc_id(doc_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Delete a document and its vectors from the index."""
    import httpx
    from ..core.config import get_settings

    # Delete from Qdrant via ai-services
    try:
        ai_url = f"{get_settings().ai_service_url}/ingest/reindex"
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(ai_url, json={"doc_id": doc_id})
    except Exception:
        pass

    # Delete from MongoDB
    result = await db.documents.delete_one({"doc_id": doc_id})
    if result.deleted_count == 0:
        try:
            result = await db.documents.delete_one({"_id": ObjectId(doc_id)})
        except Exception:
            pass

    return {"deleted": result.deleted_count if result else 0}


@router.get("/crawl/jobs")
async def crawl_jobs_list(
    status: Optional[str] = None,
    limit: int = 30,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List recent crawl jobs."""
    query = {}
    if status:
        query["status"] = status
    cursor = db.crawl_jobs.find(query).sort("created_at", -1).limit(limit)
    jobs = []
    async for j in cursor:
        j["_id"] = str(j["_id"])
        jobs.append(j)
    return {"jobs": jobs}
