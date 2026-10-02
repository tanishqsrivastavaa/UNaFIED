import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional
from ..core.clock import utcnow, UTCDateTime


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
    auth_provider: str | None = Field(default=None)
    # IANA name such as "Asia/Kolkata", set from the browser on sign-in.
    timezone: str = Field(default="UTC")


class UserPreferences(SQLModel, table=True):
    __tablename__ = "user_preferences"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", unique=True, index=True)

    enable_proactive_recommendations: bool = Field(default=True)
    recommendation_frequency: str = Field(default="medium")

    # Email is opt-in, and only sent when the server has SMTP settings.
    email_notifications: bool = Field(default=False)
    mention_notifications: bool = Field(default=True)
    # How long before a reminder's time the alert goes out.
    reminder_lead_minutes: int = Field(default=15)

    created_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
    updated_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
