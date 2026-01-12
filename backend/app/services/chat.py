import uuid
from typing import List, Sequence
from sqlmodel import Session, select, desc
from ..models.chats import Conversation
from ..schemas.chat import ConversationCreate

class ChatService:
    @staticmethod
    def create_conversation(
        session: Session,
        user_id: uuid.UUID,
        conversation_in: ConversationCreate) -> Conversation:
        
        conversation_data= conversation_in.model_dump(exclude_unset=True)

        conversation= Conversation(
            **conversation_data,
            user_id=user_id
        )

        session.add(conversation)
        session.commit()
        session.refresh(conversation)
        return conversation
    
    @staticmethod
    def get_user_conversations(
        session: Session,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20) -> Sequence[Conversation]:

        statement= (
            select(Conversation)
            .where(Conversation.user_id==user_id)
            .order_by(desc(Conversation.updated_at))
            .offset(skip)
            .limit(limit)
        )
        return session.exec(statement).all()
    
    @staticmethod
    def get_conversation(
        session: Session,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID
    ) -> Conversation | None:
        statement= select(Conversation).where(
            Conversation.id==conversation_id,
            Conversation.user_id==user_id
        )
        return session.exec(statement=statement).first()