"""
Custom Channels ASGI middleware: authenticates WebSocket connections via
the same JWT scheme the HTTP API uses (SimpleJWT bearer tokens).

Why this exists: Django Channels' built-in AuthMiddlewareStack only
authenticates via Django session cookies — but this SPA never establishes
a session (it's pure JWT, Authorization: Bearer <token> on every HTTP
request). Without this middleware, scope["user"] is always AnonymousUser
for every WebSocket connection, and NotificationConsumer.connect()
rejects it (code=4001) — realtime notifications never actually work,
regardless of what token the frontend sends in the URL.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

from accounts.authentication import WorkTrackerJWTAuthentication, get_user_active_status


@database_sync_to_async
def get_user_from_token(raw_token):
    """
    Runs the exact same validation the HTTP API uses — signature/expiry,
    Redis blacklist after logout, account active status — instead of a
    simplified reimplementation. A logged-out or locked account can't
    keep a live WebSocket connection open just because its old token
    hasn't expired yet.
    """
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
    """
    Reads ?token=<jwt> from the WebSocket URL's query string (the SPA
    sends its access token there — there's no session cookie to read
    instead) and populates scope["user"], the same field
    AuthMiddlewareStack would normally fill from a session.
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]

        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()

        return await super().__call__(scope, receive, send)
