import uuid
from typing import List
from fastapi import Depends,APIRouter, HTTPException
from sqlmodel import Session

from ...core.security import  get_current_user
from ...db.db import get_session
from ...models.user import User
from ...schemas.chat import ConversationCreate,ConversationRead,ConversationDetail
from ...services.chat import ChatService


router = APIRouter(tags=["chats"])

@router.get("/",response_model=ConversationRead)
def create_conversation(
    conversation_in: ConversationCreate,
    current_user: User= Depends(get_current_user),
    session: Session= Depends(get_session)
):
    return ChatService.create_conversation(
        session=session,
        user_id= current_user.id,
        conversation_in=conversation_in
    )


@router.get("/",response_model=List[ConversationRead])
def read_conversations(
    skip:int = 0,
    limit:int = 20,
    current_user: User= Depends(get_current_user),
    session: Session= Depends(get_session)
):
    return ChatService.get_user_conversations(
        session=session,
        user_id= current_user.id,
        skip=skip,
        limit=limit
    )


@router.get("/{conversation_id}",response_model=ConversationDetail)
def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User= Depends(get_current_user),
    session: Session= Depends(get_session)
):
    conversation= ChatService.get_conversation(
        session=session,
        user_id=current_user.id,
        conversation_id=conversation_id
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation