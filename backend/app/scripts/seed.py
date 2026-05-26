"""Seed an admin user on first boot. Idempotent."""
import asyncio
from ..core.config import get_settings
from ..core.database import get_db, ensure_indexes
from ..core.logging import configure_logging, get_logger
from ..core.security import hash_password


async def seed_admin() -> None:
    s = get_settings()
    db = get_db()
    existing = await db.users.find_one({"email": s.admin_email.lower()})
    if existing:
        # Ensure the seeded admin is always superadmin
        if existing.get("role") != "superadmin":
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {"role": "superadmin", "updated_at": __import__("datetime").datetime.utcnow()}},
            )
        return
    await db.users.insert_one(
        {
            "email": s.admin_email.lower(),
            "name": s.admin_name,
            "password_hash": hash_password(s.admin_password),
            "role": "superadmin",
            "created_at": __import__("datetime").datetime.utcnow(),
            "updated_at": __import__("datetime").datetime.utcnow(),
        }
    )


async def main() -> None:
    configure_logging()
    await ensure_indexes()
    await seed_admin()
    get_logger("seed").info("seed complete")


if __name__ == "__main__":
    asyncio.run(main())
