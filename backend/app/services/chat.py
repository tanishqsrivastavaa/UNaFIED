import uuid
from typing import List, Sequence
from sqlmodel import Session, select, desc,asc
from ..models.chats import Conversation,Message
from ..schemas.chat import ConversationCreate,MessageCreate
from ..agents.chat_agent import chat_agent
from pydantic_ai import ModelMessage,ModelResponse,ModelRequest,TextPart,UserPromptPart



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
    
    # @staticmethod
    # async def process_chat_message(
    #     session: Session,
    #     conversation_id: uuid.UUID,
    #     user_id: uuid.UUID,
    #     message_in: MessageCreate
    # ) -> Message:
        

    #     statement= select(Conversation).where(
    #         Conversation.id==conversation_id,
    #         Conversation.user_id==user_id
    #     )

    #     conversation= session.exec(statement).first()

    #     if not conversation:
    #         raise ValueError("Conversation not found or access denied!")
        
    #     user_message= Message(
    #         conversation_id=conversation_id,
    #         role="user",
    #         content= message_in.content
    #     )

    #     session.add(user_message)
    #     session.commit()
    #     session.refresh(user_message)

    #     result= chat_agent.run_sync(message_in.content,deps=message_in.content)

    #     assistant_message= Message(
    #         conversation_id=conversation_id,
    #         role="assistant",
    #         content=result.output
    #     )

    #     session.add(assistant_message)
    #     session.commit()
    #     session.refresh(assistant_message)

    #     return assistant_message
    
    @staticmethod
    def get_chat_history(session:Session, conversation_id:uuid.UUID) -> list[ModelMessage]:

        statement=(
            select(Message)
            .where(Message.conversation_id==conversation_id)
            .order_by(asc(Message.created_at))
        )

        db_messages= session.exec(statement).all()


        history: list[ModelMessage] = []

        for msg in db_messages:
            if msg.role=="user":
                history.append(ModelRequest(parts=[UserPromptPart(content=msg.content)]))
            elif msg.role=="assistant":
                history.append(ModelResponse(parts=[TextPart(content=msg.content)],finish_reason="stop"))

        return history
    


    @staticmethod 
    async def process_chat_message(
        session:Session,
        conversation_id:uuid.UUID,
        user_id:uuid.UUID,
        message_in:MessageCreate
    ) -> Message:
        

        statement= select(Conversation).where(
            Conversation.id==conversation_id,
            Conversation.user_id==user_id
        )

        conversation= session.exec(statement).first()

        if not conversation:
            raise ValueError("Conversation not found or access denied")
        
        user_message= Message(
            conversation_id=conversation_id,
            role="user",
            content=message_in.content
        )

        session.add(user_message)
        session.commit()
        session.refresh(user_message)

        history= ChatService.get_chat_history(session,conversation_id)

        if history:
            history.pop()
        
        result = await chat_agent.run(
            message_in.content,
            message_history= history,
            deps=message_in.content
        )

        agent_response_obj= result.output


        text_content= agent_response_obj.chat_message


        assistant_message= Message(
            conversation_id=conversation_id,
            role="assistant",
            content=text_content
        )

        session.add(assistant_message)
        session.commit()
        session.refresh(assistant_message)


        # TODO: You might want to return 'agent_response_obj' to the API 
        # so the frontend sees the suggestion.
        return assistant_message