"""JWT + password hashing utilities."""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from .config import get_settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def _encode(payload: dict[str, Any], minutes: int) -> str:
    s = get_settings()
    to_encode = payload.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode(to_encode, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_access_token(sub: str, role: str) -> str:
    s = get_settings()
    return _encode({"sub": sub, "role": role, "type": "access"}, s.jwt_access_ttl_min)


def create_refresh_token(sub: str, role: str) -> str:
    s = get_settings()
    return _encode({"sub": sub, "role": role, "type": "refresh"}, 60 * 24 * s.jwt_refresh_ttl_days)


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as exc:  # noqa: BLE001
        raise ValueError("invalid token") from exc
