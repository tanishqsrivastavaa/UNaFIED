from sqlmodel import SQLModel
from datetime import datetime
import uuid

class ConversationCreate(SQLModel):
    title: str | None=None

class ConversationRead(SQLModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

