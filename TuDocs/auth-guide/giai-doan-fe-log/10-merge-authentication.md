# Log 10 — Gộp Authentication: WorkTrackerJWTAuthentication

**Ngày:** 2026-07-04
**Nhánh:** TuanTu

---

## Mục tiêu

Gộp `BlacklistAwareJWTAuthentication` (Tuấn Tú — blacklist sau logout) với
`CachedIsActiveJWTAuthentication` (Đức Long / nhánh LongNguyen — cache `is_active`)
thành một class duy nhất `WorkTrackerJWTAuthentication` dùng làm
`DEFAULT_AUTHENTICATION_CLASSES`.

---

## Những gì đã làm

### 1. Đọc code Đức Long từ nhánh LongNguyen

```bash
git show origin/LongNguyen:backend/accounts/authentication.py
```

Xác nhận Đức Long dùng `from django.core.cache import cache` nhưng settings chưa
có `CACHES` → Django fallback về `LocMemCache` (in-memory, không share giữa
processes, mất khi restart).

---

### 2. Thêm `CACHES` vào `settings.py`

**File:** `backend/worktracker_core/settings.py`

```python
# db=2: is_active cache to avoid a DB hit on every request (NFR-04). Swap backend in one line if needed.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": f"redis://{REDIS_HOST}:{REDIS_PORT}/2",
    }
}
```

Dùng Redis db=2, tách biệt với db=1 (blacklist). Dùng backend có sẵn của Django
4.0+ (`django.core.cache.backends.redis.RedisCache`), không cần cài thêm gì.

---

### 3. Cập nhật `authentication.py`

**File:** `backend/accounts/authentication.py`

Cấu trúc sau khi sửa:

```
BlacklistAwareJWTAuthentication   ← giữ nguyên, không sửa
    ↓
_ACTIVE_CACHE_PREFIX, _ACTIVE_CACHE_TTL   ← module-level constants
get_user_active_status(user_id)           ← module-level helper (cache → DB fallback)
set_user_active_status(user_id, is_active)
invalidate_user_active_status(user_id)
    ↓
WorkTrackerJWTAuthentication(BlacklistAwareJWTAuthentication)
    authenticate() → super() [blacklist check] → is_active check
```

**Lỗi đã sửa trong quá trình viết:**
- Helpers bị đặt nhầm vào trong class `BlacklistAwareJWTAuthentication` thay vì
  module level → `NameError` khi `WorkTrackerJWTAuthentication.authenticate()`
  gọi `get_user_active_status()`
- Typo `ser_user_active_status` → `set_user_active_status`

---

### 4. Đổi `DEFAULT_AUTHENTICATION_CLASSES`

**File:** `backend/worktracker_core/settings.py`

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.WorkTrackerJWTAuthentication",  # đổi từ BlacklistAware
    ),
    ...
}
```

---

### 5. Thêm comment tiếng Anh cho cả 2 file

Mỗi phần cấu hình trong `settings.py` và mỗi class trong `authentication.py`
có 1-2 dòng comment giải thích lý do tồn tại.

---

## Kết quả test

`python manage.py check` → 0 issues.

| Flow | Kết quả |
|---|---|
| Login → trả `permissions[]`, `must_change_password`, role | ✅ |
| Protected endpoint với token hợp lệ | ✅ (đi qua `WorkTrackerJWTAuthentication`) |
| `must_change_password=True` → login trả `true` | ✅ |
| Change password → `must_change_password` về `False` trong DB | ✅ |
| Forgot password → tạo `PasswordReset` record trong DB | ✅ |
| Reset password với token hợp lệ | ✅ |
| Dùng lại token đã dùng | ✅ → `"This reset link has already been used."` |
| Forgot password email không tồn tại | ✅ → cùng response (anti-enumeration) |
| Token sai | ✅ → `"Invalid Token"` |
| Gọi protected endpoint không có Bearer | ✅ → 401 |

---

## Ghi chú

- `logwork:void` không xuất hiện trong `permissions[]` của EMPLOYEE — cần kiểm
  tra lại seed migration xem permission này đã được gán cho role EMPLOYEE chưa.
- Helpers `set_user_active_status` và `invalidate_user_active_status` cần được
  gọi bởi **Minh Anh** trong `views_admin.py` khi khóa/mở tài khoản. Xem
  `merge-authentication-guide.md` Bước 4.
