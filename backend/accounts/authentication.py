# accounts/authentication.py
from django.core.cache import cache
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

ACTIVE_STATUS_CACHE_PREFIX = "user_active:"
ACTIVE_STATUS_CACHE_TTL = 300  # 5 phút


def get_user_active_status(user_id):
    """NFR-04: đọc is_active từ Redis cache; fallback về DB nếu cache miss."""
    cache_key = f"{ACTIVE_STATUS_CACHE_PREFIX}{user_id}"
    cached_value = cache.get(cache_key)
    if cached_value is not None:
        return cached_value

    from accounts.models import CustomUser
    try:
        is_active = CustomUser.objects.values_list("is_active", flat=True).get(pk=user_id)
    except CustomUser.DoesNotExist:
        return False

    cache.set(cache_key, is_active, timeout=ACTIVE_STATUS_CACHE_TTL)
    return is_active


def set_user_active_status(user_id, is_active):
    cache_key = f"{ACTIVE_STATUS_CACHE_PREFIX}{user_id}"
    cache.set(cache_key, is_active, timeout=ACTIVE_STATUS_CACHE_TTL)


def invalidate_user_active_status(user_id):
    cache_key = f"{ACTIVE_STATUS_CACHE_PREFIX}{user_id}"
    cache.delete(cache_key)


class CachedIsActiveJWTAuthentication(JWTAuthentication):
    """
    NFR-01, NFR-04: sau khi JWT signature/expiry hợp lệ, vẫn bắt buộc
    check is_active qua Redis cache trên MỌI request, để account lock
    có hiệu lực ngay lập tức thay vì chỉ tới lúc token hết hạn/refresh.
    """
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