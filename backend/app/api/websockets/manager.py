"""
WebSocket Connection Manager
Handles WebSocket connections and message broadcasting.
"""

import uuid
import json
from datetime import datetime, timezone
from typing import Dict, Set
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
        # conversation_id -> {user_id: {WebSocket, ...}}  (a user can have several tabs open)
        self.active_connections: Dict[uuid.UUID, Dict[uuid.UUID, Set[WebSocket]]] = {}
        # user_id -> {WebSocket, ...}: one per open app tab, for events outside any thread
        self.user_connections: Dict[uuid.UUID, Set[WebSocket]] = {}
        self.redis_pubsub: RedisPubSubManager | None = None
        self.instance_id = str(uuid.uuid4())

    def set_redis_pubsub(self, redis_client: aioredis.Redis):
        """Initialize Redis Pub/Sub manager"""
        self.redis_pubsub = RedisPubSubManager(redis_client)

    async def connect(
        self, websocket: WebSocket, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Accept the socket and track it. Returns True if it is the user's first socket here."""
        await websocket.accept()

        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = {}
            # Subscribe to Redis channel for this conversation
            if self.redis_pubsub:
                await self.redis_pubsub.subscribe(
                    f"conversation:{conversation_id}",
                    lambda data: self._handle_redis_message(conversation_id, data),
                )

        sockets = self.active_connections[conversation_id].setdefault(user_id, set())
        first = not sockets
        sockets.add(websocket)
        logger.info(f"User {user_id} connected to conversation {conversation_id}")
        return first

    async def disconnect(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID, websocket: WebSocket
    ) -> bool:
        """Stop tracking one socket. Returns True if it was the user's last one here."""
        users = self.active_connections.get(conversation_id)
        if not users or websocket not in users.get(user_id, set()):
            return False  # already gone, e.g. a stale close after a reconnect

        users[user_id].discard(websocket)
        logger.info(f"User {user_id} disconnected from conversation {conversation_id}")
        last = not users[user_id]
        if last:
            del users[user_id]

        # If no more connections, unsubscribe from Redis
        if not users:
            del self.active_connections[conversation_id]
            if self.redis_pubsub:
                await self.redis_pubsub.unsubscribe(f"conversation:{conversation_id}")
        return last

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
            await self.redis_pubsub.publish(  # This broadcasts to the subscribers
                f"conversation:{conversation_id}",
                {
                    **message,
                    "exclude_user": str(exclude_user) if exclude_user else None,
                    "origin": self.instance_id,
                },
            )

        # Broadcast to local connections
        await self._broadcast_local(
            conversation_id, message, exclude_user
        )  # This broadcasts to the socket

    async def _broadcast_local(
        self,
        conversation_id: uuid.UUID,
        message: dict,
        exclude_user: uuid.UUID | None = None,
    ):
        """Broadcast to local WebSocket connections"""
        if conversation_id not in self.active_connections:
            return

        failed = []

        # Snapshot first: a connect or disconnect can land while we await a send
        for user_id, sockets in list(self.active_connections[conversation_id].items()):
            if exclude_user and user_id == exclude_user:
                continue

            for websocket in list(sockets):
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send to user {user_id}: {e}")
                    failed.append((user_id, websocket))

        # Clean up only the sockets that failed
        for user_id, websocket in failed:
            await self.disconnect(conversation_id, user_id, websocket)

    async def _handle_redis_message(self, conversation_id: uuid.UUID, data: dict):
        """Handle message received from Redis Pub/Sub"""
        if data.pop("origin", None) == self.instance_id:
            return

        exclude_user_str = data.pop("exclude_user", None)
        exclude_user = uuid.UUID(exclude_user_str) if exclude_user_str else None

        await self._broadcast_local(conversation_id, data, exclude_user)

    async def send_to_user(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID, message: dict
    ):
        """Send message to a specific user"""
        sockets = self.active_connections.get(conversation_id, {}).get(user_id, set())
        for websocket in list(sockets):
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                await self.disconnect(conversation_id, user_id, websocket)

    async def connect_user(self, websocket: WebSocket, user_id: uuid.UUID):
        """Accept a person's app-wide socket."""
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
            if self.redis_pubsub:
                await self.redis_pubsub.subscribe(
                    f"user:{user_id}",
                    lambda data: self._handle_user_redis_message(user_id, data),
                )
        self.user_connections[user_id].add(websocket)

    async def disconnect_user(self, user_id: uuid.UUID, websocket: WebSocket):
        sockets = self.user_connections.get(user_id)
        if not sockets or websocket not in sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            del self.user_connections[user_id]
            if self.redis_pubsub:
                await self.redis_pubsub.unsubscribe(f"user:{user_id}")

    async def notify_user(self, user_id: uuid.UUID, message: dict):
        """Send an event to every open tab of one person, on any server."""
        if self.redis_pubsub:
            await self.redis_pubsub.publish(f"user:{user_id}", {**message, "origin": self.instance_id})
        await self._send_user_local(user_id, message)

    async def _handle_user_redis_message(self, user_id: uuid.UUID, data: dict):
        if data.pop("origin", None) == self.instance_id:
            return
        await self._send_user_local(user_id, data)

    async def _send_user_local(self, user_id: uuid.UUID, message: dict):
        failed = []
        for websocket in list(self.user_connections.get(user_id, ())):
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                failed.append(websocket)
        for websocket in failed:
            await self.disconnect_user(user_id, websocket)

    def is_user_connected(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Check if a user is connected to a conversation"""
        return bool(self.active_connections.get(conversation_id, {}).get(user_id))

    async def close_all(self):
        """Close all connections (for shutdown)"""
        for users in list(self.active_connections.values()):
            for sockets in list(users.values()):
                for websocket in list(sockets):
                    try:
                        await websocket.close()
                    except Exception:
                        pass

        self.active_connections.clear()

        for sockets in list(self.user_connections.values()):
            for websocket in list(sockets):
                try:
                    await websocket.close()
                except Exception:
                    pass
        self.user_connections.clear()

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
