"""Public and admin college routes."""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.database import get_db
from ..core.deps import current_user, require_role

router = APIRouter(prefix="/api/colleges", tags=["colleges"])


# ─── Public routes ─────────────────────────────────────────────────────────────

@router.get("")
async def list_colleges(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    type: Optional[str] = None,
    state: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {"isActive": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if type:
        query["type"] = type
    if state:
        query["address.state"] = {"$regex": state, "$options": "i"}

    total = await db.colleges.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.colleges.find(query).sort("ranking", 1).skip(skip).limit(limit)
    colleges = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        colleges.append(c)

    return {
        "colleges": colleges,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/compare")
async def compare_colleges(ids: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Compare multiple colleges by comma-separated IDs."""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if len(id_list) < 2:
        raise HTTPException(400, "provide at least 2 college IDs")
    try:
        oids = [ObjectId(i) for i in id_list]
    except Exception:
        raise HTTPException(400, "invalid college ID format")

    colleges = []
    async for c in db.colleges.find({"_id": {"$in": oids}}):
        c["_id"] = str(c["_id"])
        colleges.append(c)
    return colleges


@router.get("/{slug}")
async def get_college_by_slug(slug: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    college = await db.colleges.find_one({"slug": slug, "isActive": True})
    if not college:
        # Try by ID as fallback
        try:
            college = await db.colleges.find_one({"_id": ObjectId(slug)})
        except Exception:
            pass
    if not college:
        raise HTTPException(404, "college not found")
    college["_id"] = str(college["_id"])
    return college


# ─── Admin routes (college admin manages their own college) ────────────────────

@router.get("/my/college")
async def get_my_college(
    user: dict = Depends(require_role("admin", "superadmin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    college = await db.colleges.find_one({"admin_id": str(user["_id"])})
    if not college:
        raise HTTPException(404, "no college assigned to you")
    college["_id"] = str(college["_id"])
    return college


@router.patch("/my/college")
async def update_my_college(
    body: dict,
    user: dict = Depends(require_role("admin", "superadmin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    college = await db.colleges.find_one({"admin_id": str(user["_id"])})
    if not college:
        raise HTTPException(404, "no college assigned to you")

    body["updated_at"] = datetime.now(timezone.utc)
    # Don't allow changing admin_id or _id
    body.pop("_id", None)
    body.pop("admin_id", None)

    await db.colleges.update_one({"_id": college["_id"]}, {"$set": body})
    updated = await db.colleges.find_one({"_id": college["_id"]})
    updated["_id"] = str(updated["_id"])
    return updated


@router.post("/my/faqs")
async def add_faq(
    body: dict,
    user: dict = Depends(require_role("admin", "superadmin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    college = await db.colleges.find_one({"admin_id": str(user["_id"])})
    if not college:
        raise HTTPException(404, "no college assigned")

    faq = {
        "_id": str(ObjectId()),
        "question": body.get("question", ""),
        "answer": body.get("answer", ""),
        "created_at": datetime.now(timezone.utc),
    }
    await db.colleges.update_one(
        {"_id": college["_id"]},
        {"$push": {"faqs": faq}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    updated = await db.colleges.find_one({"_id": college["_id"]})
    return updated.get("faqs", [])


@router.delete("/my/faqs/{faq_id}")
async def delete_faq(
    faq_id: str,
    user: dict = Depends(require_role("admin", "superadmin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    college = await db.colleges.find_one({"admin_id": str(user["_id"])})
    if not college:
        raise HTTPException(404, "no college assigned")

    await db.colleges.update_one(
        {"_id": college["_id"]},
        {"$pull": {"faqs": {"_id": faq_id}}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    updated = await db.colleges.find_one({"_id": college["_id"]})
    return updated.get("faqs", [])


@router.post("/my/urls")
async def add_website_url(
    body: dict,
    user: dict = Depends(require_role("admin", "superadmin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    college = await db.colleges.find_one({"admin_id": str(user["_id"])})
    if not college:
        raise HTTPException(404, "no college assigned")

    url_doc = {
        "_id": str(ObjectId()),
        "url": body.get("url", ""),
        "label": body.get("label", ""),
        "status": "pending",
        "chunks_indexed": 0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.colleges.update_one(
        {"_id": college["_id"]},
        {"$push": {"websiteUrls": url_doc}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )

    # Trigger dynamic RAG crawl in the background
    import httpx
    try:
        ai_url = "http://ai-services:8100/ingest/crawl-url"
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(ai_url, json={
                "url": body.get("url", ""),
                "entity_name": body.get("label") or college.get("name", ""),
                "college": college.get("name", ""),
                "max_depth": 2,
                "max_pages": 15,
            })
            if resp.status_code == 200:
                result = resp.json()
                # Update the URL entry with success status
                await db.colleges.update_one(
                    {"_id": college["_id"], "websiteUrls._id": url_doc["_id"]},
                    {"$set": {
                        "websiteUrls.$.status": "completed",
                        "websiteUrls.$.chunks_indexed": result.get("chunks_indexed", 0),
                    }},
                )
            else:
                await db.colleges.update_one(
                    {"_id": college["_id"], "websiteUrls._id": url_doc["_id"]},
                    {"$set": {"websiteUrls.$.status": "failed"}},
                )
    except Exception as e:
        # Don't fail the request — crawl happens best-effort
        await db.colleges.update_one(
            {"_id": college["_id"], "websiteUrls._id": url_doc["_id"]},
            {"$set": {"websiteUrls.$.status": "failed"}},
        )

    updated = await db.colleges.find_one({"_id": college["_id"]})
    return updated.get("websiteUrls", [])


@router.delete("/my/urls/{url_id}")
async def delete_website_url(
    url_id: str,
    user: dict = Depends(require_role("admin", "superadmin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    college = await db.colleges.find_one({"admin_id": str(user["_id"])})
    if not college:
        raise HTTPException(404, "no college assigned")

    await db.colleges.update_one(
        {"_id": college["_id"]},
        {"$pull": {"websiteUrls": {"_id": url_id}}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    updated = await db.colleges.find_one({"_id": college["_id"]})
    return updated.get("websiteUrls", [])
