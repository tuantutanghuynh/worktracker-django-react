# 04 — Frontend Auth Kit

> Tuấn Tú đã xây dựng toàn bộ nền tảng auth trên Frontend.
> Minh Anh và Đức Long **import và dùng lại** — không tự viết lại.
> File này giải thích từng thành phần và cách dùng.

---

## Cấu trúc file

```
frontend/src/
├── stores/
│   └── authStore.js          ← Zustand store (nội bộ — KHÔNG import trực tiếp)
├── api/
│   ├── axiosClient.js        ← Axios instance với interceptor tự refresh
│   └── authApi.js            ← Các hàm gọi auth API
├── hooks/
│   └── useAuth.js            ← Hook chính để đọc auth state
├── components/auth/
│   ├── ProtectedRoute.jsx    ← Chặn user chưa đăng nhập
│   ├── RoleRoute.jsx         ← Chặn user không đúng role
│   ├── PermissionRoute.jsx   ← Chặn user thiếu permission cụ thể
│   ├── LoginPage.jsx
│   ├── ForgotPasswordPage.jsx
│   ├── ResetPasswordPage.jsx
│   └── ChangePasswordPage.jsx
├── router/
│   └── index.jsx             ← Cấu trúc route toàn app
└── constants/
    └── routes.js             ← Hằng số đường dẫn
```

---

## Phần 1: `authStore.js` — Zustand Store

### Không import file này trực tiếp
`authStore.js` là implementation detail. Minh Anh và Đức Long **không cần biết** nó tồn tại.
Dùng `useAuth()` hook thay thế (xem Phần 2).

### Lý do dùng Zustand thay vì Context
Context re-render toàn bộ component tree mỗi khi state thay đổi.
Zustand chỉ re-render component nào subscribe đúng piece of state.
Với auth state (được đọc ở nhiều nơi), Zustand hiệu quả hơn nhiều.

### Token lưu trong RAM, không localStorage

> **Source:** `frontend/src/stores/authStore.js:12-15`.

```javascript
// authStore: state sống trong RAM
accessToken: null,
refreshToken: null,
user: null,
```

Khi user refresh trang → state về null → phải login lại.
Đây là tradeoff có chủ ý: an toàn hơn localStorage (không bị XSS đọc).

---

## Phần 2: `useAuth.js` — Hook chính

> **Source:** `frontend/src/hooks/useAuth.js`.

### Đây là interface duy nhất cho auth state

```javascript
import useAuth from '../hooks/useAuth'

function MyComponent() {
    const { user, isLoggedIn, login, logout, hasPermission } = useAuth()
    ...
}
```

### Các giá trị trả về

| Giá trị | Kiểu | Mô tả |
|---------|------|-------|
| `user` | object \| null | `{ id, email, role, must_change_password, permissions }` |
| `isLoggedIn` | boolean | `true` nếu có access token |
| `login(access, refresh, user)` | function | Lưu token + user vào store |
| `logout()` | async function | Gọi backend blacklist endpoint + xóa store |
| `hasPermission(code)` | function | Check permission, ví dụ `hasPermission("client:create")` |

### Cách dùng `hasPermission` để show/hide UI element

```jsx
const { hasPermission } = useAuth()

return (
    <div>
        {hasPermission("client:create") && (
            <button>Thêm khách hàng</button>
        )}
    </div>
)
```

---

## Phần 3: `axiosClient.js` — Axios Instance

> **Source:** `frontend/src/api/axiosClient.js:20-26` (request interceptor — gắn Bearer token);
> `axiosClient.js:29-57` (response interceptor — refresh khi 401).

### Dùng cho mọi API call trong dự án

```javascript
import axiosClient from '../api/axiosClient'

// Gọi API bình thường — token tự động được đính vào header
const response = await axiosClient.get('/api/auth/team/employees/')
const response = await axiosClient.post('/api/timesheets/log-works/', data)
```

### Interceptor đã tích hợp sẵn

**Request interceptor:** tự đọc `accessToken` từ Zustand và gắn vào `Authorization: Bearer`.
Không cần tự tay thêm header.

**Response interceptor:** khi gặp 401:
1. Thử gọi `/api/auth/refresh/` với `refreshToken`
2. Nếu thành công → cập nhật `accessToken` mới → retry request gốc
3. Nếu refresh cũng fail → gọi `logout()` → redirect `/login`

