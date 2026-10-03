"""
Celery runs the work that happens off a request: the Listener on each new
message, and the reminder check every 30 seconds (Celery beat).

Start it next to the API, from backend/:
    uv run celery -A app.worker worker -B --loglevel info

One worker process runs one job at a time, so the Listener sees each chat's
messages in the order they were sent, whichever API server took them.
"""

import asyncio
import uuid
from celery import Celery
from .api.websockets.manager import get_connection_manager
from .config.settings import settings
from .core.redis import get_redis
from .services import listener, scheduler

celery = Celery("unafied", broker=settings.REDIS_URL)
celery.conf.update(
    # ponytail: one job at a time keeps every chat in order, but only one model call runs
    # at once; route chats across several single-process queues when that gets slow.
    worker_concurrency=1,
    worker_prefetch_multiplier=1,
    task_acks_late=True,  # both jobs are safe to run twice, so one cut off mid-run runs again
    task_ignore_result=True,
)

_loop: asyncio.AbstractEventLoop | None = None


def _run(coro):
    """Runs async service code on one event loop per worker process.

    Redis and the model's HTTP client keep connections on the loop that opened them,
    so a fresh asyncio.run per job would break them from the second job on.
    """
    global _loop
    if _loop is None:
        _loop = asyncio.new_event_loop()
        # Socket events reach people's tabs through Redis, the same way an API server's do.
        get_connection_manager().set_redis_pubsub(_loop.run_until_complete(get_redis()))
    return _loop.run_until_complete(coro)


@celery.task
def listen_to_message(conversation_id: str, message_id: str) -> None:
    _run(listener.listen(uuid.UUID(conversation_id), uuid.UUID(message_id)))


@celery.task
def fire_due_reminders() -> None:
    _run(scheduler.fire_due())


celery.conf.beat_schedule = {
    "fire-due-reminders": {"task": fire_due_reminders.name, "schedule": 30.0},
}
