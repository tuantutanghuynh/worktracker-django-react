# 07 — API Reference: Format Request/Response

> Tài liệu chi tiết cho từng API đã production-ready.
> Dùng để test và để Minh Anh/Đức Long biết format khi gọi từ Frontend.
> Base URL: `http://127.0.0.1:8000` (dev)

---

## POST `/api/auth/login/`

> **Source:** `accounts/views_auth.py:24` (`LoginView`) + `accounts/urls_auth.py:9`.

**Mô tả:** Đăng nhập, nhận JWT.  
**Auth:** Không cần.

**Request:**
```json
{
    "email": "admin@worktracker.com",
    "password": "YourPassword@123"
}
```

**Response 200:**
```json
{
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "id": 1,
        "email": "admin@worktracker.com",
        "role": "ADMIN",
        "must_change_password": false,
        "permissions": [
            "user:disable",
            "user:create",
            "client:create",
            "client:update",
            "job:create",
            "job:update",
            "department:manage",
            "audit:view"
        ]
    }
}
```

**Response 401** (sai email hoặc sai password):
```json
{"detail": "Invalid email or password."}
```

**Response 403** (tài khoản bị khóa):
```json
{"detail": "User account is disabled. Please contact the administrator."}
```

---

## POST `/api/auth/logout/`

> **Source:** `accounts/views_auth.py:37` (`LogoutView`) + `accounts/urls_auth.py:10`.

**Mô tả:** Đăng xuất, blacklist token hiện tại.  
**Auth:** Bearer token.

**Request:** Không cần body.

**Response 200:**
```json
{"detail": "Logged out successfully."}
```

**Response 503** (Redis tạm thời không available):
```json
{"detail": "Logout service temporarily unavailable. Please try again."}
```

---

## POST `/api/auth/refresh/`

> **Source:** dùng thẳng `TokenRefreshView` của SimpleJWT, đăng ký ở `accounts/urls_auth.py:11`
> (không có view riêng của dự án).

**Mô tả:** Lấy access token mới từ refresh token.  
**Auth:** Không cần Bearer — dùng refresh token trong body.

**Request:**
```json
{
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200:**
```json
{
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> Note: Cả 2 token đều mới (ROTATE_REFRESH_TOKENS = True).

**Response 401** (refresh token hết hạn hoặc đã bị dùng):
```json
{"detail": "Token is invalid or expired", "code": "token_not_valid"}
```

---

## POST `/api/auth/forgot-password/`

> **Source:** `accounts/views_auth.py:59` (`ForgotPasswordView`) + `accounts/urls_auth.py:12`.

**Mô tả:** Gửi token reset password qua email.  
**Auth:** Không cần.

**Request:**
```json
{
    "email": "user@worktracker.com"
}
```

**Response 200** (luôn 200, dù email tồn tại hay không):
```json
{"detail": "If that email exists, a reset link has been sent."}
```

> Dev mode: token được in ra terminal thay vì gửi email thật.

---

## POST `/api/auth/reset-password/`

> **Source:** `accounts/views_auth.py:82` (`ResetPasswordView`) + `accounts/urls_auth.py:13`.

**Mô tả:** Đổi password bằng token nhận qua email.  
**Auth:** Không cần.

**Request:**
```json
{
    "token": "abc123...",
    "new_password": "NewSecurePass@456"
}
```

**Response 200:**
```json
{"detail": "Password has been reset successfully"}
```

**Response 400** (token không tồn tại):
```json
{"non_field_errors": ["Invalid Token"]}
```

**Response 400** (token đã dùng):
```json
{"non_field_errors": ["This reset link has already been used."]}
```

**Response 400** (token hết hạn):
```json
{"non_field_errors": ["This reset link has expired."]}
```

---

## POST `/api/auth/change-password/`

> **Source:** `accounts/views_auth.py:95` (`ChangePasswordView`) + `accounts/urls_auth.py:14`.

**Mô tả:** Đổi password khi đã đăng nhập (bắt buộc khi `must_change_password = true`).  
**Auth:** Bearer token.

**Request:**
```json
{
    "old_password": "CurrentPass@123",
    "new_password": "NewPass@456"
}
```

**Response 200:**
```json
{"detail": "Password changed successfully"}
```

**Response 400** (sai current password):
```json
{"non_field_errors": ["Current password is incorrect."]}
```

---

## POST `/api/auth/user/<id>/disable/`

> **Source:** `accounts/views_admin.py:17` (`AdminDisableUserView`) + `accounts/urls_admin.py:7`.

**Mô tả:** Admin khóa tài khoản user.  
**Auth:** Bearer token.  
**Required permission:** `user:disable`

**Response 200:**
```json
{"detail": "User disabled"}
```

**Response 403** (thiếu permission):
```json
{"detail": "You do not have permission to perform this action."}
```

**Response 403** (chưa đổi password lần đầu):
```json
{"detail": "You must change your password before performing this action."}
```

**Response 404:**
```json
{"detail": "User not found"}
```

---

## GET `/api/auth/team/employees/`

> **Source:** `accounts/views_manager.py:15` (`ManagerTeamEmployeeListView`) + `accounts/urls_manager.py:7`.

**Mô tả:** Manager xem danh sách employee trong team mình.  
**Auth:** Bearer token.  
**Required permission:** `employee:view_team`

**Response 200:**
```json
[
    {
        "id": 2,
        "full_name": "Nguyễn Văn An",
        "department": "Backend Team"
    },
    {
        "id": 3,
        "full_name": "Trần Thị Bình",
        "department": "Backend Team"
    }
]
```

> Data Isolation: chỉ trả employee của department mà `department.manager = request.user`.

---

## Ghi chú chung cho mọi API có `HasPermission`

> **Source:** `accounts/permissions.py:12` (`HasPermission`); check blacklist/is_active —
> `accounts/authentication.py:12` và `L58`.

**Response 401** — Token không hợp lệ hoặc đã logout:
```json
{"detail": "Authentication credentials were not provided."}
// hoặc
{"detail": "Token has been revoked."}
// hoặc
{"detail": "Account is locked or deactivated.", "code": "account_inactive"}
```

**Response 403** — Thiếu permission:
```json
{"detail": "You do not have permission to perform this action."}
```

**Response 403** — Chưa đổi mật khẩu (must_change_password):
```json
{"detail": "You must change your password before performing this action."}
```

---

## Test nhanh bằng curl

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"YourPass"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

# 2. Gọi API với token
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/api/auth/team/employees/
```
