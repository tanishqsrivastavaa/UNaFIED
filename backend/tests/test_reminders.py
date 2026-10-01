"""
Tests for the reminders API: you only see and change your own, and only to confirm, cancel or edit.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.core.security import get_current_user_hashed
from app.db.db import get_session
from app.models.chats import Conversation, Message
from app.models.reminder import Reminder
from app.models.user import User


@pytest.fixture
def setup():
    from main import app

    # One shared in-memory database; the request runs on another thread.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    tables = [User.__table__, Conversation.__table__, Message.__table__, Reminder.__table__]
    SQLModel.metadata.create_all(engine, tables=tables)

    me, other = uuid.uuid4(), uuid.uuid4()
    ids = {"later": uuid.uuid4(), "sam": uuid.uuid4(), "not_mine": uuid.uuid4()}
    four_pm = datetime(2026, 10, 1, 16, 0, tzinfo=timezone.utc)
    with Session(engine) as s:
        s.add_all([User(id=me, email="me@x.io"), User(id=other, email="other@x.io")])
        s.add_all([
            Reminder(id=ids["later"], user_id=me, title="Later", due_at=four_pm + timedelta(hours=2)),
            Reminder(id=ids["sam"], user_id=me, title="Meet Sam", due_at=four_pm, status="confirmed"),
            Reminder(id=ids["not_mine"], user_id=other, title="Not mine", due_at=four_pm),
        ])
        s.commit()

    def session_override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_current_user_hashed] = lambda: User(id=me, email="me@x.io")
    yield TestClient(app), ids
    app.dependency_overrides.clear()


def test_lists_only_my_reminders_soonest_first(setup):
    client, _ = setup
    titles = [r["title"] for r in client.get("/api/v1/reminders/").json()]
    assert titles == ["Meet Sam", "Later"]

    confirmed = client.get("/api/v1/reminders/", params={"status": "confirmed"}).json()
    assert [r["title"] for r in confirmed] == ["Meet Sam"]


def test_confirm_and_reschedule(setup):
    client, ids = setup
    r = client.patch(
        f"/api/v1/reminders/{ids['later']}",
        json={"status": "confirmed", "due_at": "2026-10-02T09:30:00Z"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"
    assert r.json()["due_at"].startswith("2026-10-02T09:30:00")


def test_null_fields_change_nothing(setup):
    client, ids = setup
    r = client.patch(f"/api/v1/reminders/{ids['later']}", json={"status": None, "title": None})
    assert r.status_code == 200
    assert (r.json()["status"], r.json()["title"]) == ("proposed", "Later")


def test_someone_elses_reminder_is_not_found(setup):
    client, ids = setup
    r = client.patch(f"/api/v1/reminders/{ids['not_mine']}", json={"status": "dismissed"})
    assert r.status_code == 404


@pytest.mark.parametrize(
    "body",
    [{"status": "sent"}, {"status": "proposed"}, {"due_at": "2026-10-02T09:30:00"}, {"title": ""}],
)
def test_rejects_server_states_zoneless_times_and_blank_titles(setup, body):
    client, ids = setup
    assert client.patch(f"/api/v1/reminders/{ids['later']}", json=body).status_code == 422
