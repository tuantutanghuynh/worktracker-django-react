"""
ASGI config for worktracker_core project.
Hỗ trợ cả HTTP (Django) và WebSocket (Django Channels).
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worktracker_core.settings")

# Khởi tạo Django HTTP application trước
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

import system.routing

application = ProtocolTypeRouter(
    {
        # HTTP request đi vào Django như bình thường
        "http": django_asgi_app,

        # WebSocket request đi vào Channels
        # AllowedHostsOriginValidator: chặn WebSocket từ origin không hợp lệ
        # AuthMiddlewareStack: tự động load session/user từ cookie
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(
                URLRouter(system.routing.websocket_urlpatterns)
            )
        ),
    }
)
