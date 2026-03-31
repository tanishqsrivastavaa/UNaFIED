"""
Schemas for conversation participant management
"""

from sqlmodel import SQLModel, Field
from datetime import datetime
import uuid
from typing import Optional


class ParticipantRead(SQLModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str  # Joined from User table
    role: str
    joined_at: datetime
    is_active: bool


class ParticipantInvite(SQLModel):
    email: str = Field(min_length=3, max_length=255)


class OwnershipTransfer(SQLModel):
    new_owner_id: uuid.UUID


class VisibilityUpdate(SQLModel):
    is_public: bool
