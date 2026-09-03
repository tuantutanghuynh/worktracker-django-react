"""
Module: chat.urls
Description: URL routing configuration for chat room endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet

router = DefaultRouter()
router.register(r"rooms", ChatRoomViewSet, basename="chat-rooms")

urlpatterns = [
    path("", include(router.urls)),
]
