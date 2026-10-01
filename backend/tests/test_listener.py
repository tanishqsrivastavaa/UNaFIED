"""
Tests for applying Listener decisions (the model is stubbed): a plan becomes a
reminder for everyone in the chat, and is confirmed only when someone other
than its proposer agrees.
"""

import uuid
from datetime import datetime

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

from app.agents.listener_agent import ListenerDecision as D
from app.models.chats import Conversation, ConversationParticipant, Message
from app.models.reminder import Reminder
from app.models.user import User
from app.services import listener


@pytest.fixture
def chat(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    tables = [m.__table__ for m in (User, Conversation, ConversationParticipant, Message, Reminder)]
    SQLModel.metadata.create_all(engine, tables=tables)

    sam, manish, convo = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    with Session(engine) as s:
        s.add_all([
            User(id=sam, email="sam@x.io", timezone="Asia/Kolkata"),
            User(id=manish, email="manish@x.io"),  # UTC
            Conversation(id=convo, owner_id=sam),
            ConversationParticipant(conversation_id=convo, user_id=sam, role="owner"),
            ConversationParticipant(conversation_id=convo, user_id=manish),
        ])
        s.commit()

    queued, seen = [], []

    async def fake_decide(now, zone, plans, lines):
        seen.append((zone, plans, lines))
        return queued.pop(0)

    monkeypatch.setattr(listener, "decide", fake_decide)

    async def say(user_id, text, decision):
        with Session(engine) as s:
            m = Message(conversation_id=convo, sender_id=user_id, role="user", content=text)
            s.add(m)
            s.commit()
            message_id = m.id
        queued.append(decision)
        await listener.listen(convo, message_id, sessions=lambda: Session(engine))

    def rows():
        with Session(engine) as s:
            return s.exec(select(Reminder)).all()

    def leave(user_id):
        with Session(engine) as s:
            p = s.exec(select(ConversationParticipant).where(ConversationParticipant.user_id == user_id)).one()
            p.is_active = False
            s.add(p)
            s.commit()

    return sam, manish, say, rows, seen, leave


@pytest.mark.asyncio
async def test_plan_waits_for_the_other_person(chat):
    sam, manish, say, rows, seen, _ = chat

    await say(sam, "coffee at 4?", D(action="propose", title="Coffee", when=datetime(2030, 1, 1, 16, 0)))
    assert len(rows()) == 2 and {r.status for r in rows()} == {"proposed"}
    # Sam is in Kolkata, so 4 pm there is 10:30 UTC
    assert {r.due_at.strftime("%H:%M") for r in rows()} == {"10:30"}

    await say(sam, "so yeah, 4!", D(action="agree", plan=1))
    assert {r.status for r in rows()} == {"proposed"}

    await say(manish, "sure", D(action="agree", plan=1))
    assert {r.status for r in rows()} == {"confirmed"}
    # The model saw the plan in Manish's zone, with Sam as its proposer
    zone, plans, lines = seen[-1]
    assert zone == "UTC" and plans[0].proposer == "sam" and plans[0].at.strftime("%H:%M") == "10:30"
    assert [l.text for l in lines] == ["coffee at 4?", "so yeah, 4!", "sure"]

    await say(manish, "make it 5?", D(action="change", plan=1, when=datetime(2030, 1, 1, 17, 0)))
    assert {(r.status, r.due_at.strftime("%H:%M")) for r in rows()} == {("proposed", "17:00")}

    await say(manish, "ok?", D(action="agree", plan=1))
    assert {r.status for r in rows()} == {"proposed"}  # Manish changed it, so Sam must agree

    await say(sam, "5 works", D(action="agree", plan=1))
    assert {r.status for r in rows()} == {"confirmed"}

    await say(sam, "can't make it after all", D(action="cancel", plan=1))
    assert {r.status for r in rows()} == {"dismissed"}


@pytest.mark.asyncio
async def test_ignores_past_repeated_and_unknown_plans(chat):
    sam, manish, say, rows, _, _ = chat

    await say(sam, "yesterday at 4", D(action="propose", title="Coffee", when=datetime(2020, 1, 1, 16, 0)))
    assert rows() == []

    four = datetime(2030, 1, 1, 16, 0)
    await say(sam, "coffee at 4?", D(action="propose", title="Coffee", when=four))
    await say(sam, "coffee at 4!!", D(action="propose", title="Coffee", when=four))
    assert len(rows()) == 2

    await say(manish, "sure", D(action="agree", plan=2))
    assert {r.status for r in rows()} == {"proposed"}


@pytest.mark.asyncio
async def test_solo_chat_is_left_alone(chat):
    sam, manish, say, rows, seen, leave = chat
    leave(manish)
    await say(sam, "remind me, dentist at 4", D(action="propose", title="Dentist", when=datetime(2030, 1, 1, 16, 0)))
    assert rows() == [] and seen == []
