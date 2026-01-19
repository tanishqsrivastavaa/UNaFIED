import uuid
from typing import List, Sequence
from sqlmodel import Session, select, desc,asc
from ..models.chats import Conversation,Message,MessageEmbedding
from ..schemas.chat import ConversationCreate,MessageCreate
from ..agents.chat_agent import chat_agent
from ..services.embeddings import generate_embedding
# from pgvector.sqlalchemy import cosine_distance
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
                full_content= msg.content
                if msg.suggestion:
                    full_content+= f"\n\n[SYSTEM MEMORY: You suggested action'{msg.suggestion.get('label')}' using tool '{msg.suggestion.get('tool_name')}'.]"
                history.append(ModelResponse(parts=[TextPart(content=full_content)]))
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

        rag_context= await ChatService.search_relevant_context(
            session=session,
            query_text=message_in.content,
            conversation_id=conversation_id
        )

        augmented_prompt= f"{rag_context}\n\nUSER QUERY: {message_in.content}"
        
        result = await chat_agent.run(
            augmented_prompt,
            message_history= history,
            deps=augmented_prompt
        )

        agent_response_obj= result.output

        suggestion_data= None

        
        if agent_response_obj.suggestion:
            suggestion_data= agent_response_obj.suggestion.model_dump()



        text_content= agent_response_obj.chat_message


        assistant_message= Message(
            conversation_id=conversation_id,
            role="assistant",
            content=text_content,
            suggestion=suggestion_data
        )

        session.add(assistant_message)
        session.commit()
        session.refresh(assistant_message)


        # TODO: You might want to return 'agent_response_obj' to the API 
        # so the frontend sees the suggestion.
        return assistant_message
    
    @staticmethod
    async def search_relevant_context(session:Session, query_text:str,conversation_id: uuid.UUID,limit:int = 3) -> str:

        query_vector= await generate_embedding(query_text)

        if not query_vector:
            return ""
        
        statement= (
            select(Message)
            .join(MessageEmbedding)
            .where(Message.conversation_id==conversation_id)
            .order_by(MessageEmbedding.embedding.cosine_distance(query_vector)) # type: ignore
            .limit(limit)
        )

        results= session.exec(statement).all()

        if not results:
            return ""
        
        context_str= "RELEVANT PAST MEMORIES:\n"

        for msg in results:
            context_str+= f"- [{msg.role.upper()}]: {msg.content}\n"

        return context_str
        