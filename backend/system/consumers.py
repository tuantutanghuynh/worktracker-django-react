"""
WebSocket Consumer cho Notification.

Kiến trúc:
- Mỗi user kết nối vào ws/notifications/ sẽ tham gia group "user_{user_id}".
- Khi có Notification mới, notification_manager_service sẽ gọi group_send()
  để push payload JSON tới tất cả client trong group đó.
- Consumer này chỉ NHẬN và FORWARD message, không tự tạo Notification.

Bảo mật:
- Chỉ cho phép user đã authenticated kết nối.
- User chỉ tham gia group của chính mình (user_id khớp).
- Anonymous user bị ngắt kết nối ngay lập tức.
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer xử lý WebSocket Notification.

    Flow kết nối:
        Client connect ws/notifications/
            -> connect() được gọi
            -> Kiểm tra authentication
            -> Tham gia group "user_{user_id}"
            -> Trả về {"type": "connected"}

    Flow push notification:
        notification_manager_service.push_realtime_best_effort()
            -> channel_layer.group_send("user_{user_id}", {...})
            -> notification_message() được gọi
            -> Gửi JSON xuống client

    Flow ngắt kết nối:
        Client disconnect
            -> disconnect() được gọi
            -> Rời khỏi group
    """

    async def connect(self):
        """
        Xử lý kết nối WebSocket mới.
        Chỉ cho phép user đã đăng nhập (authenticated).
        """
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            # Từ chối kết nối từ Anonymous user
            await self.close(code=4001)
            logger.warning("[WS] Anonymous user cố kết nối WebSocket. Từ chối.")
            return

        self.user_id = user.id
        self.group_name = f"user_{self.user_id}"

        # Tham gia group cá nhân
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        # Gửi message xác nhận kết nối thành công
        await self.send(
            text_data=json.dumps(
                {
                    "type": "connected",
                    "message": f"Kết nối thành công. Đang lắng nghe thông báo cho user {self.user_id}.",
                }
            )
        )

        logger.info(f"[WS] User {self.user_id} kết nối WebSocket thành công.")

    async def disconnect(self, close_code):
        """
        Xử lý ngắt kết nối.
        Rời khỏi group để không nhận message thừa.
        """
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

        logger.info(
            f"[WS] User {getattr(self, 'user_id', '?')} ngắt kết nối. Code: {close_code}"
        )

    async def receive(self, text_data=None, bytes_data=None):
        """
        Consumer này KHÔNG xử lý message từ client (chỉ nhận từ server).
        Mọi message gửi lên từ client sẽ bị bỏ qua.
        """
        pass

    async def notification_message(self, event):
        """
        Handler được gọi bởi channel_layer.group_send() với type="notification.message".
        Forward payload xuống WebSocket client.

        event format:
            {
                "type": "notification.message",
                "payload": {
                    "id": 123,
                    "event_type": "TASK_APPROVED",
                    "title": "Task đã được duyệt",
                    "content": "...",
                    "related_url": "/manager/tasks/42",
                    "created_at": "2026-07-21T10:00:00Z",
                }
            }
        """
        payload = event.get("payload", {})

        await self.send(
            text_data=json.dumps(
                {
                    "type": "notification",
                    "data": payload,
                }
            )
        )
