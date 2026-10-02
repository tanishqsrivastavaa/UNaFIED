"""
Tests for Web Push: a browser subscribes for whoever is signed in and moves with
them, you only remove your own, and the scheduler pushes each fired reminder to
every browser of its owner, forgetting the ones the push service says are gone.
"""

import json
import os
import uuid
from datetime import timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import http_ece
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi.testclient import TestClient
from py_vapid import Vapid
from py_vapid.utils import b64urlencode
from pywebpush import WebPushException
from sqlmodel import SQLModel, Session, select

from app.config.settings import settings
from app.core import push
from app.core.clock import utcnow
from app.core.security import get_current_user_hashed
from app.db.db import get_session
from app.models.push import PushSubscription
from app.models.reminder import Reminder
from app.models.user import User
from app.services import scheduler

A, B = uuid.uuid4(), uuid.uuid4()
URL = "/api/v1/push/subscriptions"


def browser(endpoint, p256dh="key", auth="secret"):
    """The shape PushSubscription.toJSON() gives."""
    return {"endpoint": endpoint, "expirationTime": None, "keys": {"p256dh": p256dh, "auth": auth}}


def stored(engine):
    with Session(engine) as s:
        subs = s.exec(select(PushSubscription).order_by(PushSubscription.endpoint)).all()
        return [(p.endpoint, p.user_id, p.p256dh) for p in subs]


@pytest.fixture
def db(engine):
    SQLModel.metadata.create_all(engine, tables=[PushSubscription.__table__])
    with Session(engine) as s:
        s.add_all([User(id=A, email="a@x.io", timezone="Asia/Kolkata"), User(id=B, email="b@x.io")])
        s.commit()
    return engine


@pytest.fixture
def client(db):
    from main import app

    me = {"id": A}  # tests switch who is signed in

    def session_override():
        with Session(db) as s:
            yield s

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_current_user_hashed] = lambda: User(id=me["id"], email="me@x.io")
    yield TestClient(app), me
    app.dependency_overrides.clear()


def test_subscribe_upserts_by_endpoint_and_follows_the_signed_in_person(client, db):
    c, me = client
    assert c.post(URL, json=browser("https://push.example/1")).status_code == 204
    assert c.post(URL, json=browser("https://push.example/1", p256dh="renewed")).status_code == 204
    assert stored(db) == [("https://push.example/1", A, "renewed")]

    me["id"] = B  # the same browser, now signed in as b
    assert c.post(URL, json=browser("https://push.example/1")).status_code == 204
    assert stored(db) == [("https://push.example/1", B, "key")]

    # The server posts to these, so nothing but https
    assert c.post(URL, json=browser("http://10.0.0.1/admin")).status_code == 422
    assert c.post(URL, json={"endpoint": "https://push.example/2", "keys": {"p256dh": "", "auth": "x"}}).status_code == 422


def test_unsubscribe_removes_only_your_own(client, db):
    c, me = client
    c.post(URL, json=browser("https://push.example/a"))
    me["id"] = B
    c.post(URL, json=browser("https://push.example/b"))

    assert c.request("DELETE", URL, json={"endpoint": "https://push.example/a"}).status_code == 204
    assert len(stored(db)) == 2  # a's browser stays

    assert c.request("DELETE", URL, json={"endpoint": "https://push.example/b"}).status_code == 204
    assert [endpoint for endpoint, _, _ in stored(db)] == ["https://push.example/a"]


def test_key_is_null_until_both_keys_are_set(client, monkeypatch):
    c, _ = client
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", None)
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", None)
    assert c.get("/api/v1/push/key").json() == {"public_key": None}

    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "public")
    assert c.get("/api/v1/push/key").json() == {"public_key": None}

    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "private")
    assert c.get("/api/v1/push/key").json() == {"public_key": "public"}


def add_due_reminder(engine, *subs, conversation_id=None):
    reminder = Reminder(
        user_id=A, conversation_id=conversation_id, title="Meet Sam",
        due_at=utcnow() + timedelta(minutes=5), status="confirmed",
    )
    rid, due_at = reminder.id, reminder.due_at
    with Session(engine) as s:
        s.add_all([reminder, *subs])
        s.commit()
    return rid, due_at


