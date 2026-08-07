# 02 — Kiến trúc: JWT, Redis, RBAC

> File này giải thích **tại sao** các thứ được xây dựng như vậy.
> Đọc file này trước khi đụng vào `authentication.py`, `permissions.py`, `redis_client.py`.

---

## Phần 1: JWT (JSON Web Token)

### JWT là gì?
JWT là chuỗi 3 phần ngăn cách bằng dấu chấm:
```
header.payload.signature
```
- **header:** loại token + thuật toán ký (HS256)
- **payload:** các claim (user_id, exp, jti, role, email...)
- **signature:** HMAC(header + payload, SECRET_KEY) — chữ ký chống giả mạo

### Tại sao dùng JWT thay vì Session?
Session: Server lưu session trong DB/Redis → mỗi request phải tra DB.
JWT: Server **không lưu gì** → verify bằng cách ký lại và so signature → nhanh hơn.

### Django SECRET_KEY và JWT
SimpleJWT dùng Django `SECRET_KEY` để ký JWT bằng HMAC-SHA256.

**CRITICAL:** Nếu SECRET_KEY lộ → kẻ tấn công có thể tự tạo JWT với `role = "ADMIN"` và
`exp` xa trong tương lai → bypass toàn bộ authentication → chiếm quyền admin.

SECRET_KEY **PHẢI** lưu trong `.env`, không bao giờ commit lên git.

> **Source:** `worktracker_core/settings.py:172-177` — `SIMPLE_JWT` (lifetime + `ROTATE_REFRESH_TOKENS`).

### Access Token vs Refresh Token

| | Access Token | Refresh Token |
|--|---|---|
| Thời hạn | 15 phút | 7 ngày |
| Dùng để | Gọi API (Bearer header) | Lấy Access mới khi hết hạn |
| Rủi ro nếu lộ | Bị dùng tối đa 15 phút | Bị dùng 7 ngày |
| Lưu ở đâu | Zustand store (RAM) | Zustand store (RAM) |

> **Source:** `frontend/src/stores/authStore.js:12-15` — `accessToken`/`refreshToken` khai báo trong Zustand store, không có localStorage.

### Tại sao lưu token trong RAM (Zustand), không dùng localStorage?
- **localStorage** dễ bị đánh cắp bởi XSS (cross-site scripting)
- **RAM (Zustand)** xóa khi user đóng tab/refresh — ngắn hơn, an toàn hơn

Đánh đổi: user phải login lại khi refresh trang. Chấp nhận được vì đây là app nội bộ công ty.

### Rotate Refresh Token
`ROTATE_REFRESH_TOKENS = True`: mỗi lần dùng refresh token để lấy access mới,
refresh token cũ bị hủy và một cái mới được cấp. Chặn tái sử dụng refresh token bị đánh cắp.

---

## Phần 2: Redis và cách dùng trong dự án

### Redis là gì?
Database key-value in-memory (lưu trong RAM). Đọc/ghi cực nhanh (~100,000 ops/giây).
Hỗ trợ TTL (Time To Live) — key tự xóa sau N giây.

### Dùng Redis cho 3 việc trong dự án

**Việc 1: JWT Blacklist (db=1)**
```
Key:    "blacklist:{jti}"
Value:  "1"
TTL:    = số giây còn lại của token
```
Lưu trong `redis_client.py` dùng connection thẳng (`redis.Redis`), không qua Django cache.
Lý do: cần control TTL chính xác đến giây.

> **Source:** `accounts/redis_client.py:7` — khởi tạo `redis.Redis(..., db=settings.REDIS_BLACKLIST_DB)`;
> `REDIS_BLACKLIST_DB` khai báo ở `settings.py:187`. Check blacklist khi request:
> `accounts/authentication.py:12-19` (`BlacklistAwareJWTAuthentication`).

**Việc 2: is_active cache (db=2)**
```
Key:    "user_active:{user_id}"
Value:  True / False
TTL:    300 giây (5 phút)
```
Lưu qua Django `cache` framework (`django.core.cache.backends.redis.RedisCache`).
Lý do: dùng Django cache API cho đơn giản — không cần control TTL thủ công.

> **Source:** `worktracker_core/settings.py:190-195` — `CACHES["default"]` trỏ db=2;
> `set_user_active_status`/`invalidate_user_active_status` — `accounts/authentication.py:47`/`L52`.

