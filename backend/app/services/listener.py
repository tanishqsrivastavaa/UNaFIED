"""
Runs the Listener after each human message, off the reply path, applies its
decision to the reminder table, and posts a "Reminder set" message once a plan
is agreed.

A plan is the set of reminder rows (one per person in the chat) that share the
message which last proposed it. It starts as "proposed" and becomes "confirmed"
only when someone other than that message's sender agrees.
"""

import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone, tzinfo
from zoneinfo import ZoneInfo
from sqlmodel import select, desc
from ..agents.listener_agent import Line, Plan, decide
from ..api.websockets.manager import get_connection_manager
from ..core.clock import utcnow
from ..core.logger import logger
from ..db.db import SessionLocal
from ..models.chats import ConversationParticipant, Message
from ..models.reminder import Reminder
from ..models.user import User

HISTORY = 12  # messages of context the model sees
OPEN = ("proposed", "confirmed")

_tasks: set[asyncio.Task] = set()
# ponytail: per-process locks keep one conversation's messages in order on a single
# server; two servers could race. Move to a Redis lock or a queue when scaling out.
_locks: defaultdict[uuid.UUID, asyncio.Lock] = defaultdict(asyncio.Lock)


def watch(conversation_id: uuid.UUID, message_id: uuid.UUID) -> None:
    """Starts the Listener on a saved human message without waiting for it."""
    task = asyncio.create_task(_run(conversation_id, message_id))
    _tasks.add(task)  # the event loop only keeps weak references to tasks
    task.add_done_callback(_tasks.discard)


async def _run(conversation_id: uuid.UUID, message_id: uuid.UUID) -> None:
    try:
        async with _locks[conversation_id]:
            await listen(conversation_id, message_id)
    except Exception:
        logger.exception(f"Listener failed on message {message_id}")


def _local(at: datetime, zone: tzinfo) -> datetime:
    """Database times are UTC; SQLite hands them back without a zone."""
    return (at if at.tzinfo else at.replace(tzinfo=timezone.utc)).astimezone(zone)


def _utc(at: datetime | None, zone: tzinfo) -> datetime | None:
    """The model answers in the sender's local time."""
    if at is None:
        return None
    return (at if at.tzinfo else at.replace(tzinfo=zone)).astimezone(timezone.utc)


async def listen(conversation_id: uuid.UUID, message_id: uuid.UUID, sessions=SessionLocal) -> None:
    now = utcnow()
    with sessions() as s:
        message = s.get(Message, message_id)
        members = s.exec(
            select(User.id, User.email, User.timezone)
            .join(ConversationParticipant, ConversationParticipant.user_id == User.id)
            .where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.is_active == True,
            )
        ).all()
        if not message or len(members) < 2:
            return  # plans need two people; a solo chat is just the assistant

        names = {uid: email.split("@")[0] for uid, email, _ in members}
        zone = ZoneInfo(next((tz for uid, _, tz in members if uid == message.sender_id), "UTC"))

        history = s.exec(
            select(Message, User.email)
            .join(User, User.id == Message.sender_id)
            .where(
                Message.conversation_id == conversation_id,
                Message.role == "user",
                Message.created_at <= message.created_at,
            )
            .order_by(desc(Message.created_at))
            .limit(HISTORY)
        ).all()
        lines = [Line(_local(m.created_at, zone), email.split("@")[0], m.content) for m, email in reversed(history)]

        rows = s.exec(
            select(Reminder)
            .where(
                Reminder.conversation_id == conversation_id,
                Reminder.status.in_(OPEN),
                Reminder.due_at > now,
            )
            .order_by(Reminder.due_at)
        ).all()
        keys = list(dict.fromkeys(r.message_id for r in rows if r.message_id))
        proposer = {key: s.get(Message, key).sender_id for key in keys}
        plans, dues = [], []
        for key in keys:
            row = next(r for r in rows if r.message_id == key)
            dues.append(_local(row.due_at, timezone.utc))
            plans.append(Plan(row.title, _local(row.due_at, zone), names.get(proposer[key], "someone"), row.status == "confirmed"))

        member_ids = [uid for uid, _, _ in members]
        sender_id = message.sender_id

    # No database connection is held while the model thinks.
    decision = await decide(_local(now, zone), str(zone), plans, lines)
    logger.info(f"Listener: {decision.action} (plan {decision.plan}) on message {message_id}")

    due = _utc(decision.when, zone)
    ack = None
    with sessions() as s:
        if decision.action == "propose":
            if due is None or due <= now or due in dues:
                return  # no time, already past, or the same plan again
            for uid in member_ids:
                s.add(Reminder(
                    user_id=uid,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    title=decision.title or "Plan",
                    due_at=due,
                ))

        elif decision.action in ("agree", "change", "cancel"):
            if decision.plan not in range(1, len(keys) + 1):
                return
            key = keys[decision.plan - 1]
            if decision.action == "agree" and proposer[key] == sender_id:
                return  # agreeing to your own plan isn't agreement
            if decision.action == "change" and not ((due and due > now) or decision.title):
                return  # nothing concrete changed

            rows = s.exec(select(Reminder).where(Reminder.message_id == key, Reminder.status.in_(OPEN))).all()
            if decision.action == "agree" and not any(r.status == "proposed" for r in rows):
                return  # already agreed; "see you then!" again changes nothing
            for r in rows:
                if decision.action == "agree":
                    r.status = "confirmed"
                elif decision.action == "cancel":
                    r.status = "dismissed"
                else:
                    # A changed plan needs agreement again, from someone other than whoever changed it.
                    if due and due > now:
                        r.due_at = due
                    r.title = decision.title or r.title
                    r.status = "proposed"
                    r.message_id = message_id
                r.updated_at = utcnow()
                s.add(r)

            if decision.action == "agree" and rows:
                # The card finds each reader's own reminder by the plan's message.
                ack = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content="Reminder set for everyone in this chat.",
                    is_proactive=True,
                    suggestion={
                        "label": rows[0].title,
                        "tool_name": "reminder",
                        "parameters": {"plan": str(key), "due_at": _local(rows[0].due_at, timezone.utc).isoformat()},
                    },
                )
                s.add(ack)
        else:
            return
        s.commit()
        if ack:
            s.refresh(ack)
            ack = {
                "id": str(ack.id),
                "sender_id": None,
                "sender_email": None,
                "role": "assistant",
                "content": ack.content,
                "suggestion": ack.suggestion,
                "is_proactive": True,
                "created_at": _local(ack.created_at, timezone.utc).isoformat(),
            }

    manager = get_connection_manager()
    stamp = utcnow().isoformat()
    if ack:
        await manager.broadcast_to_conversation(conversation_id, {"type": "message", "data": ack, "timestamp": stamp})
    await manager.broadcast_to_conversation(conversation_id, {"type": "reminders_changed", "data": {}, "timestamp": stamp})
