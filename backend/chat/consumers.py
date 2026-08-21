import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer xử lý tin nhắn Realtime cho từng phòng chat (Job channel hoặc 1-1).
    URL: ws://localhost:8000/ws/chat/<room_id>/
    """

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"chat_room_{self.room_id}"
        self.user = self.scope.get("user")

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            logger.warning(f"[WS Chat] Anonymous user cố kết nối vào Room #{self.room_id}. Từ chối.")
            return

        # Kiểm tra quyền truy cập phòng chat
        has_access = await self.check_user_access(self.room_id, self.user.id)
        if not has_access:
            await self.close(code=4003)
            logger.warning(f"[WS Chat] User #{self.user.id} không có quyền vào Room #{self.room_id}.")
            return

        # Tham gia group phòng chat
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

        # Đánh dấu đã đọc tin nhắn khi mở phòng
        await self.mark_room_as_read(self.room_id, self.user.id)

        await self.send(
            text_data=json.dumps({
                "type": "connected",
                "room_id": self.room_id,
                "message": f"Connected to Chat Room #{self.room_id}",
            })
        )
        logger.info(f"[WS Chat] User #{self.user.id} kết nối vào Chat Room #{self.room_id}.")

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )
        logger.info(f"[WS Chat] User #{getattr(self.user, 'id', '?')} ngắt kết nối Room #{getattr(self, 'room_id', '?')}.")

    async def receive(self, text_data=None, bytes_data=None):
        """
        Nhận event từ client qua WebSocket (gửi tin nhắn hoặc typing indicator).
        """
        try:
            data = json.loads(text_data)
        except Exception:
            return

        event_type = data.get("type", "message")

        if event_type == "typing":
            # Phát sóng trạng thái đang gõ phím tới những người khác trong phòng
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

            # Lưu vào Database
            msg_obj = await self.save_message(
                self.room_id,
                self.user.id,
                content,
                attachment_url,
                attachment_name,
                attachment_size,
            )

            if msg_obj:
                # Phát sóng tin nhắn tới tất cả client trong phòng
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat.message",
                        "message": msg_obj,
                    },
                )
            else:
                # Báo lỗi trực tiếp cho người gửi nếu kênh Job đã bị đóng băng (Archived Read-Only)
                await self.send(
                    text_data=json.dumps({
                        "type": "error",
                        "message": "This project is closed and archived as read-only. New messages are not allowed.",
                    })
                )

    async def chat_message(self, event):
        """
        Handler nhận tin nhắn từ group_send và đẩy xuống client.
        """
        message_data = event.get("message", {})
        # Gắn thêm is_mine theo từng connection
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
        """
        Handler nhận typing state và gửi xuống client (bỏ qua người gửi).
        """
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
        from .models import ChatParticipant
        return ChatParticipant.objects.filter(room_id=room_id, user_id=user_id).exists()

    @database_sync_to_async
    def mark_room_as_read(self, room_id, user_id):
        from .models import ChatParticipant
        ChatParticipant.objects.filter(room_id=room_id, user_id=user_id).update(last_read_at=timezone.now())

    @database_sync_to_async
    def save_message(self, room_id, user_id, content, attachment_url, attachment_name, attachment_size):
        from .models import ChatRoom, ChatMessage, ChatParticipant
        from .serializers import ChatMessageSerializer

        room = ChatRoom.objects.filter(id=room_id).first()
        if not room:
            return None

        # Kiểm tra nếu Job đã hoàn thành/hủy thì không cho gửi tin mới
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

        return ChatMessageSerializer(msg).data
