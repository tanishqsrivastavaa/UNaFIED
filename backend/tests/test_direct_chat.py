"""
Tests for direct chats and reminder settings: one chat per pair is reused,
and the settings API keeps the lead time within a day.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import get_current_user
from app.db.db import get_session
from app.models.user import User
from app.services.chat import ChatService


def test_direct_chat_is_reused_for_the_same_pair(engine):
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    with Session(engine) as s:
        s.add_all([User(id=a, email="a@x.io"), User(id=b, email="b@x.io"), User(id=c, email="c@x.io")])
        s.commit()

        first, new_member = ChatService.start_direct(s, a, " B@X.io ")
        assert new_member == b and first.title == "a & b"
        again, new_member = ChatService.start_direct(s, b, "a@x.io")  # either side finds it
        assert again.id == first.id and new_member is None

        # Once a third person joins, it is a group, not the pair's direct chat
        ChatService.add_participant(s, first.id, a, "c@x.io")
        fresh, new_member = ChatService.start_direct(s, a, "b@x.io")
        assert fresh.id != first.id and new_member == b

        with pytest.raises(ValueError):
            ChatService.start_direct(s, a, "a@x.io")
        with pytest.raises(LookupError):
            ChatService.start_direct(s, a, "nobody@x.io")


def test_reminder_settings(engine):
    from main import app

    me = uuid.uuid4()
    with Session(engine) as s:
        s.add(User(id=me, email="me@x.io"))
        s.commit()

    def session_override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_current_user] = lambda: User(id=me, email="me@x.io")
    try:
        client = TestClient(app)
        defaults = client.get("/api/v1/me/preferences").json()
        assert (defaults["reminder_lead_minutes"], defaults["email_notifications"]) == (15, False)

        r = client.patch("/api/v1/me/preferences", json={"reminder_lead_minutes": 30, "email_notifications": True})
        assert r.status_code == 200 and (r.json()["reminder_lead_minutes"], r.json()["email_notifications"]) == (30, True)
        assert client.get("/api/v1/me/preferences").json()["reminder_lead_minutes"] == 30

        assert client.patch("/api/v1/me/preferences", json={"reminder_lead_minutes": 5000}).status_code == 422
        assert client.patch("/api/v1/me/preferences", json={"reminder_lead_minutes": -1}).status_code == 422
    finally:
        app.dependency_overrides.clear()
