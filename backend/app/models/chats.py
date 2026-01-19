from sqlmodel import SQLModel, Field, Relationship, Column, JSON
from pgvector.sqlalchemy import Vector
import uuid
from datetime import datetime
from typing import List,Optional

class Conversation(SQLModel,table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4,primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    title: str= Field(default="New Chat")
    created_at: datetime= Field(default_factory=datetime.now)
    updated_at: datetime= Field(default_factory=datetime.now)

    messages: List["Message"] = Relationship(back_populates="conversation")



class Message(SQLModel, table=True):
    id: uuid.UUID= Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID= Field(foreign_key="conversation.id",index=True)
    role: str
    content: str
    suggestion: Optional[dict]= Field(default=None,sa_column=Column(JSON))
    token_count: Optional[int]= None
    created_at: datetime= Field(default_factory=datetime.now)

    conversation: Optional["Conversation"] = Relationship(back_populates="messages")
    embedding: Optional["MessageEmbedding"] = Relationship(sa_relationship_kwargs={"uselist": False})

class MessageEmbedding(SQLModel,table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    message_id: uuid.UUID = Field(foreign_key="message.id")
    embedding: List[float]= Field(sa_column=Column(Vector(1536)))