"""
Module: chat.consumers
Description: WebSocket consumer managing real-time chat messages, typing indicators, and room subscriptions.
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer handling real-time messaging, typing indicators, and room broadcasting."""

    async def connect(self):
        """Authenticate connection, verify room membership permissions, and join room channel layer."""
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"chat_room_{self.room_id}"
        self.user = self.scope.get("user")

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            logger.warning(f"[WS Chat] Unauthenticated connection attempt to Room #{self.room_id}. Rejected.")
            return

        has_access = await self.check_user_access(self.room_id, self.user.id)
        if not has_access:
            await self.close(code=4003)
            logger.warning(f"[WS Chat] User #{self.user.id} denied access to Room #{self.room_id}.")
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()
        await self.mark_room_as_read(self.room_id, self.user.id)

        await self.send(
            text_data=json.dumps({
                "type": "connected",
                "room_id": self.room_id,
                "message": f"Connected to Chat Room #{self.room_id}",
            })
        )
        logger.info(f"[WS Chat] User #{self.user.id} connected to Chat Room #{self.room_id}.")

    async def disconnect(self, close_code):
        """Leave room channel layer on disconnect."""
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )
        logger.info(f"[WS Chat] User #{getattr(self.user, 'id', '?')} disconnected from Room #{getattr(self, 'room_id', '?')}.")

    async def receive(self, text_data=None, bytes_data=None):
        """Process incoming WebSocket payloads for typing indicators or chat messages."""
        try:
            data = json.loads(text_data)
        except Exception:
            return

        event_type = data.get("type", "message")

        if event_type == "typing":
            user_name = getattr(self.user, "full_name", "") or self.user.email.split("@")[0]
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat.typing",
                    "user_id": self.user.id,
                    "user_name": user_name,
                    "is_typing": data.get("is_typing", True),
                },
            )
        elif event_type == "message":
            content = data.get("content", "").strip()
            attachment_url = data.get("attachment_url")
            attachment_name = data.get("attachment_name")
            attachment_size = data.get("attachment_size")

            if not content and not attachment_url:
                return

            result = await self.save_message(
                self.room_id,
                self.user.id,
                content,
                attachment_url,
                attachment_name,
                attachment_size,
            )

            if result:
                msg_obj, notif_payloads = result
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat.message",
                        "message": msg_obj,
                    },
                )

                for np in (notif_payloads or []):
                    await self.channel_layer.group_send(
                        f"user_{np['target_user_id']}",
                        {
                            "type": "notification.message",
                            "payload": np["payload"],
                        },
                    )
            else:
                await self.send(
                    text_data=json.dumps({
                        "type": "error",
                        "message": "This project is closed and archived as read-only. New messages are not allowed.",
                    })
                )

    async def chat_message(self, event):
        """Receive broadcast message event and forward to client with connection-specific ownership flag."""
        message_data = event.get("message", {})
        message_data_copy = dict(message_data)
        sender_info = message_data_copy.get("sender") or {}
        sender_id = sender_info.get("id") if isinstance(sender_info, dict) else message_data_copy.get("sender_id")
        message_data_copy["is_mine"] = (sender_id == self.user.id)

        await self.send(
            text_data=json.dumps({
                "type": "chat_message",
                "data": message_data_copy,
            })
        )

    async def chat_typing(self, event):
        """Receive typing broadcast event and forward to client excluding the sender."""
        if event.get("user_id") != self.user.id:
            await self.send(
                text_data=json.dumps({
                    "type": "typing_indicator",
                    "data": {
                        "user_id": event.get("user_id"),
                        "user_name": event.get("user_name"),
                        "is_typing": event.get("is_typing", False),
                    },
                })
            )

    @database_sync_to_async
    def check_user_access(self, room_id, user_id):
        """Verify user participation record in database for specified room."""
        from .models import ChatParticipant
        return ChatParticipant.objects.filter(room_id=room_id, user_id=user_id).exists()

    @database_sync_to_async
    def mark_room_as_read(self, room_id, user_id):
        """Update last-read timestamp for participant in database."""
        from .models import ChatParticipant
        ChatParticipant.objects.filter(room_id=room_id, user_id=user_id).update(last_read_at=timezone.now())

    @database_sync_to_async
    def save_message(self, room_id, user_id, content, attachment_url, attachment_name, attachment_size):
        """Persist new chat message and generate notification sync payloads for participants."""
        from django.contrib.auth import get_user_model
        from system.models import Notification
        from .models import ChatRoom, ChatMessage, ChatParticipant
        from .serializers import ChatMessageSerializer

        User = get_user_model()
        sender = User.objects.filter(id=user_id).first()
        room = ChatRoom.objects.select_related("job").filter(id=room_id).first()
        if not room:
            return None

        # Disallow new messages if parent job channel is completed or cancelled
        if room.room_type == ChatRoom.RoomType.JOB and room.job:
            if room.job.status in ["COMPLETED", "CANCELLED"]:
                return None

        msg = ChatMessage.objects.create(
            room=room,
            sender_id=user_id,
            content=content,
            attachment_url=attachment_url,
            attachment_name=attachment_name,
            attachment_size=attachment_size,
        )

        room.updated_at = timezone.now()
        room.save(update_fields=["updated_at"])
        ChatParticipant.objects.filter(room=room, user_id=user_id).update(last_read_at=timezone.now())

        notif_payloads = []
        other_participants = room.participants.exclude(user_id=user_id)
        for participant in other_participants:
            notif_payloads.append({
                "target_user_id": participant.user_id,
                "payload": {
                    "type": "chat_badge_sync",
                    "room_id": room.id,
                },
            })

        return ChatMessageSerializer(msg).data, notif_payloads
