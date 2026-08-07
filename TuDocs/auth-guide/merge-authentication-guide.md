# Hướng Dẫn Gộp Authentication: BlacklistAware + CachedIsActive

## Tại sao cần gộp

| Class | Giải quyết | Bắt buộc |
|---|---|---|
| `BlacklistAwareJWTAuthentication` (Tuấn Tú) | Token bị thu hồi sau logout (security) | ✅ Có |
| `CachedIsActiveJWTAuthentication` (Đức Long) | Tránh query DB `is_active` mỗi request (performance) | 🟡 NFR |

Nếu chỉ dùng class Đức Long → **mất blacklist, logout vô nghĩa**.
Nếu chỉ dùng class Tuấn Tú → **mỗi request query DB để check `is_active`**.
Gộp đúng cách → có cả 2.

---

## Chiến lược gộp

- **Giữ nguyên** `BlacklistAwareJWTAuthentication` của Tuấn Tú — không sửa code đang chạy tốt
- **Giữ nguyên** `redis_client` (db=1) cho blacklist
- **Thêm** Django `CACHES` config dùng Redis db=2 riêng cho `is_active` cache → portable (có thể đổi backend sau)
- **Tạo class mới** `WorkTrackerJWTAuthentication` kế thừa `BlacklistAwareJWTAuthentication`, thêm `is_active` cache check
- **Cập nhật** `settings.py` dùng class mới

---

## Bước 1 — Thêm `CACHES` vào `settings.py`

Hiện tại `settings.py` chỉ có `REDIS_HOST`, `REDIS_PORT`, `REDIS_BLACKLIST_DB` (db=1)
nhưng **chưa cấu hình Django cache framework**. Đức Long dùng
`from django.core.cache import cache` nhưng cache này đang fallback về
`LocMemCache` (in-memory, mất khi restart, không share giữa processes) thay
vì Redis thật.

Thêm vào `settings.py` (sau phần REDIS settings):

```python
# Django cache framework — dùng Redis db=2 (tách biệt với blacklist db=1)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": f"redis://{REDIS_HOST}:{REDIS_PORT}/2",
    }
}
```

> Dùng `django.core.cache.backends.redis.RedisCache` (có sẵn từ Django 4.0+,
> không cần cài thêm gì) thay vì `django-redis` bên thứ 3 — portable hơn.

---

## Bước 2 — Cập nhật `accounts/authentication.py`

Thêm class mới vào cuối file, **giữ nguyên** `BlacklistAwareJWTAuthentication`:

```python
from django.core.cache import cache
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from .redis_client import redis_client

# ── Class gốc của Tuấn Tú — KHÔNG SỬA ────────────────────────────────────────
class BlacklistAwareJWTAuthentication(JWTAuthentication):
    """Rejects any token whose jti has been blacklisted in Redis (e.g. after logout)."""

    def get_validated_token(self, raw_token):
        validated_token = super().get_validated_token(raw_token)
        jti = validated_token["jti"]
        if redis_client.exists(f"blacklist:{jti}"):
            raise AuthenticationFailed("Token has been revoked.")
        return validated_token


# ── Helpers của Đức Long (dùng Django cache framework) ────────────────────────
_ACTIVE_CACHE_PREFIX = "user_active:"
_ACTIVE_CACHE_TTL = 300  # 5 phút


def get_user_active_status(user_id):
    """Đọc is_active từ Django cache (Redis db=2); fallback về DB nếu miss."""
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
    """Gọi khi Admin khóa/mở tài khoản để cache phản ánh ngay lập tức."""
    cache.set(f"{_ACTIVE_CACHE_PREFIX}{user_id}", is_active, timeout=_ACTIVE_CACHE_TTL)


def invalidate_user_active_status(user_id):
    """Xóa cache để lần check tiếp theo đọc lại từ DB."""
    cache.delete(f"{_ACTIVE_CACHE_PREFIX}{user_id}")


# ── Class gộp — dùng làm DEFAULT_AUTHENTICATION_CLASSES ──────────────────────
class WorkTrackerJWTAuthentication(BlacklistAwareJWTAuthentication):
    """
    Lớp 1 (từ BlacklistAwareJWTAuthentication): reject token đã bị blacklist.
    Lớp 2 (thêm mới): reject request nếu is_active=False, check qua Redis cache
    để tránh query DB mỗi request (NFR-04).
    """

    def authenticate(self, request):
        result = super().authenticate(request)  # chạy blacklist check trước
        if result is None:
            return None

        user, validated_token = result
        if not get_user_active_status(user.id):
            raise AuthenticationFailed(
                "Account is locked or deactivated.", code="account_inactive"
            )
        return user, validated_token
```

---

## Bước 3 — Cập nhật `settings.py`

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.WorkTrackerJWTAuthentication",  # ← đổi tên class
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}
```

---

## Bước 4 — Gọi `set_user_active_status` khi Admin khóa/mở tài khoản

Minh Anh cần import và gọi helper này trong `views_admin.py` khi thay đổi
`is_active` của user, để cache phản ánh ngay thay vì chờ 5 phút TTL:

```python
# accounts/views_admin.py (Minh Anh viết)
from accounts.authentication import set_user_active_status

class DisableUserView(APIView):
    def post(self, request, user_id):
        user = CustomUser.objects.get(pk=user_id)
        user.is_active = False
        user.save()
        set_user_active_status(user_id, False)  # ← cập nhật cache ngay
        return Response({"detail": "User disabled."})
```

---

## Tóm tắt luồng xử lý sau khi gộp

```text
Request đến với JWT token
    ↓
[BlacklistAwareJWTAuthentication.get_validated_token()]
    → Kiểm tra jti trong Redis blacklist (db=1)
    → Nếu có: 401 "Token has been revoked"
    ↓ (token hợp lệ, không bị blacklist)
[WorkTrackerJWTAuthentication.authenticate()]
    → super().authenticate() hoàn tất: load user từ DB
    → Kiểm tra is_active trong Django cache Redis (db=2)
    → Cache miss: query DB, lưu cache 5 phút
    → is_active = False: 401 "Account is locked or deactivated"
    ↓ (user active)
Request đi tiếp vào Permission check → View
```

---

## Phân công ai làm gì

| Việc | Ai làm |
|---|---|
| Thêm `CACHES` vào `settings.py` | Tuấn Tú (owner của settings auth) |
| Thêm class `WorkTrackerJWTAuthentication` + helpers vào `authentication.py` | Tuấn Tú |
| Đổi `DEFAULT_AUTHENTICATION_CLASSES` trong `settings.py` | Tuấn Tú |
| Gọi `set_user_active_status` trong `DisableUserView` | Minh Anh |
| Xóa `CachedIsActiveJWTAuthentication` trong file của mình (đã được gộp rồi) | Đức Long |

---

## Vì sao cách này là portable nhất

- **Django cache framework** (`from django.core.cache import cache`) — hoán đổi
  backend bằng 1 dòng trong `settings.py` (Redis → Memcached → LocMem khi test).
  Không phụ thuộc thư viện bên thứ 3.
- **Redis db=1 và db=2 tách biệt** — blacklist và `is_active` cache không ảnh
  hưởng lẫn nhau, dễ flush riêng khi cần debug.
- **Không sửa class gốc** — `BlacklistAwareJWTAuthentication` giữ nguyên,
  `WorkTrackerJWTAuthentication` kế thừa và mở rộng. Nếu sau này cần bỏ
  tính năng nào, chỉ cần tháo ra khỏi class gộp, không đụng tới security core.
