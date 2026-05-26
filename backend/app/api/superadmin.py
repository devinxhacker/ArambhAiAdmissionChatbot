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
