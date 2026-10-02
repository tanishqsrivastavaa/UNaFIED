"""
Tests for the reminder scheduler: it fires each confirmed reminder once, within
its owner's lead time, emails only people who asked, and quietly closes
reminders it finds too late.
"""

import uuid
from datetime import timedelta

import pytest
from sqlmodel import Session

from app.core.clock import utcnow
from app.models.reminder import Reminder
from app.models.user import User, UserPreferences
from app.services import scheduler


@pytest.mark.asyncio
async def test_fires_due_reminders_once(engine, monkeypatch):
    now = utcnow()
    a, b = uuid.uuid4(), uuid.uuid4()
    minutes = lambda n: now + timedelta(minutes=n)
    rows = {
        "soon": Reminder(user_id=a, title="Soon", due_at=minutes(10), status="confirmed"),  # inside the default 15
        "later": Reminder(user_id=a, title="Later", due_at=minutes(30), status="confirmed"),  # not yet
        "waiting": Reminder(user_id=a, title="Waiting", due_at=minutes(5), status="proposed"),  # nobody agreed
        "lead": Reminder(user_id=b, title="Lead", due_at=minutes(45), status="confirmed"),  # b alerts 60 before
        "missed": Reminder(user_id=a, title="Missed", due_at=minutes(-120), status="confirmed"),  # server was down
    }
    ids = {k: r.id for k, r in rows.items()}
    with Session(engine) as s:
        s.add_all([
            User(id=a, email="a@x.io"),
            User(id=b, email="b@x.io", timezone="Asia/Kolkata"),
            UserPreferences(user_id=b, reminder_lead_minutes=60, email_notifications=True),
            *rows.values(),
        ])
        s.commit()

    alerts, mails = [], []

    class FakeManager:
        async def notify_user(self, user_id, event):
            alerts.append((user_id, event["type"], event["data"]["title"]))

    monkeypatch.setattr(scheduler, "get_connection_manager", lambda: FakeManager())
    monkeypatch.setattr(scheduler, "email_configured", lambda: True)
    monkeypatch.setattr(scheduler, "send_email", lambda to, subject, body: mails.append((to, subject)))
    sessions = lambda: Session(engine)

    assert set(await scheduler.fire_due(sessions)) == {ids["soon"], ids["lead"]}
    assert sorted(alerts) == sorted([(a, "reminder_due", "Soon"), (b, "reminder_due", "Lead")])
    assert len(mails) == 1 and mails[0][0] == "b@x.io" and mails[0][1].startswith("Reminder: Lead at ")

    with Session(engine) as s:
        status = {k: s.get(Reminder, i).status for k, i in ids.items()}
    assert status == {"soon": "sent", "later": "confirmed", "waiting": "proposed", "lead": "sent", "missed": "sent"}

    assert await scheduler.fire_due(sessions) == []  # nothing fires twice
