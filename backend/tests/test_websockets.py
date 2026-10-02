"""
Tests for the sockets: a message reaches the other person's open thread, their
app-wide socket hears about it, and strangers and bad tokens are turned away.
"""

import json
import uuid

import anyio
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session
from starlette.websockets import WebSocketDisconnect

from app.api.websockets import chat_ws
from app.api.websockets.manager import ConnectionManager, get_connection_manager
from app.core.security import create_token
from app.models.chats import Conversation, ConversationParticipant
from app.models.user import User
from app.services import listener


@pytest.fixture
def chat(engine, monkeypatch):
    monkeypatch.setattr(chat_ws, "SessionLocal", lambda: Session(engine))
    monkeypatch.setattr(listener, "watch", lambda *args: None)  # no model calls

    a, b, stranger, convo = (uuid.uuid4() for _ in range(4))
    with Session(engine) as s:
        s.add_all([User(id=u, email=f"{name}@x.io") for u, name in ((a, "a"), (b, "b"), (stranger, "c"))])
        s.add_all([
            Conversation(id=convo, owner_id=a),
            ConversationParticipant(conversation_id=convo, user_id=a, role="owner"),
            ConversationParticipant(conversation_id=convo, user_id=b),
        ])
        s.commit()

    # Only the socket routes, without the real app's startup (Redis, scheduler)
    app = FastAPI()
    app.include_router(chat_ws.router, prefix="/api/v1")
    manager = ConnectionManager()
    app.dependency_overrides[get_connection_manager] = lambda: manager
    token = {name: create_token({"sub": str(u)}) for name, u in (("a", a), ("b", b), ("c", stranger))}
    with TestClient(app) as client:
        yield client, convo, token


def next_of(ws, kind, seconds=5):
    """The next event of one type, skipping others (joins, typing). Fails instead of hanging."""

    async def receive():
        with anyio.fail_after(seconds):  # receive_json() would wait forever
            return await ws._send_rx.receive()

    for _ in range(10):
        event = json.loads(ws.portal.call(receive)["text"])
        if event["type"] == kind:
            return event
    raise AssertionError(f"no {kind} event")


def test_message_reaches_the_other_thread_and_their_app_socket(chat):
    client, convo, token = chat
    with client.websocket_connect(f"/api/v1/ws?token={token['b']}") as b_app, \
         client.websocket_connect(f"/api/v1/chats/{convo}/ws?token={token['b']}") as b_thread, \
         client.websocket_connect(f"/api/v1/chats/{convo}/ws?token={token['a']}") as a_thread:
        a_thread.send_json({"type": "message", "data": {"content": "coffee at 4?"}})

        assert next_of(a_thread, "message")["data"]["content"] == "coffee at 4?"  # the sender's own echo
        received = next_of(b_thread, "message")["data"]
        assert (received["content"], received["sender_email"]) == ("coffee at 4?", "a@x.io")
        assert next_of(b_app, "conversation_activity")["data"] == {"conversation_id": str(convo)}


def test_strangers_and_bad_tokens_are_turned_away(chat):
    client, convo, token = chat
    for url in (
        f"/api/v1/chats/{convo}/ws?token={token['c']}",  # not in this conversation
        f"/api/v1/chats/{convo}/ws?token=nope",
        "/api/v1/ws?token=nope",
    ):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(url) as ws:
                ws.receive_json()
