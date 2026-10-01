import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field
from ..core.clock import utcnow, UTCDateTime


class CalendarEvent(SQLModel, table=True):
    __tablename__ = "calendar_event"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    title: str
    description: str = ""
    start_time: datetime = Field(sa_type=UTCDateTime)
    end_time: datetime = Field(sa_type=UTCDateTime)
    created_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
