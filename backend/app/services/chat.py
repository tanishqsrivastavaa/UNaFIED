import uuid, json
import re
from ..core.clock import utcnow
from ..models.user import User
from ..schemas.participants import ParticipantRead
from typing import List, Sequence, AsyncGenerator
from sqlmodel import Session, select, desc, asc, func
from ..models.chats import (
    Conversation,
    Message,
    MessageEmbedding,
    ConversationParticipant,
)
from ..schemas.chat import ConversationCreate, MessageCreate
from ..agents.chat_agent import chat_agent
from ..services.embeddings import generate_embedding
from ..services import listener
from pydantic_ai import (
    ModelMessage,
    ModelResponse,
    ModelRequest,
    TextPart,
    UserPromptPart,
)
from ..core.logger import logger
from collections.abc import Callable
from contextlib import AbstractContextManager

SessionFactory = Callable[[], AbstractContextManager[Session]]
ASSISTANT_MENTION = re.compile(r"(?<![\w.])@unafied\b", re.IGNORECASE)


class ChatService:
    @staticmethod
    def create_conversation(
        session: Session, user_id: uuid.UUID, conversation_in: ConversationCreate
    ) -> Conversation:
        """Create a new conversation and add creator as owner participant"""

        conversation_data = conversation_in.model_dump(exclude_unset=True)

        conversation = Conversation(**conversation_data, owner_id=user_id)

        session.add(conversation)
        session.commit()
        session.refresh(conversation)

        # Add creator as owner participant
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user_id,
            role="owner",
            is_active=True,
        )
        session.add(participant)
        session.commit()

        return conversation

    @staticmethod
    def get_user_conversations(
        session: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 20
    ) -> dict:
        """Get all conversations where user is a participant"""

        # Count total conversations
        total = session.exec(
            select(func.count())
            .select_from(Conversation)
            .join(ConversationParticipant)
            .where(
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_active == True,
            )
        ).one()

        # Get conversations
        statement = (
            select(Conversation)
            .join(ConversationParticipant)
            .where(
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_active == True,
            )
            .order_by(desc(Conversation.updated_at))
            .offset(skip)
            .limit(limit)
        )
        items = session.exec(statement).all()

        # Add participant count to each conversation
        result_items = []
        for item in items:
            participant_count = session.exec(
                select(func.count())
                .select_from(ConversationParticipant)
                .where(
                    ConversationParticipant.conversation_id == item.id,
                    ConversationParticipant.is_active == True,
                )
            ).one()

            # Convert to dict and add count
            item_dict = item.model_dump()
            item_dict["participant_count"] = participant_count
            result_items.append(item_dict)

        return {"items": result_items, "total": total}

    @staticmethod
    def get_conversation(
        session: Session, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> Conversation | None:
        """Get conversation if user is a participant or it's public"""

        statement = select(Conversation).where(Conversation.id == conversation_id)
        conversation = session.exec(statement).first()

        if not conversation:
            return None

        # Check if public or user is participant
        if conversation.is_public:
            return conversation

        participant = session.exec(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_active == True,
            )
        ).first()

        return conversation if participant else None

    @staticmethod
    def delete_conversation(
        session: Session, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> bool:
        """Delete conversation (only owner can delete)"""
        conversation = session.exec(
            select(Conversation).where(
                Conversation.id == conversation_id, Conversation.owner_id == user_id
            )
        ).first()

        if not conversation:
            return False

        session.delete(conversation)
        session.commit()
        return True

    @staticmethod
    def get_chat_history(
        session: Session, conversation_id: uuid.UUID
    ) -> list[ModelMessage]:
        """Get chat history formatted for Pydantic AI"""

        statement = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(asc(Message.created_at))
        )

        db_messages = session.exec(statement).all()

        history: list[ModelMessage] = []

        for msg in db_messages:
            if msg.role == "user":
                history.append(
                    ModelRequest(parts=[UserPromptPart(content=msg.content)])
                )
            elif msg.role == "assistant":
                full_content = msg.content
                if msg.suggestion and msg.suggestion.get("tool_name") == "reminder":
                    full_content += f"\n\n[Reminder set: {msg.suggestion.get('label')}, due {msg.suggestion['parameters'].get('due_at')}]"
                history.append(ModelResponse(parts=[TextPart(content=full_content)]))

        return history

    @staticmethod
    async def process_chat_message(
        session: Session,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        message_in: MessageCreate,
    ) -> Message:
        """Process a chat message (non-streaming)"""

        # Verify access via permissions
        from ..services.permissions import ConversationPermissions

        if not ConversationPermissions.can_send_message(
            session, conversation_id, user_id
        ):
            raise ValueError("Access denied")

        # Save user message
        user_message = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            role="user",
            content=message_in.content,
        )

        session.add(user_message)
        session.get(Conversation, conversation_id).updated_at = utcnow()
        session.commit()
        session.refresh(user_message)
        listener.watch(conversation_id, user_message.id)

        # Generate embedding
        user_vector = await generate_embedding(message_in.content)

        if user_vector:
            user_embedding = MessageEmbedding(
                message_id=user_message.id, embedding=user_vector
            )
            session.add(user_embedding)
            session.commit()

        # Get history and RAG context
        history = ChatService.get_chat_history(session, conversation_id)

        if history:
            history.pop()

        rag_context = await ChatService.search_relevant_context(
            session=session,
            query_text=message_in.content,
            conversation_id=conversation_id,
            user_id=user_id,
        )

        augmented_prompt = f"{rag_context}\n\nUSER QUERY: {message_in.content}"

        # Get AI response
        result = await chat_agent.run(
            augmented_prompt, message_history=history, deps=augmented_prompt
        )

        raw = result.output

        # Parse response
        try:
            parsed = json.loads(raw)
            text_content = parsed.get("chat_message", raw)
            suggestion_data = parsed.get("suggestion")
        except json.JSONDecodeError:
            text_content = raw
            suggestion_data = None

        # Save assistant message
        assistant_message = Message(
            conversation_id=conversation_id,
            sender_id=None,  # AI has no sender_id
            role="assistant",
            content=text_content,
            suggestion=suggestion_data,
        )

        session.add(assistant_message)
        session.commit()
        session.refresh(assistant_message)

        return assistant_message

    @staticmethod
    async def search_relevant_context(
        session: Session,
        query_text: str,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        limit: int = 3,
        query_vector: list[float] | None = None,
    ) -> str:
        """Search for relevant context using RAG (scoped to conversations user has access to).

        Pass query_vector when the caller has already embedded query_text, so the
        provider isn't called twice and no session is held across the call.
        """

        if query_vector is None:
            query_vector = await generate_embedding(query_text)

        if not query_vector:
            return ""

        # Search across user's accessible conversations
        statement = (
            select(Message)
            .join(MessageEmbedding)
            .join(Conversation)
            .join(ConversationParticipant)
            .where(
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_active == True,
            )
            .order_by(MessageEmbedding.embedding.cosine_distance(query_vector))  # type: ignore
            .limit(limit)
        )

        results = session.exec(statement).all()

        if not results:
            return ""

        context_str = "RELEVANT PAST MEMORIES:\n"

        for msg in results:
            context_str += f"- [{msg.role.upper()}]: {msg.content}\n"

        return context_str

    @staticmethod
    async def stream_chat_message(
        session: Session,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        message_in: MessageCreate,
    ) -> AsyncGenerator[str, None]:
        """Stream chat message (for HTTP endpoint)"""

        # Verify access
        from ..services.permissions import ConversationPermissions

        if not ConversationPermissions.can_send_message(
            session, conversation_id, user_id
        ):
            raise ValueError("Access denied")

        # Save user message
        user_message = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            role="user",
            content=message_in.content,
        )

        session.add(user_message)
        session.get(Conversation, conversation_id).updated_at = utcnow()
        session.commit()
        session.refresh(user_message)
        listener.watch(conversation_id, user_message.id)

        # Generate embedding
        user_vector = await generate_embedding(message_in.content)

        if user_vector:
            session.add(
                MessageEmbedding(message_id=user_message.id, embedding=user_vector)
            )
            session.commit()

        # Shared chats only get a reply when someone mentions @unafied
        if not ChatService.assistant_should_reply(session, conversation_id, message_in.content):
            return

        # RAG and history
        rag_context = await ChatService.search_relevant_context(
            session, message_in.content, conversation_id, user_id
        )

        recent_history = ChatService.get_chat_history(session, conversation_id)

        if recent_history:
            recent_history.pop()

        augmented_prompt = f"{rag_context}\n\nUSER QUERY: {message_in.content}"

        # Stream response
        async with chat_agent.run_stream(
            augmented_prompt, message_history=recent_history, deps=augmented_prompt
        ) as result:
            accumulated_text = ""
            last_text_length = 0

            async for chunk in result.stream_output():
                current_full_text = chunk or ""

                if len(current_full_text) > last_text_length:
                    new_text = current_full_text[last_text_length:]
                    last_text_length = len(current_full_text)

                    yield (
                        json.dumps({"chat_message": new_text, "suggestion": None})
                        + "\n"
                    )

                accumulated_text = current_full_text

            # Parse final result
            suggestion_data = None
            final_text = accumulated_text
            try:
                parsed = json.loads(accumulated_text)
                final_text = parsed.get("chat_message", accumulated_text)
                suggestion_data = parsed.get("suggestion")
            except json.JSONDecodeError:
                pass

            # Save assistant message
            assistant_message = Message(
                conversation_id=conversation_id,
                sender_id=None,
                role="assistant",
                content=final_text,
                suggestion=suggestion_data,
            )

            session.add(assistant_message)
            session.commit()
            session.refresh(assistant_message)

            # Generate embedding
            ai_vector = await generate_embedding(final_text)

            if ai_vector:
                session.add(
                    MessageEmbedding(
                        message_id=assistant_message.id, embedding=ai_vector
                    )
                )
                session.commit()

    @staticmethod
    async def stream_chat_message_websocket(
        sessions: SessionFactory,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        message_in: MessageCreate,
        skip_user_message: bool = False,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream chat message for WebSocket (returns dict chunks instead of JSON strings).
        Used by WebSocket endpoint to broadcast AI responses.

        Takes a session factory, not a session: the read and write phases each open
        a short session, and none is held while the model streams.

        Args:
            skip_user_message: If True, don't save user message (already saved by WS handler)
        """

        from ..services.permissions import ConversationPermissions

        query_vector = await generate_embedding(message_in.content)

        user_message_id = None

        with sessions() as session:
            if not ConversationPermissions.can_send_message(
                session, conversation_id, user_id
            ):
                raise ValueError("Access denied")

            if not skip_user_message:
                user_message = Message(
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    role="user",
                    content=message_in.content,
                )

                session.add(user_message)
                session.commit()
                session.refresh(user_message)
                user_message_id = user_message.id

            rag_context = await ChatService.search_relevant_context(
                session,
                message_in.content,
                conversation_id,
                user_id,
                query_vector=query_vector,
            )

            recent_history = ChatService.get_chat_history(session, conversation_id)

        if user_message_id is not None and query_vector:
            with sessions() as session:
                session.add(
                    MessageEmbedding(message_id=user_message_id, embedding=query_vector)
                )
                session.commit()

        if recent_history:
            recent_history.pop()

        augmented_prompt = f"{rag_context}\n\nUSER QUERY: {message_in.content}"

        async with chat_agent.run_stream(
            augmented_prompt, message_history=recent_history, deps=augmented_prompt
        ) as result:
            accumulated_text = ""
            last_text_length = 0

            async for chunk in result.stream_output():
                current_full_text = chunk or ""

                if len(current_full_text) > last_text_length:
                    new_text = current_full_text[last_text_length:]
                    last_text_length = len(current_full_text)

                    yield {"chat_message": new_text, "suggestion": None}

                accumulated_text = current_full_text

        suggestion_data = None
        final_text = accumulated_text
        try:
            parsed = json.loads(accumulated_text)
            final_text = parsed.get("chat_message", accumulated_text)
            suggestion_data = parsed.get("suggestion")
        except json.JSONDecodeError:
            pass

        with sessions() as session:
            assistant_message = Message(
                conversation_id=conversation_id,
                sender_id=None,
                role="assistant",
                content=final_text,
                suggestion=suggestion_data,
            )

            session.add(assistant_message)
            session.commit()
            session.refresh(assistant_message)
            assistant_message_id = assistant_message.id

        if suggestion_data:
            yield {"chat_message": "", "suggestion": suggestion_data}

        ai_vector = await generate_embedding(final_text)
        if ai_vector:
            with sessions() as session:
                session.add(
                    MessageEmbedding(
                        message_id=assistant_message_id, embedding=ai_vector
                    )
                )
                session.commit()

    @staticmethod
    def add_participant(
        session: Session, conversation_id: uuid.UUID, inviter_id: uuid.UUID, email: str
    ) -> ParticipantRead:
        """Add a user to a conversation by email; re-adds them if they had left"""
        from ..services.permissions import ConversationPermissions

        # A cached current_user carries its id as text, so normalise before comparing
        inviter_id = uuid.UUID(str(inviter_id))

        if not ConversationPermissions.can_invite(session, conversation_id, inviter_id):
            raise PermissionError("Only people in this conversation can add others")

        invitee = session.exec(
            select(User).where(func.lower(User.email) == email.strip().lower())
        ).first()
        if not invitee:
            raise LookupError("No account uses that email")
        if invitee.id == inviter_id:
            raise ValueError("You are already in this conversation")

        participant = session.exec(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == invitee.id,
            )
        ).first()
        if participant and participant.is_active:
            raise ValueError(f"{invitee.email} is already in this conversation")

        if participant:
            participant.is_active = True
            participant.left_at = None
            participant.joined_at = utcnow()
        else:
            participant = ConversationParticipant(
                conversation_id=conversation_id, user_id=invitee.id, role="member"
            )
        session.add(participant)

        # Moves the conversation to the top of everyone's list
        conversation = session.get(Conversation, conversation_id)
        conversation.updated_at = utcnow()
        session.add(conversation)

        session.commit()
        session.refresh(participant)
        return ParticipantRead(**participant.model_dump(), email=invitee.email)

    @staticmethod
    def get_conversation_detail(
        session: Session, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> dict | None:
        """Conversation with its messages in time order, each carrying its sender's email, plus its participants"""
        conversation = ChatService.get_conversation(session, user_id, conversation_id)
        if not conversation:
            return None

        message_rows = session.exec(
            select(Message, User.email)
            .outerjoin(User, Message.sender_id == User.id)
            .where(Message.conversation_id == conversation_id)
            .order_by(asc(Message.created_at))
        ).all()

        participant_rows = session.exec(
            select(ConversationParticipant, User.email)
            .join(User, ConversationParticipant.user_id == User.id)
            .where(ConversationParticipant.conversation_id == conversation_id)
            .order_by(asc(ConversationParticipant.joined_at))
        ).all()

        participants = [
            {**p.model_dump(), "email": email} for p, email in participant_rows
        ]
        return {
            **conversation.model_dump(),
            "participant_count": sum(1 for p in participants if p["is_active"]),
            "messages": [
                {**m.model_dump(), "sender_email": email} for m, email in message_rows
            ],
            "participants": participants,
        }

    @staticmethod
    def active_member_ids(session: Session, conversation_id: uuid.UUID) -> list[uuid.UUID]:
        return list(
            session.exec(
                select(ConversationParticipant.user_id).where(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.is_active == True,
                )
            ).all()
        )

    @staticmethod
    def assistant_should_reply(
        session: Session, conversation_id: uuid.UUID, content: str
    ) -> bool:
        active = session.exec(
            select(func.count())
            .select_from(ConversationParticipant)
            .where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.is_active == True,
            )
        ).one()
        return active < 2 or bool(ASSISTANT_MENTION.search(content))
