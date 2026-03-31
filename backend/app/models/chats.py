from sqlmodel import SQLModel, Field, Relationship, Column, JSON
from pgvector.sqlalchemy import Vector
import uuid
from datetime import datetime
from typing import List, Optional


class Conversation(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    title: str = Field(default="New Chat")
    is_public: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    messages: List["Message"] = Relationship(back_populates="conversation")
    participants: List["ConversationParticipant"] = Relationship(
        back_populates="conversation"
    )


class Message(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id", index=True)
    sender_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="user.id", index=True
    )
    role: str
    content: str
    suggestion: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    token_count: Optional[int] = None
    is_proactive: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)

    conversation: Optional["Conversation"] = Relationship(back_populates="messages")
    embedding: Optional["MessageEmbedding"] = Relationship(
        sa_relationship_kwargs={"uselist": False}
    )


class MessageEmbedding(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    message_id: uuid.UUID = Field(foreign_key="message.id")
    embedding: List[float] = Field(sa_column=Column(Vector(1536)))


class ConversationParticipant(SQLModel, table=True):
    __tablename__ = "conversation_participant"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    role: str = Field(default="member")  # "owner" or "member"
    joined_at: datetime = Field(default_factory=datetime.now)
    left_at: Optional[datetime] = None
    is_active: bool = Field(default=True)

    conversation: Optional["Conversation"] = Relationship(back_populates="participants")


class UploadedFile(SQLModel, table=True):
    __tablename__ = "uploaded_file"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id", index=True)
    uploader_id: uuid.UUID = Field(foreign_key="user.id", index=True)

    filename: str
    file_path: str
    file_type: str
    file_size: int
    mime_type: str

    extracted_text: Optional[str] = None

    uploaded_at: datetime = Field(default_factory=datetime.now)

    embedding: Optional["FileEmbedding"] = Relationship(
        sa_relationship_kwargs={"uselist": False}
    )


class FileEmbedding(SQLModel, table=True):
    __tablename__ = "file_embedding"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_id: uuid.UUID = Field(foreign_key="uploaded_file.id", unique=True)
    embedding: List[float] = Field(sa_column=Column(Vector(1536)))