**Việc 3: Celery broker (db=3 — chưa implement)**
Celery task queue dùng Redis làm message broker.
Tuần 2–3 sẽ implement.

### Tại sao tách 2 connection?
- `redis_client.py` (db=1): dùng thư viện `redis` trực tiếp, phù hợp với TTL tùy chỉnh.
- Django CACHES (db=2): dùng Django cache framework, phù hợp với cache đơn giản.
- Tách db index để 2 loại data không lẫn vào nhau.

### Xem Redis data (debug)
```bash
# Kết nối Redis CLI
redis-cli

# Xem key blacklist
KEYS blacklist:*
TTL blacklist:<jti>

# Xem cache is_active
SELECT 2
KEYS user_active:*
GET user_active:1
```

---

## Phần 3: RBAC (Role-Based Access Control)

### Vấn đề cần giải quyết
Hệ thống có 3 role (ADMIN, MANAGER, EMPLOYEE). Mỗi role được làm những việc khác nhau.
Cần 1 cơ chế để mỗi API tự bảo vệ chính nó mà không phải tự viết logic kiểm tra role.

### Giải pháp: Permission Code + HasPermission

**Bước 1:** Mỗi hành động được đặt 1 mã định danh duy nhất:
```
"client:create"     → Tạo khách hàng
"job:update"        → Cập nhật dự án
"user:disable"      → Khóa tài khoản
"employee:view_team"→ Xem danh sách nhân viên trong team
```

**Bước 2:** Seed mapping Role → Permission vào DB:
```
ADMIN  → [user:disable, client:create, job:create, job:update, ...]
MANAGER→ [employee:view_team, manager:review_logwork, ...]
EMPLOYEE→ [logwork:void, ...]
```

**Bước 3:** View khai báo `required_permission`:
```python
class AdminDisableUserView(APIView):
    permission_classes = [HasPermission]
    required_permission = "user:disable"
```

> **Source:** `accounts/permissions.py:12` — toàn bộ class `HasPermission`.

**Bước 4:** `HasPermission.has_permission()` tự check:
```python
return RolePermission.objects.filter(
    role=request.user.role,
    permission__code=required_code
).exists()
```

### Lợi ích
- **Thêm quyền mới:** chỉ cần 1 migration seed thêm row vào DB, không sửa code
- **Revoke quyền:** xóa row trong DB
- **Đồng nhất:** mọi view dùng cùng 1 class, không mỗi view tự kiểm tra riêng

### AssertionError — bảo vệ lập trình viên
Nếu ai đó viết `permission_classes = [HasPermission]` mà quên khai báo `required_permission`:
> **Source:** `accounts/permissions.py:15-19`.

```python
if required_code is None:
    raise AssertionError(
        f"{view.__class__.__name__} is missing a 'required_permission' attribute."
    )
```
Server crash ngay khi call → lỗi được phát hiện sớm trong dev, không âm thầm cấp quyền nhầm.

---

## Phần 4: Lớp Authentication 2 tầng

### Tại sao cần 2 tầng?

**Tầng 1 (BlacklistAwareJWTAuthentication):** Xử lý vấn đề Logout
```
JWT hợp lệ về mặt chữ ký ≠ JWT đang được dùng hợp lệ
Vì user có thể đã logout rồi → jti đã vào blacklist
```

**Tầng 2 (WorkTrackerJWTAuthentication):** Xử lý vấn đề Account Lock
```
User có JWT hợp lệ, chưa logout ≠ User vẫn còn quyền truy cập
Vì Admin có thể đã khóa tài khoản → is_active = False
```

### Kế thừa (Inheritance chain)
```python
JWTAuthentication              # SimpleJWT — xác thực chữ ký, check exp
    └── BlacklistAwareJWTAuthentication    # thêm: check jti blacklist Redis
            └── WorkTrackerJWTAuthentication    # thêm: check is_active cache
```
> **Source:** `accounts/authentication.py:12` (`BlacklistAwareJWTAuthentication`), `L58` (`WorkTrackerJWTAuthentication`).

Mỗi tầng chỉ thêm 1 việc, không thay thế tầng trước.
`super()` đảm bảo tất cả tầng đều chạy đủ.

### Đăng ký trong settings.py
```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.WorkTrackerJWTAuthentication",
    ),
    ...
}
```
Tất cả API trong dự án tự động dùng class này, không cần khai báo trong từng view.

> **Source:** `worktracker_core/settings.py:160-162`.
