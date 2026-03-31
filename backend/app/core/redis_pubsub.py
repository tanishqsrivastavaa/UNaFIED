"""
Redis Pub/Sub Manager for multi-instance WebSocket scaling.
"""

import json
import asyncio
from typing import Callable, Dict
import redis.asyncio as aioredis
from app.core.logger import logger


class RedisPubSubManager:
    """
    Handles Redis Pub/Sub for multi-instance WebSocket scaling.

    When multiple FastAPI instances run behind a load balancer,
    messages need to be broadcast across all instances.
    """

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.subscriptions: Dict[str, aioredis.client.PubSub] = {}
        self._listen_tasks: Dict[str, asyncio.Task] = {}

    async def subscribe(self, channel: str, callback: Callable):
        """Subscribe to a Redis channel and call callback on new messages"""
        if channel in self.subscriptions:
            logger.warning(f"Already subscribed to {channel}")
            return

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(channel)
        self.subscriptions[channel] = pubsub

        # Start listening in background
        task = asyncio.create_task(self._listen(pubsub, callback, channel))
        self._listen_tasks[channel] = task

        logger.info(f"Subscribed to Redis channel: {channel}")

    async def _listen(
        self, pubsub: aioredis.client.PubSub, callback: Callable, channel: str
    ):
        """Listen for messages on subscribed channel"""
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await callback(data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to decode message from {channel}: {e}")
                    except Exception as e:
                        logger.error(f"Callback error for {channel}: {e}")
        except asyncio.CancelledError:
            logger.info(f"Listener for {channel} cancelled")
        except Exception as e:
            logger.error(f"Error in listener for {channel}: {e}")

    async def publish(self, channel: str, data: dict):
        """Publish message to Redis channel"""
        try:
            await self.redis.publish(channel, json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to publish to {channel}: {e}")

    async def unsubscribe(self, channel: str):
        """Unsubscribe from channel"""
        if channel in self.subscriptions:
            # Cancel listener task
            if channel in self._listen_tasks:
                self._listen_tasks[channel].cancel()
                del self._listen_tasks[channel]

            # Unsubscribe and close
            await self.subscriptions[channel].unsubscribe(channel)
            await self.subscriptions[channel].close()
            del self.subscriptions[channel]

            logger.info(f"Unsubscribed from Redis channel: {channel}")

    async def close_all(self):
        """Close all subscriptions"""
        for channel in list(self.subscriptions.keys()):
            await self.unsubscribe(channel)
