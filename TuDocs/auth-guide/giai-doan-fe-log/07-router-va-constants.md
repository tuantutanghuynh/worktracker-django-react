# 07 — Router & Constants: Nối Toàn Bộ Lại

## `src/constants/routes.js` — Tại Sao Cần File Này?

Ban đầu, `ROLE_DASHBOARD` và `ROUTES` được định nghĩa ngay trong
`useLogin.js`. Đến khi viết `useChangePassword.js`, nhận ra cả 2 hook đều
cần `ROLE_DASHBOARD`. Nếu copy-paste → 2 chỗ cần đồng bộ khi có thay đổi.

Tách ra `constants/routes.js` → import 1 chỗ, thay đổi 1 chỗ:

```js
// frontend/src/constants/routes.js
export const ROUTES = {
    LOGIN: '/login',
    CHANGE_PASSWORD: '/change-password',
    UNAUTHORIZED: '/unauthorized',
}

export const ROLE_DASHBOARD = Object.freeze({
    ADMIN: '/admin',
    MANAGER: '/manager',
    EMPLOYEE: '/emp',
})
```

### `Object.freeze()`

Ngăn không cho code khác vô tình sửa object này:

```js
ROLE_DASHBOARD.ADMIN = '/superadmin'   // Bị ignore silently (strict mode: throw TypeError)
```

Với object không bị freeze, lỗi này có thể xảy ra mà không có cảnh báo.
`Object.freeze()` là defensive programming — bảo vệ constant khỏi bị sửa
ngoài ý muốn.

---

## `src/router/index.jsx` — Route Tree Trung Tâm

```jsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
// ...import tất cả page components

const router = createBrowserRouter([
    { path: '/', element: <Navigate to="/login" replace /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/forgot-password', element: <ForgotPasswordPage /> },
    { path: '/reset-password', element: <ResetPasswordPage /> },

    {
        element: <ProtectedRoute />,
        children: [
            { path: '/change-password', element: <ChangePasswordPage /> },
            {
                element: <RoleRoute allowedRoles={['ADMIN']} />,
                children: [
                    { path: '/admin', element: <div>Admin Dashboard</div> },
                ],
            },
            {
                element: <RoleRoute allowedRoles={['MANAGER']} />,
                children: [
                    { path: '/manager', element: <div>Manager Dashboard</div> },
                ],
            },
            {
                element: <RoleRoute allowedRoles={['EMPLOYEE']} />,
                children: [
                    { path: '/emp', element: <div>Employee Dashboard</div> },
                ],
            },
        ],
    },

    { path: '/unauthorized', element: <div>403 — You do not have permission.</div> },
    { path: '*', element: <div>404 — Page not found.</div> },
])

export default router
```

### `createBrowserRouter` vs `<BrowserRouter>`

React Router v7 khuyến khích `createBrowserRouter` (Data Router API) thay
vì bọc app trong `<BrowserRouter>`. Lợi ích: hỗ trợ `loader`/`action` cho
data fetching tích hợp với router (dùng về sau). `createBrowserRouter` trả
về một object router, truyền vào `RouterProvider`.

### Layout Route — Route không có `path`

```js
{
    element: <ProtectedRoute />,   // Không có path → luôn match
    children: [ ... ]
}
```

Route không có `path` là **layout route**: luôn match với mọi URL, render
`element` của nó, rồi dùng `<Outlet />` để render child được match. Đây
là cơ chế lồng route trong React Router v6+.

Thứ tự lồng thể hiện thứ tự kiểm tra:
1. `ProtectedRoute` check (đăng nhập chưa?)
2. `RoleRoute` check (đúng role không?) → chỉ xảy ra nếu đã qua bước 1

### `{ path: '*', ... }` — Wildcard Route

Match mọi URL không khớp với bất kỳ route nào khác — wildcard `*`. Đây là
"404 handler" của React Router. Phải đặt **cuối cùng** vì React Router
kiểm tra theo thứ tự từ trên xuống.

### Bug thật: URL `/` ban đầu hiện "403"

Khi chạy lần đầu, vào `http://localhost:5173/` thấy text "403 — You do not
have permission." Nguyên nhân: không có route cho `/` → fall through xuống
`*` (wildcard)... không, thực ra wildcard hiện "404". Bug thật: router
render `ProtectedRoute` (layout route không path, luôn match) → check
`isLoggedIn = false` → redirect `/login`... nhưng cũng có thể gặp trường
hợp không có child match.

**Sửa**: thêm `{ path: '/', element: <Navigate to="/login" replace /> }` làm
route đầu tiên — URL `/` redirect thẳng về `/login` mà không đi qua
`ProtectedRoute`.

---

## `src/App.jsx` — Đơn Giản Nhất Có Thể

```jsx
import { RouterProvider } from 'react-router-dom'
import router from './router/index'

export default function App() {
    return <RouterProvider router={router} />
}
```

App component giờ chỉ làm 1 việc: giao toàn bộ control cho router. Không
có state, không có logic, không có JSX phức tạp — mọi thứ nằm trong
`router/index.jsx`. `main.jsx` không cần sửa gì.

---

## Cấu hình CORS — Lỗi thật cản trở login

```python
# backend/worktracker_core/settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
```

`corsheaders` đã được cài nhưng **không có `CORS_ALLOWED_ORIGINS`** → browser
block mọi request từ `localhost:5173` đến `localhost:8000` vì khác origin.

**Triệu chứng gây nhầm lẫn**: frontend hiện "Invalid email or password" —
nhìn như lỗi từ backend, nhưng thực ra là fallback message khi
`err.response` là `undefined` (request bị browser block trước khi đến
server, không có response). Để phân biệt: mở Network tab trong DevTools —
nếu CORS fail, request có icon đặc biệt và console hiện `CORS error`.
