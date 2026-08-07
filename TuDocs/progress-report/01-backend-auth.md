# 01 — Backend Auth: Chi tiết 5 Giai đoạn

---

## Giai đoạn 1 — JWT Login & Refresh

### Mục tiêu
User gửi email + password → nhận được access token (15 phút) và refresh token (7 ngày).

### File liên quan
- `accounts/serializers_auth.py:22` — `LoginSerializer`
- `accounts/views_auth.py:24` — `LoginView`
- `accounts/urls_auth.py:9` — route `/api/auth/login/`
- `worktracker_core/settings.py:172-178` — cấu hình `SIMPLE_JWT`; `settings.py:160-162` — `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES`

### Thiết kế quan trọng

**1. Không dùng `TokenObtainPairSerializer` của SimpleJWT mặc định.**

SimpleJWT có sẵn class `TokenObtainPairSerializer`, nhưng không dùng vì nó gộp chung 2 lỗi:
- Email không tồn tại → trả 401
- Tài khoản bị khóa → trả 401

Chúng ta cần phân biệt rõ 2 lỗi này vì hậu quả khác nhau trên UI (sai password vs bị admin khóa).

**2. Anti User-Enumeration — cùng 1 message cho 2 trường hợp:**
```python
# Hai điều kiện này trả cùng 1 message "Invalid email or password."
if user is None or not user.check_password(password):
    raise AuthenticationFailed("Invalid email or password.")
```
Lý do: nếu "email không tồn tại" trả message khác với "sai password", kẻ tấn công
có thể dùng brute force để liệt kê email nào tồn tại trong hệ thống.

**3. Custom claims phải set TRƯỚC khi đọc `access_token`:**
```python
refresh = RefreshToken.for_user(self.user)
refresh["email"] = self.user.email     # phải set ở đây
refresh["role"] = self.user.role.code  # trước khi gọi dòng dưới
access = refresh.access_token           # access chỉ copy claim đã có sẵn trên refresh
```

**4. Login response trả thêm `user` payload và `permissions`:**
```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": {
    "id": 1,
    "email": "admin@worktracker.com",
    "role": "ADMIN",
    "must_change_password": false,
    "permissions": ["user:disable", "client:create", "job:create", ...]
  }
}
```
Frontend Zustand store lưu cả `permissions` để check quyền ngay trên UI mà
không cần decode JWT hoặc gọi thêm API.

---

## Giai đoạn 2 — Logout & Redis Blacklist

### Mục tiêu
Khi user logout, access token cũ phải bị vô hiệu hóa **ngay lập tức** (không chờ hết hạn 15 phút).

### Tại sao JWT mặc định không an toàn khi logout?
JWT là stateless — server không lưu gì. Một khi đã ký ra, token hợp lệ đến khi hết hạn.
Nếu user logout mà token chưa hết 15 phút, kẻ xấu vẫn dùng token đó được.

### Giải pháp: Redis Blacklist theo `jti`
Mỗi JWT có 1 claim `jti` (JWT ID) — chuỗi ngẫu nhiên duy nhất.

Khi logout:
1. Đọc `jti` từ token hiện tại
2. Tính TTL còn lại (exp - now)
3. Lưu key `blacklist:{jti}` vào Redis với TTL đúng bằng TTL còn lại

Mỗi request sau đó, `BlacklistAwareJWTAuthentication` check Redis:
```python
if redis_client.exists(f"blacklist:{jti}"):
    raise AuthenticationFailed("Token has been revoked.")
```

### Tại sao không dùng blacklist của SimpleJWT (DB)?
SimpleJWT có sẵn `rest_framework_simplejwt.token_blacklist` lưu vào PostgreSQL.
Chúng ta dùng Redis vì:
- **Tốc độ:** Redis in-memory nhanh hơn DB ~100x, mỗi request đều check
- **TTL tự động:** Redis tự xóa key hết hạn, không cần cron job dọn dẹp
- **NFR-04:** yêu cầu hệ thống không gọi DB trên mỗi request auth

### File liên quan
- `accounts/redis_client.py:7` — singleton Redis connection
- `accounts/authentication.py:12` — `BlacklistAwareJWTAuthentication`; `authentication.py:58` — `WorkTrackerJWTAuthentication`
- `accounts/views_auth.py:37` — `LogoutView`

---

## Giai đoạn 3 — RBAC (HasPermission) + Seed dữ liệu

### Mục tiêu
Mỗi API endpoint có thể khai báo `required_permission = "code"`.
`HasPermission` tự động check role của user có quyền đó không.

### Cấu trúc bảng
```
roles           → Role(code="ADMIN", name="Quản trị viên")
permissions     → Permission(code="client:create", name="Tạo khách hàng")
role_permissions → RolePermission(role=ADMIN, permission=client:create)
```

> **Source:** `accounts/permissions.py:12` — class `HasPermission`.

### Cách dùng `HasPermission` trong View
```python
class SomeView(APIView):
    permission_classes = [HasPermission]
    required_permission = "client:create"   # khai báo 1 dòng

    def post(self, request):
        # vào được đây = đã xác thực + đúng role
        ...
```

