# Authentication & Authorization cho Work Tracker (React Vite + Django)

## Kiến trúc tổng thể

``` text
React Vite
    ↓
JWT Access Token (15m)

Django DRF
    ↓
SimpleJWT
    ↓
RBAC Permission Engine
    ↓
MySQL

Redis
 ├─ Refresh Token Blacklist
 ├─ Rate Limiting
 └─ Cache

Celery
 └─ Send Reset Password Email
```

## 1. Authentication

### Login bằng Email + Password

-   Sử dụng email làm tài khoản đăng nhập.
-   Xác thực bằng Django Authentication.
-   Kiểm tra trạng thái `is_active`.
-   Sinh Access Token và Refresh Token.

### JWT

-   Access Token: 15 phút.
-   Refresh Token: 7 ngày.
-   Payload chứa:
    -   user_id
    -   email
    -   role

### Refresh Token Rotation

``` python
SIMPLE_JWT = {
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True
}
```

## 2. Logout

Sử dụng Redis để blacklist token.

Flow:

``` text
Logout
 ↓
Lấy JTI
 ↓
Redis SETEX
 ↓
Token bị vô hiệu hóa
```

Không lưu blacklist trong MySQL.

## 3. Forgot Password

Flow:

``` text
Nhập email
 ↓
Gửi email
 ↓
Link reset
 ↓
Đặt mật khẩu mới
```

Token: - Hết hạn sau 15 phút. - Chỉ sử dụng 1 lần.

## 4. First Login Password Change

Đề xuất bổ sung:

``` sql
must_change_password BOOLEAN DEFAULT TRUE
```

Flow:

``` text
Admin tạo tài khoản
 ↓
User đăng nhập lần đầu
 ↓
Bắt buộc đổi mật khẩu
```

## 5. Account Locking

Đề xuất bổ sung:

``` sql
failed_login_count
locked_until
```

Flow:

``` text
Sai 5 lần
 ↓
Khóa 15 phút
```

## 6. Email Verification

-   Không cần nếu Admin tạo tài khoản nội bộ.
-   Chỉ cần nếu hệ thống cho phép tự đăng ký.

## 7. Authorization (RBAC)

Không chỉ dùng Role.

Phải dùng:

``` text
Role + Permission
```

### ADMIN

-   client:create
-   client:update
-   job:create
-   job:update
-   user:create
-   user:disable
-   audit:view

### MANAGER

-   task:create
-   task:assign
-   task:review
-   timesheet:lock
-   report:view

### EMPLOYEE

-   task:view_own
-   task:update_own
-   timesheet:create
-   timesheet:update_own

## 8. Data Isolation

### Manager

Chỉ xem dữ liệu team hoặc dự án của mình.

``` python
Job.objects.filter(manager=request.user)
```

### Employee

Chỉ xem dữ liệu cá nhân.

``` python
Task.objects.filter(assignee=request.user)
```

Không tin tưởng Frontend.

## 9. Session Management

Đề xuất thêm bảng:

``` sql
user_sessions
```

Thông tin:

-   IP
-   User Agent
-   Login Time
-   Last Activity

Cho phép:

-   Logout all devices

## 10. Audit Security

Ghi log:

-   LOGIN_SUCCESS
-   LOGIN_FAILED
-   LOGOUT
-   PASSWORD_CHANGED
-   ACCOUNT_LOCKED

Lưu vào bảng:

``` sql
audit_logs
```

## 11. React Frontend Security

### Protected Route

``` jsx
<ProtectedRoute />
```

### Role Route

``` jsx
<RoleRoute role="ADMIN" />
```

### Permission Route

``` jsx
<PermissionRoute permission="task:create" />
```

## Checklist hoàn chỉnh

### Bắt buộc

-   JWT Access/Refresh Token
-   Refresh Rotation
-   Redis Blacklist Logout
-   Forgot Password
-   Change Password First Login
-   RBAC (Role + Permission)
-   Protected Route React
-   Data Isolation
-   Audit Log
-   Account Disable

### Nâng cao

-   Login Rate Limit
-   Account Locking
-   Session Management
-   2FA (OTP hoặc Google Authenticator)

## Kết luận

Đối với dự án Work Tracker nội bộ doanh nghiệp:

Ưu tiên: - RBAC - Data Isolation - Audit Log - Redis Security

Không cần: - Social Login (Google/Facebook)

Đây là các thành phần có giá trị thực tế cao nhất đối với một dự án
Django doanh nghiệp.