**Toàn bộ logic này tự động** — component gọi API không cần xử lý 401.

### KHÔNG dùng `axios` trực tiếp cho API call nào của dự án
```javascript
// SAI — không qua interceptor
import axios from 'axios'
axios.get('/api/...')

// ĐÚNG
import axiosClient from '../api/axiosClient'
axiosClient.get('/api/...')
```

---

## Phần 4: Route Guards — 3 loại

> **Source:** `frontend/src/components/auth/ProtectedRoute.jsx:11` (redirect `/login` ở L15-16,
> redirect `/change-password` ở L19-20); `RoleRoute.jsx:10` (check `allowedRoles` L13-14);
> `PermissionRoute.jsx:10` (check permission L13-14).

### `ProtectedRoute` — Chặn user chưa login

```jsx
// Dùng trong router — wrap mọi trang cần đăng nhập
{
    element: <ProtectedRoute />,
    children: [
        { path: '/admin', element: <AdminPage /> },
        { path: '/manager', element: <ManagerPage /> },
    ]
}
```

Ngoài kiểm tra login, `ProtectedRoute` còn redirect sang `/change-password` nếu
`user.must_change_password === true`.

### `RoleRoute` — Chặn sai role

```jsx
{
    element: <ProtectedRoute />,
    children: [
        {
            element: <RoleRoute allowedRoles={['ADMIN']} />,
            children: [
                { path: '/admin', element: <AdminDashboard /> },
                { path: '/admin/clients', element: <ClientListPage /> },
            ]
        }
    ]
}
```

`allowedRoles` là mảng — có thể cho phép nhiều role:
```jsx
<RoleRoute allowedRoles={['ADMIN', 'MANAGER']} />
```

### `PermissionRoute` — Chặn thiếu permission cụ thể

```jsx
{
    element: <ProtectedRoute />,
    children: [
        {
            element: <PermissionRoute permission="client:create" />,
            children: [
                { path: '/admin/clients/new', element: <CreateClientPage /> },
            ]
        }
    ]
}
```

Phù hợp khi cùng 1 role nhưng không phải ai cũng có permission đó (granular hơn `RoleRoute`).

### Thứ tự nesting bắt buộc
```
ProtectedRoute      ← kiểm tra đã login + must_change_password
    └── RoleRoute   ← kiểm tra role
            └── PermissionRoute ← kiểm tra permission cụ thể (nếu cần)
                        └── YourPage
```

---

## Phần 5: Thêm Layout cho role mới

Hiện tại `router/index.jsx` đã có khung cho cả 3 role:

```jsx
// Admin — Minh Anh thêm route vào đây
{
    element: <RoleRoute allowedRoles={['ADMIN']} />,
    children: [
        { path: '/admin', element: <div>Admin Dashboard</div> },  // placeholder
    ],
},

// Manager — Đức Long thêm route vào đây
{
    element: <RoleRoute allowedRoles={['MANAGER']} />,
    children: [
        { path: '/manager', element: <div>Manager Dashboard</div> },  // placeholder
    ],
},
```

Khi Minh Anh/Đức Long xây layout của mình, thay `<div>Admin Dashboard</div>` bằng
component thật và thêm route con bên trong `children`.

---

## Phần 6: Bắt đầu một trang mới đúng cách

Ví dụ Minh Anh muốn xây trang Danh sách Client:

```jsx
// frontend/src/components/admin/ClientListPage.jsx
import { useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import useAuth from '../../hooks/useAuth'

export default function ClientListPage() {
    const { hasPermission } = useAuth()
    const [clients, setClients] = useState([])

    useEffect(() => {
        axiosClient.get('/api/clients/')
            .then(res => setClients(res.data))
            .catch(err => console.error(err))
    }, [])

    return (
        <div>
            {hasPermission("client:create") && (
                <button>+ Thêm khách hàng</button>
            )}
            {/* ... render bảng clients */}
        </div>
    )
}
```

Điểm quan trọng:
- Dùng `axiosClient` → token tự đính, refresh tự xử lý
- Dùng `useAuth()` → lấy state auth + check permission
- **Không** tự quản lý token, không tự gọi refresh
