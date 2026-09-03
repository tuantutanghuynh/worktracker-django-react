"""
Module: system.routing
Description: Django Channels WebSocket URL routing configuration for user notifications.
"""

from django.urls import re_path
from system import consumers

websocket_urlpatterns = [
    re_path(r"^ws/notifications/$", consumers.NotificationConsumer.as_asgi()),
]
