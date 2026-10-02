"""
Fires reminders when they come due: marks each one sent, alerts every open tab
of its owner, and emails people who turned email on. "Due" means within the
owner's lead time of the reminder's time.

All state lives in the reminder table, so a restart picks up where it left off,
and the claim below makes each reminder fire once even with several servers.
"""

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import update
from sqlmodel import select
from ..api.websockets.manager import get_connection_manager
from ..core.clock import utcnow
from ..core.email import email_configured, send_email
from ..core.logger import logger
from ..db.db import SessionLocal
from ..models.reminder import Reminder
from ..models.user import User, UserPreferences

TICK_SECONDS = 30
DEFAULT_LEAD = 15  # minutes, for people who never opened their settings
MAX_LEAD = timedelta(minutes=1440)  # the longest lead the settings allow
MISSED = timedelta(minutes=30)  # found later than this (the server was down): close it quietly


@dataclass
class Due:
    id: uuid.UUID
    user_id: uuid.UUID
    conversation_id: uuid.UUID | None
    title: str
    at: datetime
    email: str | None
    zone: str


async def run(sessions=SessionLocal) -> None:
    while True:
        try:
            await fire_due(sessions)
        except Exception:
            logger.exception("Reminder scheduler tick failed")
        await asyncio.sleep(TICK_SECONDS)


def _utc(at: datetime) -> datetime:
    """Database times are UTC; SQLite hands them back without a zone."""
    return at if at.tzinfo else at.replace(tzinfo=timezone.utc)


async def fire_due(sessions=SessionLocal) -> list[uuid.UUID]:
    """One pass over confirmed reminders. Returns the ids it alerted."""
    now = utcnow()
    fired: list[Due] = []
    with sessions() as s:
        rows = s.exec(
            select(
                Reminder,
                User.email,
                User.timezone,
                UserPreferences.reminder_lead_minutes,
                UserPreferences.email_notifications,
            )
            .join(User, User.id == Reminder.user_id)
            .outerjoin(UserPreferences, UserPreferences.user_id == Reminder.user_id)
            .where(Reminder.status == "confirmed", Reminder.due_at <= now + MAX_LEAD)
        ).all()

        for reminder, email, zone, lead, email_on in rows:
            at = _utc(reminder.due_at)
            if at - timedelta(minutes=DEFAULT_LEAD if lead is None else lead) > now:
                continue
            due = Due(reminder.id, reminder.user_id, reminder.conversation_id, reminder.title, at, email if email_on else None, zone)
            # Only one server's update matches the row, so each reminder fires once.
            claimed = s.execute(
                update(Reminder)
                .where(Reminder.id == due.id, Reminder.status == "confirmed")
                .values(status="sent", updated_at=now)
            ).rowcount
            s.commit()
            if claimed and at >= now - MISSED:
                fired.append(due)

    manager = get_connection_manager()
    for due in fired:
        await manager.notify_user(
            due.user_id,
            {
                "type": "reminder_due",
                "data": {"id": str(due.id), "title": due.title, "due_at": due.at.isoformat()},
                "timestamp": now.isoformat(),
            },
        )
        if due.email and email_configured():
            local = due.at.astimezone(ZoneInfo(due.zone))
            clock = local.strftime("%I:%M %p").lstrip("0")
            try:
                await asyncio.to_thread(
                    send_email,
                    due.email,
                    f"Reminder: {due.title} at {clock}",
                    f"{due.title}\n{local.strftime('%a %d %b')}, {clock} ({due.zone})\n\nSet in UNaFIED when you agreed on it in chat.",
                )
            except Exception:
                logger.exception(f"Reminder email failed for {due.id}")
    if fired:
        logger.info(f"Scheduler fired {len(fired)} reminder(s)")
    return [due.id for due in fired]
