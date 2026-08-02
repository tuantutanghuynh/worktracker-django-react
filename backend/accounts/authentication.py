from django.core.cache import cache
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

# This file makes JWT validation aware of logout: a token is normally trusted
# until it expires, but LogoutView blacklists its jti in Redis so it can be
# rejected immediately instead of staying valid for its full lifetime.


# Rejects any token whose jti has been blacklisted in Redis after logout.
class BlacklistAwareJWTAuthentication(JWTAuthentication):

    # Validates the token signature/expiry via super(), then rejects it if its jti is blacklisted.
    def get_validated_token(self, raw_token):
        validated_token = super().get_validated_token(raw_token)

        jti = validated_token["jti"]
        if cache.get(f"blacklist:{jti}"):
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


# Extends BlacklistAwareJWTAuthentication with an is_active check via Redis cache (NFR-04).
# This is the class used in DEFAULT_AUTHENTICATION_CLASSES.
class WorkTrackerJWTAuthentication(BlacklistAwareJWTAuthentication):

    # Runs blacklist check via super(), then verifies the user is still active before allowing the request.
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        if not get_user_active_status(user.id):
            raise AuthenticationFailed(
                "Account is locked or deactivated.", code="account_inactive"
            )
        return user, validated_token