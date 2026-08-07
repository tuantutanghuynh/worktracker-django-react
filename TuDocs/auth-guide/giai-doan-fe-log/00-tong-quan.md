# Giai đoạn FE — Auth Kit React: Tổng quan quá trình thực hiện

Bản ghi lại toàn bộ quá trình xây dựng **Auth Kit phía Frontend** trong
tuần 1. Mục tiêu: cả team (Minh Anh + Đức Long) có thể tích hợp ngay
`ProtectedRoute`, `RoleRoute`, Zustand store, và Axios interceptor vào
layout của họ mà không cần hỏi Tuấn Tú từng bước nhỏ.

Đây không phải tài liệu "học React từ đầu" — đây là **nhật ký kỹ thuật thật**:
vì sao chọn giải pháp này, những lỗi nào đã gặp, và bài học rút ra được.

---

## Phạm vi đã hoàn thành

- Zustand store giữ token + user trong RAM (không localStorage — chống XSS)
- Axios instance với 2 interceptor: tự gắn Bearer token, tự refresh khi 401
- `ProtectedRoute` chặn người chưa đăng nhập + gate `must_change_password`
- `RoleRoute` chặn theo role (ADMIN / MANAGER / EMPLOYEE)
- `useAuth` — public interface duy nhất cho toàn bộ app
- `useLogin`, `useChangePassword`, `useForgotPassword`, `useResetPassword` — hooks xử lý từng luồng
- 4 page: LoginPage, ChangePasswordPage, ForgotPasswordPage, ResetPasswordPage
- `src/constants/routes.js` — tập trung toàn bộ hằng số đường dẫn
- `PermissionRoute` — lớp guard thứ 3, check permission code cụ thể
- `hasPermission(code)` trong `useAuth` — dùng ẩn/hiện UI element theo quyền
- React Router setup + App.jsx
- **Đã test thật**: login → redirect `/emp` thành công

---

## Cây file đã tạo

```text
frontend/src/
├── stores/
│   └── authStore.js              ← Zustand store (state toàn cục)
├── api/
│   ├── axiosClient.js            ← Axios instance + 2 interceptor
│   └── authApi.js                ← Hàm gọi API thuần (không React)
├── hooks/
│   ├── useAuth.js                ← Public interface — mọi nơi import từ đây
│   ├── useLogin.js               ← Xử lý logic đăng nhập
│   ├── useChangePassword.js      ← Xử lý đổi mật khẩu bắt buộc
│   ├── useForgotPassword.js      ← Gửi email reset
│   └── useResetPassword.js       ← Xác nhận token + đặt mật khẩu mới
├── components/auth/
│   ├── ProtectedRoute.jsx        ← Guard: chặn chưa đăng nhập
│   ├── RoleRoute.jsx             ← Guard: chặn sai role
│   ├── LoginPage.jsx
│   ├── ChangePasswordPage.jsx
│   ├── ForgotPasswordPage.jsx
│   └── ResetPasswordPage.jsx
├── constants/
│   └── routes.js                 ← ROUTES + ROLE_DASHBOARD constants
├── router/
│   └── index.jsx                 ← Toàn bộ route tree
└── App.jsx                       ← Chỉ render RouterProvider
```

Ngoài ra, sửa:
```text
frontend/.env                     ← VITE_API_BASE_URL=http://localhost:8000
backend/worktracker_core/settings.py  ← CORS_ALLOWED_ORIGINS thêm localhost:5173
```

---

## Thứ tự đọc các file trong series này

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-zustand-store.md](01-zustand-store.md) | State toàn cục: Zustand vs useState, vì sao không localStorage, cách đọc store ngoài React |
| 2 | [02-axios-interceptor.md](02-axios-interceptor.md) | Tự gắn token + tự refresh 401, flag `_retry`, `getState()` ngoài component |
| 3 | [03-auth-api.md](03-auth-api.md) | authApi.js — tầng giao tiếp HTTP thuần, không React |
| 4 | [04-route-guards.md](04-route-guards.md) | ProtectedRoute, RoleRoute — vì sao tách 2 component, gate must_change_password |
| 5 | [05-hooks-layer.md](05-hooks-layer.md) | useAuth (public interface), useLogin, useChangePassword, useForgotPassword, useResetPassword |
| 6 | [06-pages-va-forms.md](06-pages-va-forms.md) | 4 trang auth: react-hook-form + zod, lỗi thật đã gặp |
| 7 | [07-router-va-constants.md](07-router-va-constants.md) | Router tree, constants/routes.js, App.jsx |
| 8 | [08-testing-va-ket-qua.md](08-testing-va-ket-qua.md) | Test thật login → dashboard, CORS bug, tổng hợp lỗi |
| 9 | [09-permission-route.md](09-permission-route.md) | PermissionRoute, hasPermission, permissions trong login response |

---

## Nguyên tắc xuyên suốt đáng nhớ nhất

1. **Token trong RAM, không localStorage** — page reload = logout là đánh đổi
   có chủ đích để loại bỏ hoàn toàn nguy cơ XSS đọc token.

2. **`useAuthStore.getState()` vs `useAuthStore()`** — trong component dùng
   hook (trigger re-render); ngoài component (interceptor, file JS thuần) phải
   dùng `.getState()` vì không có React context.

3. **`_retry` flag ngăn vòng lặp vô tận** — nếu không có flag này, mỗi lần
   refresh thất bại lại sinh ra 401 mới, lại trigger interceptor, vòng vô tận.

4. **3 lớp route guard — mỗi lớp trả lời 1 câu hỏi khác nhau** —
   `ProtectedRoute` (đã đăng nhập chưa?), `RoleRoute` (đúng role không?),
   `PermissionRoute` (có permission cụ thể không? — chưa làm, tuần 1 còn thiếu).

5. **`errors` (plural, từ react-hook-form) ≠ `error` (singular, từ hook của mình)**
   — lỗi typo này xuất hiện nhiều nhất trong session này, cần nhớ kỹ.
