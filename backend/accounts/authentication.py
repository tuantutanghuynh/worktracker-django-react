"""
Module: accounts.authentication
Description: Custom JWT authentication mechanisms with Redis blacklist validation, user status caching, and re-authentication gates.
"""

import time

from django.core.cache import cache, caches
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

blacklist_cache = caches["blacklist"]


class BlacklistAwareJWTAuthentication(JWTAuthentication):
    """JWT authentication handler that rejects tokens blacklisted in Redis upon logout."""

    def get_validated_token(self, raw_token):
        """Validate token signature and expiration, checking Redis blacklist for revoked token JTIs."""
        validated_token = super().get_validated_token(raw_token)

        jti = validated_token["jti"]
        if blacklist_cache.has_key(f"blacklist:{jti}"):
            raise AuthenticationFailed("Token has been revoked.")

        return validated_token


_ACTIVE_CACHE_PREFIX = "user_active:"
_ACTIVE_CACHE_TTL = 300


def get_user_active_status(user_id):
    """Fetch user active status from Redis cache, falling back to database query on cache miss."""
    cache_key = f"{_ACTIVE_CACHE_PREFIX}{user_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    from accounts.models import CustomUser
    try:
        is_active = CustomUser.objects.values_list("is_active", flat=True).get(pk=user_id)
    except CustomUser.DoesNotExist:
        return False

    cache.set(cache_key, is_active, timeout=_ACTIVE_CACHE_TTL)
    return is_active


def set_user_active_status(user_id, is_active):
    """Update user active status in Redis cache immediately upon account lock or unlock."""
    cache.set(f"{_ACTIVE_CACHE_PREFIX}{user_id}", is_active, timeout=_ACTIVE_CACHE_TTL)


def invalidate_user_active_status(user_id):
    """Evict cached active status entry to force database re-fetch on subsequent requests."""
    cache.delete(f"{_ACTIVE_CACHE_PREFIX}{user_id}")


_REAUTH_CACHE_PREFIX = "user_reauth_after:"
_REAUTH_CACHE_TTL = 7 * 24 * 60 * 60


def require_reauth(user_id):
    """Set timestamp threshold in cache requiring tokens issued before now to re-authenticate."""
    cache.set(f"{_REAUTH_CACHE_PREFIX}{user_id}", int(time.time()), timeout=_REAUTH_CACHE_TTL)


def is_reauth_required(user_id, issued_at):
    """Check whether a token was issued prior to a forced re-authentication invalidation timestamp."""
    reauth_after = cache.get(f"{_REAUTH_CACHE_PREFIX}{user_id}")
    return bool(reauth_after and issued_at < reauth_after)


class WorkTrackerJWTAuthentication(BlacklistAwareJWTAuthentication):
    """Primary authentication class validating blacklist, cached active status, and reauth timestamps."""

    def authenticate(self, request):
        """Authenticate request against blacklist, active state in cache, and forced reauth timestamp."""
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        if not get_user_active_status(user.id):
            raise AuthenticationFailed(
                "Account is locked or deactivated.", code="account_inactive"
            )

        if is_reauth_required(user.id, validated_token.get("iat", 0)):
            raise AuthenticationFailed(
                "Your permissions have changed. Please log in again.",
                code="reauth_required",
            )

        return user, validated_token