### Tại sao không dùng `IsAdminUser` của Django?
Django có sẵn `is_staff`, `is_superuser`, nhưng:
- Không đủ granular: không phân được "ADMIN được tạo client" vs "MANAGER được tạo task"
- Không mở rộng được: về sau muốn thêm quyền mới phải sửa code, thay vì chỉ seed DB

RBAC (Role-Based Access Control) cho phép thêm quyền mới chỉ bằng cách thêm row vào DB.

### must_change_password gate
`HasPermission` còn kiểm tra thêm 1 điều kiện:
```python
if request.user.must_change_password:
    raise PermissionDenied("You must change your password before performing this action.")
```
Nghĩa là **mọi API dùng `HasPermission`** đều tự động bị chặn nếu user chưa đổi mật khẩu lần đầu.
`ChangePasswordView` dùng `IsAuthenticated` thay vì `HasPermission` để không bị chặn bởi chính gate này.

> **Source:** gate `must_change_password` — `accounts/permissions.py:30`.

### Seed dữ liệu (migrations 0002, 0003)
3 roles đã được seed: ADMIN, MANAGER, EMPLOYEE.
Danh sách quyền đã seed đầy đủ cho từng role — xem `accounts/migrations/0002_seed_roles_permissions.py`.

---

## Giai đoạn 4 — Forgot / Reset Password

> **Source:** `accounts/views_auth.py:59` — `ForgotPasswordView`; `views_auth.py:82` — `ResetPasswordView`.

### Luồng
```
1. User gõ email → POST /api/auth/forgot-password/
2. Server tạo token 32 bytes (secrets.token_urlsafe), lưu vào bảng password_resets
   với expires_at = now() + 15 phút
3. Server gửi email chứa token (dev: in ra console, prod: SMTP)
4. User click link → FE gửi token + new_password → POST /api/auth/reset-password/
5. Server check: token tồn tại? chưa dùng? chưa hết hạn? → đổi password, đánh dấu is_used=True
```

### Thiết kế bảo mật
- Token 32 bytes ngẫu nhiên → không đoán được
- One-time: `is_used = True` sau khi dùng
- Time-limited: 15 phút
- **Anti user-enumeration:** `ForgotPasswordView` luôn trả 200 dù email có tồn tại hay không

```python
# Luôn trả 200 — không để lộ email nào tồn tại
return Response(
    {"detail": "If that email exists, a reset link has been sent."},
    status=status.HTTP_200_OK,
)
```

---

## Giai đoạn 5 — Account Lifecycle (must_change_password)

### Mục tiêu
Khi Admin tạo tài khoản mới hoặc reset password cho ai đó, user đó phải đổi password ngay lần đăng nhập đầu tiên trước khi làm bất kỳ việc gì khác.

### Cơ chế
Field `must_change_password = True` (default) trên `CustomUser` — thêm bởi migration
`accounts/migrations/0004_customuser_must_change_password.py`.

Khi đăng nhập: Login response trả `"must_change_password": true` trong `user` payload.
Frontend đọc field này và redirect ngay sang `/change-password`.

**Backend cũng chặn (defense in depth):** `HasPermission` kiểm tra field này và trả 403
nếu `True`, ngay cả khi Frontend bị bypass. Đây là nguyên tắc không bao giờ tin Frontend.

### ChangePasswordView

> **Source:** `accounts/views_auth.py:95` — class `ChangePasswordView`.

```python
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]  # NOT HasPermission — tránh vòng lặp chặn nhau

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()   # đổi password + set must_change_password = False
        return Response({"detail": "Password changed successfully"})
```

Sau khi đổi xong, `must_change_password = False`, user truy cập được mọi API bình thường.

---

## Lớp bảo vệ is_active (NFR-04)

Ngoài 5 giai đoạn trên, còn 1 cơ chế quan trọng nữa:

**Khi Admin khóa tài khoản (is_active = False), hiệu lực phải có ngay lập tức.**
Không thể chờ token hết hạn vì token còn sống 15 phút.

Giải pháp: `WorkTrackerJWTAuthentication` check `is_active` qua **Redis cache**
(`accounts/authentication.py:58`, dùng `set_user_active_status`/`invalidate_user_active_status`
định nghĩa ở L47/L52):
```
Mỗi request:
  1. Check Redis key "user_active:{id}"
     - Có → dùng giá trị cached (không đụng DB)
     - Không có → đọc DB → cache vào Redis 5 phút
  2. Nếu is_active = False → 401 ngay
```

Khi Admin khóa user: gọi `set_user_active_status(user_id, False)` → cache cập nhật ngay,
request tiếp theo của user đó sẽ bị chặn trong vòng <1 giây.

```python
# accounts/views_admin.py:17 — AdminDisableUserView
target_user.is_active = False
target_user.save()
set_user_active_status(target_user.id, False)   # cập nhật cache ngay
```
