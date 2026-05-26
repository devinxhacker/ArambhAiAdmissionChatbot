from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class Citation(BaseModel):
    source_url: Optional[str] = None
    title: Optional[str] = None
    snippet: Optional[str] = None
    score: Optional[float] = None
    chunk_id: Optional[str] = None


class MessageBase(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class MessageOut(MessageBase):
    id: str
    conversation_id: str
    citations: list[Citation] = Field(default_factory=list)
    confidence: Optional[float] = None
    language: Optional[str] = None
    created_at: datetime


class AskRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    language: Optional[str] = None  # auto-detect when None
    stream: bool = True
    web_search: Optional[bool] = None  # explicit user toggle


class ConversationOut(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime
