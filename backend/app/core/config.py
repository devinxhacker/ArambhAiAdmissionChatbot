"""Centralised settings (12-factor) — pulled from environment."""
from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # General
    env: str = "development"
    log_level: str = "INFO"
    project_name: str = "arambh-backend"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_cors_origins: str = "http://localhost:5173"

    # Mongo (Atlas SRV URI expected; no local fallback)
    mongo_uri: str = ""
    mongo_db: str = "arambh"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # JWT
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 60
    jwt_refresh_ttl_days: int = 14

    # Admin seed
    admin_email: str = "admin@arambh.local"
    admin_password: str = "ChangeMe!2025"
    admin_name: str = "Arambh Admin"

    # AI service
    ai_service_url: str = "http://ai-services:8100"

    # Storage
    data_dir: str = "/data"
    upload_dir: str = "/data/uploads"

    # Rate limit
    rate_limit_per_minute: int = 60

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
