import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from ..core.clock import utcnow, UTCDateTime


class Reminder(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # Who gets reminded. Each person in the chat gets their own row.
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    # Where it came from. Kept if the chat is deleted, since the meeting still happens.
    conversation_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="conversation.id", index=True, ondelete="SET NULL"
    )
    message_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="message.id", index=True, ondelete="SET NULL"
    )
    title: str
    due_at: datetime = Field(sa_type=UTCDateTime, index=True)
    status: str = Field(default="proposed")  # proposed | confirmed | sent | dismissed
    created_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
    updated_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
