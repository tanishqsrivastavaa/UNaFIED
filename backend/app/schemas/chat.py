from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import List, Optional
import uuid


class ConversationCreate(SQLModel):
    title: str | None = None
    is_public: bool = False


class ConversationRead(SQLModel):
    id: uuid.UUID
    title: str
    is_public: bool
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    participant_count: int = 0


class MessageRead(SQLModel):
    id: uuid.UUID
    sender_id: Optional[uuid.UUID]
    role: str
    content: str
    suggestion: dict | None = None
    is_proactive: bool = False
    created_at: datetime


class ConversationDetail(ConversationRead):
    messages: List[MessageRead] = []


class MessageCreate(SQLModel):
    content: str = Field(min_length=1, max_length=4000)
