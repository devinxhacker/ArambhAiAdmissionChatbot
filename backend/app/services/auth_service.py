from fastapi import HTTPException, status
from ..core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from ..repositories.user_repo import UserRepo
from ..models.user import UserCreate, UserLogin, TokenPair


class AuthService:
    def __init__(self, repo: UserRepo) -> None:
        self.repo = repo

    async def register(self, body: UserCreate) -> dict:
        existing = await self.repo.get_by_email(body.email)
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
        return await self.repo.create(
            email=body.email, name=body.name, password_hash=hash_password(body.password)
        )

    async def login(self, body: UserLogin) -> TokenPair:
        user = await self.repo.get_by_email(body.email)
        if not user or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
        return TokenPair(
            access_token=create_access_token(user["email"], user["role"]),
            refresh_token=create_refresh_token(user["email"], user["role"]),
        )

    async def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token)
        except ValueError as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc))
        if payload.get("type") != "refresh":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong token type")
        return TokenPair(
            access_token=create_access_token(payload["sub"], payload["role"]),
            refresh_token=create_refresh_token(payload["sub"], payload["role"]),
        )
