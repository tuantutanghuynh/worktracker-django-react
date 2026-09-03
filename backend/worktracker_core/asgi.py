"""
Module: worktracker_core.asgi
Description: ASGI configuration supporting both HTTP Django requests and WebSocket Channels with JWT authentication.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worktracker_core.settings")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

import system.routing
import chat.routing
from worktracker_core.channels_middleware import JWTAuthMiddleware

combined_websocket_urlpatterns = system.routing.websocket_urlpatterns + chat.routing.websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddleware(
                URLRouter(combined_websocket_urlpatterns)
            )
        ),
    }
)
