"""
WebSocket endpoint for real-time chat
"""

import uuid
import json
from datetime import datetime, timezone
from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Depends,
    Query,
    HTTPException,
)
from sqlmodel import Session
from app.db.db import get_session
from app.api.websockets.manager import get_connection_manager, ConnectionManager
from app.api.websockets.auth import authenticate_ws_token
from app.services.permissions import ConversationPermissions
from app.services.chat import ChatService
from app.schemas.chat import MessageCreate
from app.core.logger import logger

router = APIRouter()


@router.websocket("/chats/{conversation_id}/ws")
async def chat_websocket(
    websocket: WebSocket,
    conversation_id: uuid.UUID,
    token: str = Query(...),  # JWT passed as query param
    session: Session = Depends(get_session),
    manager: ConnectionManager = Depends(get_connection_manager),
):
    """
    WebSocket endpoint for real-time chat.

    Flow:
    1. Validate JWT token
    2. Check user has access to conversation
    3. Connect to WebSocket
    4. Listen for messages and broadcast to participants
    5. Handle disconnect gracefully

    Message format (client -> server):
    {
        "type": "message" | "typing",
        "data": {
            "content": str,  # for message type
            "is_typing": bool  # for typing type
        }
    }

    Message format (server -> client):
    {
        "type": "message" | "user_joined" | "user_left" | "typing" | "stream_chunk" | "stream_end" | "error",
        "data": {...},
        "timestamp": str
    }
    """

    # Authenticate user
    try:
        user = await authenticate_ws_token(token, session)
    except HTTPException as e:
        await websocket.close(code=1008, reason=e.detail)
        return

    # Check access
    has_access = ConversationPermissions.can_view(session, conversation_id, user.id)
    if not has_access:
        await websocket.close(code=1008, reason="Access denied")
        return

    # Connect
    await manager.connect(websocket, conversation_id, user.id)

    # Notify others that user joined
    await manager.broadcast_to_conversation(
        conversation_id,
        {
            "type": "user_joined",
            "data": {"user_id": str(user.id), "email": user.email},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        exclude_user=user.id,  # Don't send to the user who just joined
    )

    try:
        while True:
            # Receive message from client
            try:
                data = await websocket.receive_json()
            except json.JSONDecodeError:
                await websocket.send_json(
                    {
                        "type": "error",
                        "data": {"message": "Invalid JSON"},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                continue

            message_type = data.get("type")
            message_data = data.get("data", {})

            if message_type == "message":
                # Handle chat message
                await handle_chat_message(
                    websocket=websocket,
                    session=session,
                    manager=manager,
                    conversation_id=conversation_id,
                    user=user,
                    content=message_data.get("content", ""),
                )

            elif message_type == "typing":
                # Broadcast typing indicator (don't save to DB)
                await manager.broadcast_to_conversation(
                    conversation_id,
                    {
                        "type": "typing",
                        "data": {
                            "user_id": str(user.id),
                            "email": user.email,
                            "is_typing": message_data.get("is_typing", False),
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    exclude_user=user.id,
                )

            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "data": {"message": f"Unknown message type: {message_type}"},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )

    except WebSocketDisconnect:
        await manager.disconnect(conversation_id, user.id)
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "user_left",
                "data": {"user_id": str(user.id), "email": user.email},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info(f"User {user.id} disconnected from conversation {conversation_id}")

    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
        await manager.disconnect(conversation_id, user.id)


async def handle_chat_message(
    websocket: WebSocket,
    session: Session,
    manager: ConnectionManager,
    conversation_id: uuid.UUID,
    user,
    content: str,
):
    """
    Handle incoming chat message:
    1. Save user message to DB
    2. Broadcast user message to all participants
    3. Get AI response (streaming)
    4. Broadcast AI response chunks
    5. Save AI response to DB
    6. Trigger background tasks (embeddings, proactive recommendations)
    """
    if not content or len(content) > 4000:
        await websocket.send_json(
            {
                "type": "error",
                "data": {"message": "Message content invalid (empty or too long)"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return

    # Check if user can send messages
    can_send = ConversationPermissions.can_send_message(
        session, conversation_id, user.id
    )
    if not can_send:
        await websocket.send_json(
            {
                "type": "error",
                "data": {"message": "You don't have permission to send messages"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return

    try:
        # Save user message to DB
        from app.models.chats import Message

        user_message = Message(
            conversation_id=conversation_id,
            sender_id=user.id,
            role="user",
            content=content,
        )
        session.add(user_message)
        session.commit()
        session.refresh(user_message)

        # Broadcast user message to all participants
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "message",
                "data": {
                    "id": str(user_message.id),
                    "sender_id": str(user.id),
                    "sender_email": user.email,
                    "role": "user",
                    "content": content,
                    "suggestion": None,
                    "is_proactive": False,
                    "created_at": user_message.created_at.isoformat(),
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Trigger background tasks
        # Note: We'll add Celery tasks later
        # For now, we'll handle embeddings synchronously in the background

        # Get AI response (streaming)
        message_create = MessageCreate(content=content)

        accumulated_text = ""
        suggestion_data = None

        async for chunk_data in ChatService.stream_chat_message_websocket(
            session=session,
            conversation_id=conversation_id,
            user_id=user.id,
            message_in=message_create,
            skip_user_message=True,  # We already saved it
        ):
            # Parse chunk
            if "chat_message" in chunk_data:
                new_text = chunk_data["chat_message"]
                accumulated_text += new_text

                # Broadcast chunk to all participants
                await manager.broadcast_to_conversation(
                    conversation_id,
                    {
                        "type": "stream_chunk",
                        "data": {
                            "content": new_text,
                            "sender_id": None,  # AI message
                            "role": "assistant",
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

            if "suggestion" in chunk_data:
                suggestion_data = chunk_data["suggestion"]

        # Broadcast stream end
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "stream_end",
                "data": {
                    "full_content": accumulated_text,
                    "suggestion": suggestion_data,
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    except Exception as e:
        logger.error(f"Error handling chat message: {e}")
        await websocket.send_json(
            {
                "type": "error",
                "data": {"message": "Failed to process message"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
