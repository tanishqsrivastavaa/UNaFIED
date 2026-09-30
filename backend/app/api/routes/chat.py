import uuid
import re
from typing import List, Any
from fastapi import Depends, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session
from datetime import datetime, timezone
from ...schemas.participants import ParticipantRead, ParticipantInvite
from ..websockets.manager import ConnectionManager, get_connection_manager
from ...core.security import get_current_user_hashed
from ...db.db import get_session
from ...models.user import User
from ...services.chat import ChatService
from ...schemas.chat import (
    ConversationCreate,
    ConversationRead,
    ConversationDetail,
    MessageCreate,
    MessageRead,
)


router = APIRouter(tags=["chats"])


@router.post("/", response_model=ConversationRead)
def create_conversation(
    conversation_in: ConversationCreate,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    return ChatService.create_conversation(
        session=session, user_id=current_user.id, conversation_in=conversation_in
    )


@router.get("/")
def read_conversations(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    return ChatService.get_user_conversations(
        session=session, user_id=current_user.id, skip=skip, limit=limit
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation_detail(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    conversation = ChatService.get_conversation_detail(
        session=session, user_id=current_user.id, conversation_id=conversation_id
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conversation


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
):
    deleted = ChatService.delete_conversation(
        session=session, user_id=current_user.id, conversation_id=conversation_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.post("/{conversation_id}/messages", response_model=MessageRead)
async def send_message(
    conversation_id: uuid.UUID,
    message_in: MessageCreate,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
) -> Any:

    try:
        return await ChatService.process_chat_message(
            session=session,
            conversation_id=conversation_id,
            user_id=current_user.id,
            message_in=message_in,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{conversation_id}/stream")
async def stream_message(
    conversation_id: uuid.UUID,
    message_in: MessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user_hashed),
):
    return StreamingResponse(
        ChatService.stream_chat_message(
            session, conversation_id, current_user.id, message_in
        ),
        media_type="application/x-ndjson",
    )


@router.post(
    "/{conversation_id}/participants",
    response_model=ParticipantRead,
    status_code=201,
)
async def invite_participant(
    conversation_id: uuid.UUID,
    invite: ParticipantInvite,
    current_user: User = Depends(get_current_user_hashed),
    session: Session = Depends(get_session),
    manager: ConnectionManager = Depends(get_connection_manager),
):
    try:
        participant = ChatService.add_participant(
            session=session,
            conversation_id=conversation_id,
            inviter_id=current_user.id,
            email=invite.email,
        )
    except PermissionError:
        raise HTTPException(status_code=404, detail="Conversation not found")
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Open threads update their participant list without a reload
    await manager.broadcast_to_conversation(
        conversation_id,
        {
            "type": "participant_added",
            "data": {"user_id": str(participant.user_id), "email": participant.email},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    return participant
