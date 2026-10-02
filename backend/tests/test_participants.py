"""
Tests for leaving and removing people, and for unread state kept on the server.
"""

import uuid
from datetime import timedelta

import anyio
import pytest
from fastapi import FastAPI, Header
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.routes import chat
from app.api.websockets import chat_ws
from app.api.websockets.manager import ConnectionManager, get_connection_manager
from app.core.clock import utcnow
from app.core.security import create_token, get_current_user_hashed
from app.db.db import get_session
from app.models.chats import Conversation, ConversationParticipant, Message
from app.models.user import User
from app.services import listener
from tests.test_websockets import next_of


@pytest.fixture
def room(engine, monkeypatch):
    """Owner a, then b, then c joined in that order; d is a stranger."""
    monkeypatch.setattr(chat_ws, "SessionLocal", lambda: Session(engine))
    monkeypatch.setattr(listener, "watch", lambda *args: None)  # no model calls

    ids = {name: uuid.uuid4() for name in ("a", "b", "c", "d", "convo")}
    hour_ago = utcnow() - timedelta(hours=1)
    with Session(engine) as s:
        s.add_all([User(id=ids[n], email=f"{n}@x.io") for n in ("a", "b", "c", "d")])
        s.add(Conversation(id=ids["convo"], owner_id=ids["a"], updated_at=hour_ago))
        s.add_all([
            ConversationParticipant(
                conversation_id=ids["convo"], user_id=ids[n], role="owner" if n == "a" else "member",
                joined_at=hour_ago + timedelta(minutes=i),
            )
            for i, n in enumerate(("a", "b", "c"))
        ])
        s.commit()

    def session_override():
        with Session(engine) as s:
            yield s

    def as_header(x_user: uuid.UUID = Header()):
        return User(id=x_user, email="")

    # Only the chat and socket routes, without the real app's startup (Redis, scheduler)
    app = FastAPI()
    app.include_router(chat.router, prefix="/api/v1/chats")
    app.include_router(chat_ws.router, prefix="/api/v1")
    manager = ConnectionManager()
    app.dependency_overrides[get_connection_manager] = lambda: manager
    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_current_user_hashed] = as_header
    with TestClient(app) as client:
        yield client, ids, manager


def who(ids, name):
    return {"x-user": str(ids[name])}


def member(engine, ids, name):
    with Session(engine) as s:
        return s.exec(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == ids["convo"],
                ConversationParticipant.user_id == ids[name],
            )
        ).one()


def test_leaving_and_the_owner_leaving_passes_ownership(room, engine):
    client, ids, _ = room
    url = f"/api/v1/chats/{ids['convo']}/participants/me"
    with Session(engine) as s:
        before = s.get(Conversation, ids["convo"]).updated_at

    assert client.delete(url, headers=who(ids, "a")).status_code == 204

    gone = member(engine, ids, "a")
    assert (gone.is_active, gone.role) == (False, "member") and gone.left_at is not None
    assert member(engine, ids, "b").role == "owner"  # b joined before c
    with Session(engine) as s:
        convo = s.get(Conversation, ids["convo"])
        assert convo.owner_id == ids["b"]
        assert convo.updated_at == before  # leaving doesn't move the chat up anyone's list

    # A plain member leaving changes nothing about ownership
    assert client.delete(url, headers=who(ids, "c")).status_code == 204
    assert member(engine, ids, "b").role == "owner"


def test_the_last_member_cannot_leave(room, engine):
    client, ids, _ = room
    url = f"/api/v1/chats/{ids['convo']}/participants/me"
    assert client.delete(url, headers=who(ids, "c")).status_code == 204
    assert client.delete(url, headers=who(ids, "b")).status_code == 204

    r = client.delete(url, headers=who(ids, "a"))
    assert r.status_code == 409 and "Delete the conversation instead" in r.json()["detail"]
    assert member(engine, ids, "a").is_active


def test_the_owner_removes_and_members_cannot(room, engine):
    client, ids, _ = room
    remove_c = f"/api/v1/chats/{ids['convo']}/participants/{ids['c']}"

    assert client.delete(remove_c, headers=who(ids, "b")).status_code == 403
    assert member(engine, ids, "c").is_active

    assert client.delete(remove_c, headers=who(ids, "a")).status_code == 204
    assert not member(engine, ids, "c").is_active
    assert client.delete(remove_c, headers=who(ids, "a")).status_code == 404  # already out


def test_people_outside_get_404(room):
    client, ids, _ = room
    base = f"/api/v1/chats/{ids['convo']}"
    d = who(ids, "d")
    assert client.delete(f"{base}/participants/me", headers=d).status_code == 404
    assert client.delete(f"{base}/participants/{ids['b']}", headers=d).status_code == 404
    assert client.post(f"{base}/read", headers=d).status_code == 404
    assert client.delete(f"/api/v1/chats/{uuid.uuid4()}/participants/me", headers=d).status_code == 404


def test_the_removed_persons_sockets_close(room):
    client, ids, manager = room
    convo = ids["convo"]
    token = {n: create_token({"sub": str(ids[n])}) for n in ("b", "c")}

    with client.websocket_connect(f"/api/v1/ws?token={token['c']}") as c_app, \
         client.websocket_connect(f"/api/v1/chats/{convo}/ws?token={token['c']}") as c_thread, \
         client.websocket_connect(f"/api/v1/chats/{convo}/ws?token={token['b']}") as b_thread:
        r = client.delete(f"/api/v1/chats/{convo}/participants/{ids['c']}", headers=who(ids, "a"))
        assert r.status_code == 204

        event = {"user_id": str(ids["c"]), "owner_id": str(ids["a"])}
        assert next_of(b_thread, "participant_removed")["data"] == event
        assert next_of(c_thread, "participant_removed")["data"] == event  # told why, then closed

        async def next_frame():
            with anyio.fail_after(5):  # receive() would wait forever if the socket stayed open
                return await c_thread._send_rx.receive()

        assert c_thread.portal.call(next_frame)["type"] == "websocket.close"
        assert next_of(c_app, "conversations_changed")

        assert ids["c"] not in manager.active_connections[convo]
        assert ids["b"] in manager.active_connections[convo]


def test_unread_follows_messages_from_others_and_reads(room, engine):
    client, ids, _ = room
    base = f"/api/v1/chats/{ids['convo']}"

    def unread(name):
        items = client.get("/api/v1/chats/", headers=who(ids, name)).json()["items"]
        return next(c["unread"] for c in items if c["id"] == str(ids["convo"]))

    def post(sender, at=None):
        with Session(engine) as s:
            s.add(Message(
                conversation_id=ids["convo"], sender_id=sender,
                role="assistant" if sender is None else "user", content="hi",
                **({"created_at": at} if at else {}),
            ))
            s.commit()

    # From before anyone joined: not news to them
    post(ids["b"], at=utcnow() - timedelta(hours=2))
    assert [unread(n) for n in ("a", "b", "c")] == [False, False, False]

    post(ids["b"])
    assert [unread(n) for n in ("a", "b", "c")] == [True, False, True]  # never your own

    assert client.post(f"{base}/read", headers=who(ids, "a")).status_code == 204
    assert [unread(n) for n in ("a", "b", "c")] == [False, False, True]

    post(None)  # the assistant is someone else for everyone
    assert [unread(n) for n in ("a", "b", "c")] == [True, True, True]

    for n in ("a", "b", "c"):
        client.post(f"{base}/read", headers=who(ids, n))
    post(ids["a"])
    assert [unread(n) for n in ("a", "b", "c")] == [False, True, True]
