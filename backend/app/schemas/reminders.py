from datetime import datetime
from typing import Literal, Optional
import uuid
from pydantic import AwareDatetime
from sqlmodel import SQLModel, Field


class ReminderRead(SQLModel):
    id: uuid.UUID
    conversation_id: Optional[uuid.UUID]
    message_id: Optional[uuid.UUID]
    title: str
    due_at: datetime
    status: str
    created_at: datetime


class ReminderUpdate(SQLModel):
    """Confirm, cancel or edit. The server alone sets proposed and sent."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    # A time without a zone is ambiguous, so it is rejected.
    due_at: Optional[AwareDatetime] = None
    status: Optional[Literal["confirmed", "dismissed"]] = None
