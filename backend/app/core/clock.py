from datetime import datetime, timezone

from sqlalchemy import DateTime

# Stored as timestamptz, so Postgres keeps the exact moment and returns zone-aware datetimes.
UTCDateTime = DateTime(timezone=True)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
