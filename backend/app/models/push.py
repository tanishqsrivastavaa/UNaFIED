import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field
from ..core.clock import utcnow, UTCDateTime


class PushSubscription(SQLModel, table=True):
    """One browser that asked for reminder alerts while the app is closed."""

    __tablename__ = "push_subscription"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    # The push service's address for this browser. Unique, so a browser that
    # signs in as someone else moves to them instead of alerting both.
    endpoint: str = Field(unique=True)
    # The browser's keys; the payload is encrypted to them.
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
