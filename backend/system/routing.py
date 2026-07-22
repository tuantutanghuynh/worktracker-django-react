"""
WebSocket URL routing cho Django Channels.

Kiến trúc:
- ws/notifications/ : Channel cá nhân của từng user (push notifications).
- Client kết nối: ws://localhost:8000/ws/notifications/
- Sau khi kết nối, server group user vào group "user_{user_id}".
- Khi có Notification mới, server push tới group đó.
"""

from django.urls import re_path

from system import consumers

websocket_urlpatterns = [
    re_path(r"^ws/notifications/$", consumers.NotificationConsumer.as_asgi()),
]
