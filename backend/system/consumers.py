"""
Module: system.consumers
Description: WebSocket consumer managing real-time user notification channel subscriptions and dispatches.
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """Handles real-time WebSocket connections and broadcasts notifications to authenticated users."""

    async def connect(self):
        """Authenticate connecting user, join personal channel group, and send connection acknowledgment."""
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            logger.warning("[WS] Anonymous user attempted WebSocket connection. Rejected.")
            return

        self.user_id = user.id
        self.group_name = f"user_{self.user_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send(
            text_data=json.dumps(
                {
                    "type": "connected",
                    "message": f"Connected successfully. Listening for user {self.user_id} notifications.",
                }
            )
        )

        logger.info(f"[WS] User {self.user_id} connected to notification WebSocket successfully.")

    async def disconnect(self, close_code):
        """Leave personal channel group upon WebSocket disconnect."""
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

        logger.info(
            f"[WS] User {getattr(self, 'user_id', '?')} disconnected. Code: {close_code}"
        )

    async def receive(self, text_data=None, bytes_data=None):
        """Ignore client-to-server messages as this channel is strictly server-to-client broadcast."""
        pass

    async def notification_message(self, event):
        """Forward server-dispatched notification event payload down to the connected WebSocket client."""
        payload = event.get("payload", {})

        await self.send(
            text_data=json.dumps(
                {
                    "type": "notification",
                    "data": payload,
                }
            )
        )
