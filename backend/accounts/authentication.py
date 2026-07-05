from django.core.cache import cache                                    # đọc/ghi cache (đang dùng LocMemCache)
from rest_framework_simplejwt.authentication import JWTAuthentication  # class xác thực JWT gốc của simplejwt
from rest_framework.exceptions import AuthenticationFailed             # exception trả về lỗi 401

# tiền tố cho cache key — ví dụ user id=5 thì key = "user_active:5"
ACTIVE_STATUS_CACHE_PREFIX = "user_active:"
ACTIVE_STATUS_CACHE_TTL = 300  # cache tồn tại 300 giây (5 phút) rồi tự xóa


# đọc trạng thái is_active của user — ưu tiên lấy từ cache, nếu không có thì mới query DB
def get_user_active_status(user_id):
    cache_key = f"{ACTIVE_STATUS_CACHE_PREFIX}{user_id}"               # tạo key theo user_id
    cached_value = cache.get(cache_key)                                # thử đọc từ cache
    if cached_value is not None:
        return cached_value                                            # có trong cache → trả về luôn, không cần vào DB

    from accounts.models import CustomUser                             # import ở đây để tránh circular import
    try:
        is_active = CustomUser.objects.values_list(                    # chỉ lấy đúng cột is_active, không load toàn bộ object
            "is_active", flat=True
        ).get(pk=user_id)
    except CustomUser.DoesNotExist:
        return False                                                   # user không tồn tại → coi như không active

    cache.set(cache_key, is_active, timeout=ACTIVE_STATUS_CACHE_TTL)  # lưu vào cache để lần sau khỏi query DB
    return is_active


# cập nhật cache khi admin đổi trạng thái user (lock/unlock) — gọi hàm này sau khi lưu DB
def set_user_active_status(user_id, is_active):
    cache_key = f"{ACTIVE_STATUS_CACHE_PREFIX}{user_id}"
    cache.set(cache_key, is_active, timeout=ACTIVE_STATUS_CACHE_TTL)  # ghi đè giá trị cũ trong cache


# xóa cache của user — buộc lần gọi tiếp theo phải đọc lại từ DB
def invalidate_user_active_status(user_id):
    cache_key = f"{ACTIVE_STATUS_CACHE_PREFIX}{user_id}"
    cache.delete(cache_key)                                            # xóa key khỏi cache


# class xác thực JWT tùy chỉnh — thêm bước kiểm tra is_active sau khi token hợp lệ
# vấn đề: JWT gốc chỉ kiểm tra token đúng chữ ký và chưa hết hạn
# nhưng nếu admin khóa tài khoản, token cũ vẫn dùng được cho đến khi hết hạn
# giải pháp: sau khi xác thực token xong, kiểm tra thêm is_active từ cache
# → admin khóa user → cache cập nhật → API từ chối ngay, không cần đợi token hết hạn
class CachedIsActiveJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)      # bước 1: kiểm tra JWT (chữ ký + hạn dùng) theo chuẩn simplejwt
        if result is None:
            return None                             # request không có token → bỏ qua, để Django xử lý tiếp

        user, validated_token = result              # unpack: lấy user object và token đã xác thực
        if not get_user_active_status(user.id):     # bước 2: kiểm tra user có bị khóa không (qua cache)
            raise AuthenticationFailed(
                "Account is locked or deactivated.", code="account_inactive"  # trả về lỗi 401
            )
        return user, validated_token                # xác thực thành công → trả về để Django gắn vào request.user
