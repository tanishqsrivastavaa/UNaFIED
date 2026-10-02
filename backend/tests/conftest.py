import os

# The app starts the reminder scheduler on startup; a test run must never fire real reminders.
os.environ["RUN_SCHEDULER"] = "false"

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine


@pytest.fixture
def engine():
    """A fresh in-memory database with the tables chat and reminders use (no vector tables)."""
    from app.models.chats import Conversation, ConversationParticipant, Message
    from app.models.reminder import Reminder
    from app.models.user import User, UserPreferences

    # One shared connection: requests run on other threads.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    models = (User, UserPreferences, Conversation, ConversationParticipant, Message, Reminder)
    SQLModel.metadata.create_all(engine, tables=[m.__table__ for m in models])
    return engine
