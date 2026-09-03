"""
Module: worktracker_core.channels_middleware
Description: Custom Channels ASGI middleware for authenticating WebSocket connections using SimpleJWT query tokens.
"""

from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

from accounts.authentication import WorkTrackerJWTAuthentication, get_user_active_status


@database_sync_to_async
def get_user_from_token(raw_token):
    """Authenticate raw JWT bearer token against signature, expiry, blacklist, and active user status."""
    try:
        auth = WorkTrackerJWTAuthentication()
        validated_token = auth.get_validated_token(raw_token)
        user = auth.get_user(validated_token)
        if not get_user_active_status(user.id):
            return AnonymousUser()
        return user
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Extract token parameter from WebSocket connection query string and populate scope user."""

    async def __call__(self, scope, receive, send):
        """Process connection scope and authenticate user asynchronously."""
        query_string = scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]

        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()

        return await super().__call__(scope, receive, send)
