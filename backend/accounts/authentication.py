import time

from django.core.cache import cache, caches
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

blacklist_cache = caches["blacklist"]

# This file makes JWT validation aware of logout: a token is normally trusted
# until it expires, but LogoutView blacklists its jti in Redis so it can be
# rejected immediately instead of staying valid for its full lifetime.


# Rejects any token whose jti has been blacklisted in Redis after logout.
class BlacklistAwareJWTAuthentication(JWTAuthentication):

    # Validates the token signature/expiry via super(), then rejects it if its jti is blacklisted.
    def get_validated_token(self, raw_token):
        validated_token = super().get_validated_token(raw_token)

        jti = validated_token["jti"]
        if blacklist_cache.has_key(f"blacklist:{jti}"):
            raise AuthenticationFailed("Token has been revoked.")

        return validated_token


_ACTIVE_CACHE_PREFIX = "user_active:"
_ACTIVE_CACHE_TTL = 300


# Returns is_active from Redis cache; falls back to a DB query on cache miss.
def get_user_active_status(user_id):
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


# Updates the cache immediately when an admin locks or unlocks an account.
def set_user_active_status(user_id, is_active):
    cache.set(f"{_ACTIVE_CACHE_PREFIX}{user_id}", is_active, timeout=_ACTIVE_CACHE_TTL)


# Removes the cache entry so the next request reads the value fresh from the DB.
def invalidate_user_active_status(user_id):
    cache.delete(f"{_ACTIVE_CACHE_PREFIX}{user_id}")


_REAUTH_CACHE_PREFIX = "user_reauth_after:"
# Must outlive REFRESH_TOKEN_LIFETIME (7 days, see SIMPLE_JWT in settings.py) —
# a shorter TTL would let this cache entry expire while an old token, issued
# before the permission change, is still otherwise valid.
_REAUTH_CACHE_TTL = 7 * 24 * 60 * 60


# Marks "any token issued before now must re-authenticate" for this user.
# Used for role changes: unlike lock/unlock (is_active=False rejects
# everything), this only invalidates tokens issued before the change —
# a token minted *after* the new role is set (i.e. after a fresh login)
# stays valid.
def require_reauth(user_id):
    cache.set(f"{_REAUTH_CACHE_PREFIX}{user_id}", int(time.time()), timeout=_REAUTH_CACHE_TTL)


# Shared by WorkTrackerJWTAuthentication (access tokens) and
# ReauthAwareTokenRefreshView (refresh tokens, see accounts/auth/views_auth.py)
# — a stale refresh token must be rejected too, otherwise it would just mint
# a fresh access token and silently defeat require_reauth().
def is_reauth_required(user_id, issued_at):
    reauth_after = cache.get(f"{_REAUTH_CACHE_PREFIX}{user_id}")
    return bool(reauth_after and issued_at < reauth_after)


# Extends BlacklistAwareJWTAuthentication with an is_active check via Redis cache (NFR-04).
# This is the class used in DEFAULT_AUTHENTICATION_CLASSES.
class WorkTrackerJWTAuthentication(BlacklistAwareJWTAuthentication):

    # Runs blacklist check via super(), then verifies the user is still
    # active and that this specific token predates any forced-reauth event
    # (e.g. a role change) before allowing the request.
    def authenticate(self, request):
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