class QuietManager:
    async def notify_user(self, user_id, event):
        pass


@pytest.mark.asyncio
async def test_scheduler_pushes_to_every_browser_of_the_owner(db, monkeypatch):
    chat = uuid.uuid4()
    rid, due_at = add_due_reminder(
        db,
        PushSubscription(user_id=A, endpoint="https://push.example/phone", p256dh="k", auth="s"),
        PushSubscription(user_id=A, endpoint="https://push.example/laptop", p256dh="k", auth="s"),
        PushSubscription(user_id=B, endpoint="https://push.example/someone-else", p256dh="k", auth="s"),
        conversation_id=chat,
    )
    sent = []
    monkeypatch.setattr(scheduler, "get_connection_manager", lambda: QuietManager())
    monkeypatch.setattr(scheduler, "push_configured", lambda: True)
    monkeypatch.setattr(scheduler, "send_push", lambda sub, payload: sent.append((sub.endpoint, payload)) or True)

    assert await scheduler.fire_due(lambda: Session(db)) == [rid]

    assert sorted(endpoint for endpoint, _ in sent) == ["https://push.example/laptop", "https://push.example/phone"]
    local = due_at.astimezone(ZoneInfo("Asia/Kolkata"))
    assert sent[0][1] == {
        "title": "Meet Sam",
        "body": local.strftime("%a %d %b, %-I:%M %p"),
        "url": f"/chat/{chat}",
        "tag": str(rid),
    }


@pytest.mark.asyncio
async def test_a_browser_the_push_service_calls_gone_is_forgotten(db, monkeypatch):
    add_due_reminder(
        db,
        PushSubscription(user_id=A, endpoint="https://push.example/gone", p256dh="k", auth="s"),
        PushSubscription(user_id=A, endpoint="https://push.example/down", p256dh="k", auth="s"),
        PushSubscription(user_id=A, endpoint="https://push.example/offline", p256dh="k", auth="s"),
    )

    def answer(info, data, **kwargs):
        endpoint = info["endpoint"]
        if endpoint.endswith("offline"):
            raise OSError("timed out")
        status = 410 if endpoint.endswith("gone") else 500
        raise WebPushException("Push failed", response=SimpleNamespace(status_code=status, text=""))

    monkeypatch.setattr(scheduler, "get_connection_manager", lambda: QuietManager())
    monkeypatch.setattr(scheduler, "push_configured", lambda: True)
    monkeypatch.setattr(push, "webpush", answer)

    assert len(await scheduler.fire_due(lambda: Session(db))) == 1  # push failures never stop the tick
    # 410 means gone for good; a failing or unreachable service may work next time
    assert [endpoint for endpoint, _, _ in stored(db)] == ["https://push.example/down", "https://push.example/offline"]


def test_send_push_signs_and_encrypts_with_keys_in_env_form(monkeypatch):
    """Keys made the way the setup notes say, end to end through pywebpush, short of the network."""
    vapid = Vapid()
    vapid.generate_keys()
    public = b64urlencode(vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint))
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", b64urlencode(vapid.private_key.private_numbers().private_value.to_bytes(32, "big")))

    # The browser side of a subscription
    device = ec.generate_private_key(ec.SECP256R1())
    secret = os.urandom(16)
    sub = PushSubscription(
        user_id=A, endpoint="https://push.example/x",
        p256dh=b64urlencode(device.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)),
        auth=b64urlencode(secret),
    )
    posts = []
    monkeypatch.setattr("requests.post", lambda url, **kw: posts.append((url, kw)) or SimpleNamespace(status_code=201, text="", headers={}))

    assert push.send_push(sub, {"title": "Meet Sam"}) is True
    (url, kw), = posts
    assert url == "https://push.example/x" and kw["timeout"] == 10
    assert kw["headers"]["authorization"].startswith("vapid t=") and kw["headers"]["authorization"].endswith(f"k={public}")
    assert kw["headers"]["ttl"] == str(push.TTL_SECONDS) and kw["headers"]["urgency"] == "high"
    assert json.loads(http_ece.decrypt(kw["data"], private_key=device, auth_secret=secret)) == {"title": "Meet Sam"}
