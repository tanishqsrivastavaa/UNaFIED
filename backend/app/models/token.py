import uuid
import hashlib
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from .user import User
from ..core.clock import utcnow, UTCDateTime


def _hash_token(raw_token: str) -> str:
    """SHA-256 hash a token so we never store the raw value."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_token"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime = Field(sa_type=UTCDateTime)
    created_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
    is_revoked: bool = Field(default=False)
