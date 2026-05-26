from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    log_level: str = "INFO"
    mongo_uri: str = ""
    mongo_db: str = "arambh"

    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    ai_service_url: str = "http://ai-services:8100"

    user_agent: str = "ArambhBot/0.1 (+https://arambh.local/bot)"
    max_depth: int = 4
    max_pages: int = 500
    rate_limit_per_domain: float = 2.0
    concurrency: int = 16
    respect_robots: bool = True

    raw_html_dir: str = "/data/raw/html"
    raw_pdf_dir: str = "/data/raw/pdf"
    processed_dir: str = "/data/processed"

    # Read crawler-specific env names (with prefix)
    @classmethod
    def from_env(cls) -> "Settings":
        import os
        kwargs = dict(
            user_agent=os.getenv("CRAWLER_USER_AGENT", "ArambhBot/0.1"),
            max_depth=int(os.getenv("CRAWLER_MAX_DEPTH", "4")),
            max_pages=int(os.getenv("CRAWLER_MAX_PAGES", "500")),
            rate_limit_per_domain=float(os.getenv("CRAWLER_RATE_LIMIT_PER_DOMAIN", "2.0")),
            concurrency=int(os.getenv("CRAWLER_CONCURRENCY", "16")),
            respect_robots=os.getenv("CRAWLER_RESPECT_ROBOTS", "true").lower() == "true",
        )
        return cls(**kwargs)


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
