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
from app.db.db import SessionLocal
from app.api.websockets.manager import get_connection_manager, ConnectionManager
from app.api.websockets.auth import authenticate_ws_token
from app.services.permissions import ConversationPermissions
from app.services.chat import ChatService, SessionFactory
from app.services import listener
from app.schemas.chat import MessageCreate
from app.core.logger import logger


router = APIRouter()


@router.websocket("/ws")
async def user_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    manager: ConnectionManager = Depends(get_connection_manager),
):
    """
    One socket per open app tab, for what happens outside the thread on screen:
    activity in other conversations, new conversations, and reminders.
    The client never sends anything; reading just notices when it closes.
    """
    try:
        with SessionLocal() as s:
            user = await authenticate_ws_token(token, s)
    except HTTPException as e:
        await websocket.close(code=1008, reason=e.detail)
        return

    await manager.connect_user(websocket, user.id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_user(user.id, websocket)


@router.websocket("/chats/{conversation_id}/ws")
async def chat_websocket(
    websocket: WebSocket,
    conversation_id: uuid.UUID,
    token: str = Query(...),  # JWT passed as query param
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
        with SessionLocal() as s:
            user = await authenticate_ws_token(token, s)
    except HTTPException as e:
        await websocket.close(code=1008, reason=e.detail)
        return

    user_id, email = user.id, user.email

    # Check access

    with SessionLocal() as s:
        has_access = ConversationPermissions.can_view(s, conversation_id, user_id)
        if not has_access:
            await websocket.close(code=1008, reason="Access denied")
            return

    # Connect
    first = await manager.connect(websocket, conversation_id, user_id)

    # Notify others that user joined; a second tab or a reconnect isn't a new arrival
    if first:
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "user_joined",
                "data": {"user_id": str(user_id), "email": email},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            exclude_user=user_id,  # Don't send to the user who just joined
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
                    sessions=SessionLocal,
                    manager=manager,
                    conversation_id=conversation_id,
                    user_id=user_id,
                    email=email,
                    content=message_data.get("content", ""),
                )

            elif message_type == "typing":
                # Broadcast typing indicator (don't save to DB)
                await manager.broadcast_to_conversation(
                    conversation_id,
                    {
                        "type": "typing",
                        "data": {
                            "user_id": str(user_id),
                            "email": email,
                            "is_typing": message_data.get("is_typing", False),
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    exclude_user=user_id,
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
        last = await manager.disconnect(conversation_id, user_id, websocket)
        # Only announce a departure when this was the user's last open socket
        if last:
            await manager.broadcast_to_conversation(
                conversation_id,
                {
                    "type": "user_left",
                    "data": {"user_id": str(user_id), "email": email},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
        logger.info(f"User {user_id} disconnected from conversation {conversation_id}")

    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await manager.disconnect(conversation_id, user_id, websocket)


async def handle_chat_message(
    websocket: WebSocket,
    sessions: SessionFactory,
    manager: ConnectionManager,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    email: str,
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
    with sessions() as s:
        can_send = ConversationPermissions.can_send_message(s, conversation_id, user_id)
        assistant_replies = ChatService.assistant_should_reply(
            s, conversation_id, content
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

        with sessions() as s:
            user_message = Message(
                conversation_id=conversation_id,
                sender_id=user_id,
                role="user",
                content=content,
            )
            s.add(user_message)
            s.commit()
            s.refresh(user_message)
            message_id = user_message.id
            created_at = user_message.created_at

        # Broadcast user message to all participants
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "message",
                "data": {
                    "id": str(message_id),
                    "sender_id": str(user_id),
                    "sender_email": email,
                    "role": "user",
                    "content": content,
                    "suggestion": None,
                    "is_proactive": False,
                    "created_at": created_at.isoformat(),
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        listener.watch(conversation_id, message_id)

        if not assistant_replies:
            return

        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "stream_start",
                "data": {"role": "assistant"},
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
            sessions=sessions,
            conversation_id=conversation_id,
            user_id=user_id,
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
