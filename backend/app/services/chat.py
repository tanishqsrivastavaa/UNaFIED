import uuid, json
from typing import List, Sequence
from sqlmodel import Session, select, desc, asc, func
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
        limit: int = 20) -> dict:

        total = session.exec(
            select(func.count()).select_from(Conversation).where(Conversation.user_id == user_id)
        ).one()

        statement = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(desc(Conversation.updated_at))
            .offset(skip)
            .limit(limit)
        )
        items = session.exec(statement).all()
        return {"items": items, "total": total}

    @staticmethod
    def get_conversation(
        session: Session,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID
    ) -> Conversation | None:
        statement = select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        )
        return session.exec(statement=statement).first()

    @staticmethod
    def delete_conversation(
        session: Session,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID
    ) -> bool:
        conversation = ChatService.get_conversation(session, user_id, conversation_id)
        if not conversation:
            return False
        session.delete(conversation)
        session.commit()
        return True
    
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


        user_vector= await generate_embedding(message_in.content)

        if user_vector:
            user_embedding= MessageEmbedding(
                message_id=user_message.id,
                embedding=user_vector
            )

            session.add(user_embedding)
            session.commit()

        history= ChatService.get_chat_history(session,conversation_id)

        if history:
            history.pop()

        rag_context= await ChatService.search_relevant_context(
            session=session,
            query_text=message_in.content,
            conversation_id=conversation_id,
            user_id=user_id
        )

        augmented_prompt= f"{rag_context}\n\nUSER QUERY: {message_in.content}"
        
        result = await chat_agent.run(
            augmented_prompt,
            message_history=history,
            deps=augmented_prompt
        )

        raw = result.output  # now a plain string since output_type=str

        # Parse the JSON string the model returns
        try:
            parsed = json.loads(raw)
            text_content = parsed.get("chat_message", raw)
            suggestion_data = parsed.get("suggestion")
        except json.JSONDecodeError:
            text_content = raw
            suggestion_data = None

        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=text_content,
            suggestion=suggestion_data
        )

        session.add(assistant_message)
        session.commit()
        session.refresh(assistant_message)

        return assistant_message
    
    @staticmethod
    async def search_relevant_context(
        session:Session,
        query_text:str,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        limit:int = 3) -> str:

        query_vector= await generate_embedding(query_text)

        if not query_vector:
            return ""
        
        statement= (
            select(Message)
            .join(MessageEmbedding)
            .join(Conversation)
            .where(Conversation.user_id==user_id)
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
        

    @staticmethod
    async def stream_chat_message(
        session: Session,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        message_in: MessageCreate
    ):
        
        """Validatin and setup"""
        statement= select(Conversation).where(
            Conversation.id==conversation_id,
            Conversation.user_id==user_id
        )

        conversation= session.exec(statement).first()

        if not conversation:
            raise ValueError("Conversation not found")
        

        """Saving User message immediately"""
        user_message= Message(
            conversation_id=conversation_id,
            role="user",
            content=message_in.content
            )
        
        session.add(user_message)
        session.commit()
        session.refresh(user_message)

        """Generating embedding from user's message"""

        user_vector= await generate_embedding(message_in.content)

        if user_vector:
            session.add(MessageEmbedding(message_id=user_message.id,embedding=user_vector))
            session.commit()

        """RAG, prepping context"""
        rag_context = await ChatService.search_relevant_context(session,message_in.content,conversation_id,user_id)

        recent_history= ChatService.get_chat_history(session,conversation_id)

        if recent_history:
            recent_history.pop()

        augmented_prompt = f"{rag_context}\n\nUSER QUERY: {message_in.content}"

        async with chat_agent.run_stream(augmented_prompt, message_history=recent_history, deps=augmented_prompt) as result:
            accumulated_text = ""
            last_text_length = 0

            async for chunk in result.stream_output():
                # output_type=str, so chunk is a plain string (accumulated so far)
                current_full_text = chunk or ""

                if len(current_full_text) > last_text_length:
                    new_text = current_full_text[last_text_length:]
                    last_text_length = len(current_full_text)

                    yield json.dumps({"chat_message": new_text, "suggestion": None}) + "\n"

                accumulated_text = current_full_text

            # After streaming is done, try to parse the full accumulated text as JSON
            suggestion_data = None
            final_text = accumulated_text
            try:
                parsed = json.loads(accumulated_text)
                final_text = parsed.get("chat_message", accumulated_text)
                suggestion_data = parsed.get("suggestion")
            except json.JSONDecodeError:
                pass

            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=final_text,
                suggestion=suggestion_data
            )

            session.add(assistant_message)
            session.commit()
            session.refresh(assistant_message)

            """Generating embedding of assistant's message"""
            ai_vector = await generate_embedding(final_text)

            if ai_vector:
                session.add(MessageEmbedding(message_id=assistant_message.id, embedding=ai_vector))
                session.commit()