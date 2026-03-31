"""
WebSocket Connection Manager
Handles WebSocket connections and message broadcasting.
"""

import uuid
import json
from datetime import datetime, timezone
from typing import Dict
from fastapi import WebSocket
import redis.asyncio as aioredis
from app.core.logger import logger
from app.core.redis_pubsub import RedisPubSubManager


class ConnectionManager:
    """
    Manages WebSocket connections and broadcasts messages.

    Key responsibilities:
    - Track active connections per conversation
    - Broadcast messages to conversation participants
    - Handle user join/leave events
    - Integrate with Redis Pub/Sub for multi-instance scaling
    """

    def __init__(self):
        # conversation_id -> {user_id: WebSocket}
        self.active_connections: Dict[uuid.UUID, Dict[uuid.UUID, WebSocket]] = {}
        self.redis_pubsub: RedisPubSubManager | None = None

    def set_redis_pubsub(self, redis_client: aioredis.Redis):
        """Initialize Redis Pub/Sub manager"""
        self.redis_pubsub = RedisPubSubManager(redis_client)

    async def connect(
        self, websocket: WebSocket, conversation_id: uuid.UUID, user_id: uuid.UUID
    ):
        """Accept WebSocket connection and add to active connections"""
        await websocket.accept()

        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = {}
            # Subscribe to Redis channel for this conversation
            if self.redis_pubsub:
                await self.redis_pubsub.subscribe(
                    f"conversation:{conversation_id}",
                    lambda data: self._handle_redis_message(conversation_id, data),
                )

        self.active_connections[conversation_id][user_id] = websocket
        logger.info(f"User {user_id} connected to conversation {conversation_id}")

    async def disconnect(self, conversation_id: uuid.UUID, user_id: uuid.UUID):
        """Remove connection"""
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].pop(user_id, None)
            logger.info(
                f"User {user_id} disconnected from conversation {conversation_id}"
            )

            # If no more connections, unsubscribe from Redis
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]
                if self.redis_pubsub:
                    await self.redis_pubsub.unsubscribe(
                        f"conversation:{conversation_id}"
                    )

    async def broadcast_to_conversation(
        self,
        conversation_id: uuid.UUID,
        message: dict,
        exclude_user: uuid.UUID | None = None,
    ):
        """
        Broadcast message to all participants in a conversation.

        Args:
            conversation_id: The conversation to broadcast to
            message: The message data to send
            exclude_user: Optional user_id to exclude from broadcast
        """
        # Publish to Redis (other FastAPI instances will receive)
        if self.redis_pubsub:
            await self.redis_pubsub.publish(
                f"conversation:{conversation_id}",
                {
                    **message,
                    "exclude_user": str(exclude_user) if exclude_user else None,
                },
            )

        # Broadcast to local connections
        await self._broadcast_local(conversation_id, message, exclude_user)

    async def _broadcast_local(
        self,
        conversation_id: uuid.UUID,
        message: dict,
        exclude_user: uuid.UUID | None = None,
    ):
        """Broadcast to local WebSocket connections"""
        if conversation_id not in self.active_connections:
            return

        disconnected_users = []

        for user_id, websocket in self.active_connections[conversation_id].items():
            if exclude_user and user_id == exclude_user:
                continue

            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                disconnected_users.append(user_id)

        # Clean up disconnected users
        for user_id in disconnected_users:
            await self.disconnect(conversation_id, user_id)

    async def _handle_redis_message(self, conversation_id: uuid.UUID, data: dict):
        """Handle message received from Redis Pub/Sub"""
        exclude_user_str = data.pop("exclude_user", None)
        exclude_user = uuid.UUID(exclude_user_str) if exclude_user_str else None

        await self._broadcast_local(conversation_id, data, exclude_user)

    async def send_to_user(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID, message: dict
    ):
        """Send message to a specific user"""
        if conversation_id in self.active_connections:
            websocket = self.active_connections[conversation_id].get(user_id)
            if websocket:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send to user {user_id}: {e}")
                    await self.disconnect(conversation_id, user_id)

    def is_user_connected(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Check if a user is connected to a conversation"""
        return (
            conversation_id in self.active_connections
            and user_id in self.active_connections[conversation_id]
        )

    async def close_all(self):
        """Close all connections (for shutdown)"""
        for conversation_id in list(self.active_connections.keys()):
            for user_id in list(self.active_connections[conversation_id].keys()):
                websocket = self.active_connections[conversation_id][user_id]
                try:
                    await websocket.close()
                except Exception:
                    pass

        self.active_connections.clear()

        if self.redis_pubsub:
            await self.redis_pubsub.close_all()


# Global connection manager instance
_connection_manager: ConnectionManager | None = None


def get_connection_manager() -> ConnectionManager:
    """Get the global connection manager instance"""
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager()
    return _connection_manager
