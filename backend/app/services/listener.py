"""
Runs the Listener after each human message, off the reply path, applies its
decision to the reminder table, and posts a "Reminder set" message once a plan
is agreed.

A plan is the set of reminder rows (one per person in the chat) that share the
message which last proposed it. Rows start "proposed". A yes from anyone other
than that message's sender confirms their own row and the proposer's; people
who never answer stay "proposed".

A personal reminder ("remind me to call mom at 6") is a plan of one row, for its
sender only, confirmed from the start. Only its owner can change or cancel it.
It is the only thing the Listener sets in a solo chat.
"""

import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone, tzinfo
from zoneinfo import ZoneInfo
from sqlmodel import select, desc, func
from ..agents.listener_agent import Line, Plan, decide
from ..api.websockets.manager import get_connection_manager
from ..core.clock import utcnow
from ..core.logger import logger
from ..db.db import SessionLocal
from ..models.chats import ConversationParticipant, Message
from ..models.reminder import Reminder
from ..models.user import User

HISTORY = 12  # messages of context the model sees
OPEN = ("proposed", "confirmed", "sent")  # "sent": alerted, but the meeting may still be ahead
YES = ("confirmed", "sent")

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


def _card(conversation_id: uuid.UUID, text: str, title: str, key: uuid.UUID, due: datetime, **extra) -> Message:
    """The "Reminder set" message. The card finds each reader's own reminder by the plan's message."""
    return Message(
        conversation_id=conversation_id,
        role="assistant",
        content=text,
        is_proactive=True,
        suggestion={
            "label": title,
            "tool_name": "reminder",
            "parameters": {"plan": str(key), "due_at": _local(due, timezone.utc).isoformat(), **extra},
        },
    )


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
        if not message:
            return

        names = {uid: email.split("@")[0] for uid, email, _ in members}
        zone = ZoneInfo(next((tz for uid, _, tz in members if uid == message.sender_id), "UTC"))
        sender_name = s.get(User, message.sender_id).email.split("@")[0]

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
        # A shared plan gets a row per person, and a change moves every row, so it
        # never has fewer than two rows; a plan of one row is a personal reminder.
        sizes = dict(s.exec(
            select(Reminder.message_id, func.count()).where(Reminder.message_id.in_(keys)).group_by(Reminder.message_id)
        ).all())
        personal = {key for key in keys if sizes[key] == 1}
        plans, dues = [], {}
        for key in keys:
            plan_rows = [r for r in rows if r.message_id == key]
            dues[key] = _local(plan_rows[0].due_at, timezone.utc)
            plans.append(Plan(
                plan_rows[0].title,
                _local(plan_rows[0].due_at, zone),
                names.get(proposer[key], "someone"),
                any(r.status in YES for r in plan_rows),
                key in personal,
            ))

        member_ids = [uid for uid, _, _ in members]
        sender_id = message.sender_id

    # No database connection is held while the model thinks.
    decision = await decide(_local(now, zone), str(zone), plans, lines)
    logger.info(f"Listener: {decision.action} (plan {decision.plan}) on message {message_id}")

    solo = len(member_ids) < 2  # only personal reminders need just one person
    due = _utc(decision.when, zone)
    ack = None
    changed: set[uuid.UUID] = set()  # whose reminder list to refresh
    with sessions() as s:
        if decision.action == "remind":
            title = decision.title or "Reminder"
            same = any(
                k in personal and proposer[k] == sender_id and dues[k] == due and p.title.lower() == title.lower()
                for k, p in zip(keys, plans)
            )
            if due is None or due <= now or same:
                return  # no time, already past, or the same reminder again
            s.add(Reminder(
                user_id=sender_id,
                conversation_id=conversation_id,
                message_id=message_id,
                title=title,
                due_at=due,
                status="confirmed",
            ))
            ack = _card(
                conversation_id, "Reminder set for you.", title, message_id, due,
                personal_for=str(sender_id), personal_name=sender_name,
            )
            changed.add(sender_id)

        elif decision.action == "propose" and not solo:
            shared = [dues[k] for k in keys if k not in personal]
            if due is None or due <= now or due in shared:
                return  # no time, already past, or the same plan again
            for uid in member_ids:
                s.add(Reminder(
                    user_id=uid,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    title=decision.title or "Plan",
                    due_at=due,
                ))
            changed.update(member_ids)

        elif decision.action in ("agree", "change", "cancel"):
            if decision.plan not in range(1, len(keys) + 1):
                return
            key = keys[decision.plan - 1]
            personal_plan = key in personal
            if personal_plan and proposer[key] != sender_id:
                return  # someone else's personal reminder
            if not personal_plan and solo:
                return  # a shared plan needs two people
            if decision.action == "agree" and (personal_plan or proposer[key] == sender_id):
                return  # agreeing to your own plan isn't agreement
            if decision.action == "change" and not ((due and due > now) or decision.title):
                return  # nothing concrete changed

            rows = s.exec(select(Reminder).where(Reminder.message_id == key)).all()
            live = [r for r in rows if r.status in OPEN]
            if not live:
                return

            if decision.action == "agree":
                first = not any(r.status in YES for r in live)
                # The agreer's own row (even one they cancelled) and the proposer's
                hits = [r for r in rows if r.user_id == sender_id and r.status not in YES]
                hits += [r for r in live if r.user_id == proposer[key] and r.status == "proposed"]
                if not hits:
                    return  # already agreed; "see you then!" again changes nothing
                for r in hits:
                    r.status = "confirmed"
                if first:
                    text = "Reminder set for you both." if len(member_ids) == 2 else "Reminder set for everyone who said yes."
                    ack = _card(conversation_id, text, live[0].title, key, live[0].due_at)

            elif decision.action == "cancel":
                if personal_plan or sender_id == proposer[key]:
                    hits = live
                elif any(r.user_id not in (sender_id, proposer[key]) for r in live):
                    hits = [r for r in live if r.user_id == sender_id]  # others are still in
                else:
                    hits = live  # nobody besides the proposer is left, so it's off
                if not hits:
                    return
                for r in hits:
                    r.status = "dismissed"

            elif personal_plan:
                # The owner moves their own reminder; nobody needs to agree.
                hits = live
                for r in hits:
                    if due and due > now:
                        r.due_at = due
                    r.title = decision.title or r.title
                    r.status = "confirmed"  # re-arms one whose alert already went out

            else:
                # A changed plan needs agreement again, from someone other than whoever changed it.
                hits = live
                for r in rows:
                    r.message_id = message_id  # cancelled rows move too, so the plan keeps its size
                for r in hits:
                    if due and due > now:
                        r.due_at = due
                    r.title = decision.title or r.title
                    r.status = "proposed"

            for r in hits:
                r.updated_at = utcnow()
                changed.add(r.user_id)
            s.add_all(rows)
        else:
            return
        if ack:
            s.add(ack)
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
    for uid in changed:
        await manager.notify_user(uid, {"type": "reminders_changed", "data": {}, "timestamp": stamp})
