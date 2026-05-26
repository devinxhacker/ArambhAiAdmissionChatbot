from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    college: Optional[str] = None
    state: Optional[str] = None
    category: Optional[str] = None  # fees / placements / cutoff / scholarship / etc.
    year: Optional[int] = None
    language: Optional[str] = "en"
    tags: list[str] = Field(default_factory=list)


class DocumentOut(BaseModel):
    id: str
    title: str
    source_url: Optional[str] = None
    source_type: str  # html | pdf | upload | api
    metadata: DocumentMetadata
    chunk_count: int = 0
    hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CrawlSource(BaseModel):
    name: str
    seed_urls: list[str]
    allowed_domains: list[str] = Field(default_factory=list)
    schedule_cron: Optional[str] = None  # "0 3 * * *"
    max_depth: int = 3
    enabled: bool = True
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)


class CrawlJob(BaseModel):
    id: str
    source_id: Optional[str] = None
    status: str  # pending | running | success | failed
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    pages_crawled: int = 0
    pages_indexed: int = 0
    error: Optional[str] = None
