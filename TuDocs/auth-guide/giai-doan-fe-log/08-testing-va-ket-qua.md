# 08 — Testing & Kết Quả

## Môi trường test

```text
Frontend: http://localhost:5173  (Vite dev server)
Backend:  http://localhost:8000  (Django runserver)
Browser:  Chrome (DevTools mở sẵn)
```

Test user tạo bằng Django shell:
```python
from accounts.models import CustomUser, Role
role = Role.objects.get(code='EMPLOYEE')
u = CustomUser.objects.create_user(
    username='test', email='test@test.com', password='Test1234!', role=role
)
u.must_change_password = False
u.is_active = True
u.save()
```

Lưu ý phát hiện trong quá trình tạo user:
- Model tên là `CustomUser`, không phải `User` → `from accounts.models import User` sẽ lỗi
- `create_user()` yêu cầu `username` (vì vẫn dùng `UserManager` mặc định của Django dù `USERNAME_FIELD = 'email'`)
- `role` là ForeignKey → phải truyền object `Role`, không phải string `'EMPLOYEE'`

---

## Kết quả test các luồng

### ✅ Luồng 1 — Login thành công (đã test thật)

```text
1. Vào http://localhost:5173
   → Redirect /login ✅

2. Nhập email: test@test.com / password: Test1234!
   → Bấm Sign in
   → Redirect http://localhost:5173/emp ✅
   → Hiện text "Employee Dashboard" ✅
```

### ⏳ Luồng 2 — Login với `must_change_password = true` (chưa test)

```text
Dự kiến:
1. Login với user có must_change_password = true
   → Redirect /change-password
2. Thử vào /emp trực tiếp
   → ProtectedRoute chặn, redirect /change-password
3. Điền đúng mật khẩu cũ + mật khẩu mới
   → API thành công → Zustand user cập nhật must_change_password: false
   → Redirect /emp
```

### ⏳ Luồng 3 — Forgot/Reset Password (chưa test thật)

```text
Dự kiến:
1. Vào /forgot-password, nhập email
   → API trả 200 (kể cả email không tồn tại — anti-enumeration)
   → Form ẩn, hiện "Check your email"
2. Đọc token từ Django console log (EMAIL_BACKEND = console)
3. Vào /reset-password?token=<token>
   → Điền mật khẩu mới + confirm
   → API thành công → redirect /login
4. Login với mật khẩu mới → vào được
```

### ✅ Luồng 4 — Truy cập không phép (đã xác nhận gián tiếp)

```text
Vào /admin khi chưa đăng nhập
→ ProtectedRoute redirect /login ✅

Vào /unauthorized trực tiếp
→ Hiện text "403 — You do not have permission." ✅
```

---

## Tổng hợp tất cả lỗi đã gặp trong session này

| # | File | Loại lỗi | Mô tả | Bài học |
|---|------|----------|-------|---------|
| 1 | authStore.js | File bị cắt | Thiếu `login`/`logout` hàm | Đọc lại file sau khi gõ |
| 2 | axiosClient.js | Tên key sai | `res.data.accessToken` → phải là `res.data.access` | Đọc backend API docs, không đoán |
| 3 | authApi.js | Nhầm logic | `resetPassword` dùng `old_password` thay vì `token` | Reset vs Change là 2 luồng khác nhau |
| 4 | authApi.js | File bị cắt | Thiếu `changePassword` hàm | Kiểm tra đủ hàm trước khi submit |
| 5 | ProtectedRoute | Typo | `<Oulet />` thiếu chữ `t` | Trang trắng gây ra bởi component không tồn tại |
| 6 | LoginPage | Import thừa | `import { use } from 'react'` không cần | Xóa import không dùng |
| 7 | LoginPage | Shadow variable | `error.email` → phải là `errors.email` | `error` (string) ≠ `errors` (object) |
| 8 | ChangePasswordPage | Typo tên biến | `shcema` → `schema` gây ReferenceError | Tên biến không nhất quán |
| 9 | ChangePasswordPage | Typo string | `reqired` → `required` | Nhỏ nhưng sẽ hiện sai với user |
| 10 | ChangePasswordPage | Typo tên hàm | `handleChanePassword` thiếu `g` (2 chỗ) | Function không tồn tại → crash runtime |
| 11 | ForgotPasswordPage | Shadow variable | `formState: { error }` → `{ errors }` | Biến `error` từ hook bị che khuất |
| 12 | useForgotPassword | Typo | `serError` → `setError` và `setErrorMap` → `setError` | Hàm không tồn tại → crash runtime |
| 13 | useResetPassword | Typo | `err.response?data?.detail` thiếu dấu `.` | Optional chaining `?.` phải đúng cú pháp |
| 14 | router/index.jsx | File bị cắt | Thiếu `export default router` | Module không export → import undefined |
| 15 | Hệ thống | CORS | `CORS_ALLOWED_ORIGINS` chưa cấu hình → browser block | Triệu chứng: "Invalid email or password" (fallback) thay vì CORS error rõ ràng |

---

## Điều chưa làm trong Tuần 1 (cần làm tuần 2)

1. **`PermissionRoute`** — chặn theo permission code cụ thể (ví dụ `task:create`),
   dùng để ẩn/hiện nút trong cùng một trang theo quyền chi tiết hơn RoleRoute.

2. **Test thật luồng Change Password** với user có `must_change_password = true`.

3. **Test thật luồng Forgot/Reset Password** end-to-end với token thật từ console.

4. **Báo nhóm** cách tích hợp auth kit — Minh Anh và Đức Long cần:
   - Import `ProtectedRoute`, `RoleRoute` từ `components/auth/`
   - Import `useAuth` từ `hooks/useAuth` để đọc `user`, `isLoggedIn`
   - Import `axiosClient` từ `api/axiosClient` cho mọi API call
   - Không import `useAuthStore` trực tiếp
