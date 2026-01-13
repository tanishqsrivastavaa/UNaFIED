from sqlmodel import SQLModel
from datetime import datetime
from typing import List
import uuid

class ConversationCreate(SQLModel):
    title: str | None=None

class ConversationRead(SQLModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

class MessageRead(SQLModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

class ConversationDetail(ConversationRead):
    messages: List[MessageRead]= []

class MessageCreate(SQLModel):
    content: str