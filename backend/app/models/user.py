import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    auth_provider: str | None = Field(default=None)


class UserPreferences(SQLModel, table=True):
    __tablename__ = "user_preferences"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", unique=True, index=True)

    enable_proactive_recommendations: bool = Field(default=True)
    recommendation_frequency: str = Field(default="medium")

    email_notifications: bool = Field(default=True)
    mention_notifications: bool = Field(default=True)

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
