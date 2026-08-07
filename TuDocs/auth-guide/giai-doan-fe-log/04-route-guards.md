# 04 — Route Guards: ProtectedRoute & RoleRoute

## Vấn đề cần giải quyết

Không có guard → người dùng gõ thẳng `localhost:5173/admin` vào trình
duyệt là vào được, dù chưa đăng nhập. Route guard là lớp "bảo vệ đường vào"
phía Frontend — **không phải bảo mật thật** (bảo mật thật vẫn ở Backend),
nhưng cần thiết cho trải nghiệm người dùng đúng và nhất quán.

## Vì sao tách thành 2 component riêng, không gộp lại?

Mỗi component trả lời 1 câu hỏi độc lập:

| Component | Câu hỏi | Nếu không thỏa → redirect về |
|---|---|---|
| `ProtectedRoute` | Đã đăng nhập chưa? | `/login` |
| `RoleRoute` | Có đúng role yêu cầu không? | `/unauthorized` |

Gộp lại thành 1 component thì khi chặn, không rõ đang chặn vì lý do gì —
log debug, UX message sẽ khó xử lý hơn. Tách ra còn cho phép dùng độc lập:
`RoleRoute` luôn nằm **bên trong** `ProtectedRoute` (đã đăng nhập rồi mới
kiểm tra role).

## Code — `ProtectedRoute.jsx`

```jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

export default function ProtectedRoute() {
    const { isLoggedIn, user } = useAuth()
    const location = useLocation()

    if (!isLoggedIn) {
        return <Navigate to="/login" replace />
    }

    if (user?.must_change_password && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />
    }

    return <Outlet />
}
```

## Giải thích từng phần — ProtectedRoute

### `<Outlet />` — React Router v7

Trong React Router v7, một component "layout route" (không có path, chỉ có
element) dùng `<Outlet />` để nói "render component con được match ở đây".
Nếu user vượt qua được điều kiện, `<Outlet />` sẽ render trang thật. Nếu
không, redirect xảy ra trước khi `<Outlet />` chạy.

Giống pattern `next()` trong Express middleware — nếu qua được thì cho đi
tiếp, không thì chặn.

### `<Navigate to="/login" replace />`

`replace` nghĩa là thay thế entry hiện tại trong browser history, không thêm
mới. Nếu không có `replace`, user bấm nút "Back" trên trình duyệt sẽ quay
lại trang bị chặn, lại bị redirect tiếp → vòng lặp khó chịu.

### Gate `must_change_password` — vì sao cần `useLocation`?

```jsx
if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
}
```

Nếu không có điều kiện `location.pathname !== '/change-password'`:

```text
User vào /change-password
   → ProtectedRoute check: must_change_password = true
   → redirect /change-password
   → ProtectedRoute check lại: must_change_password = true
   → redirect /change-password lại...
→ Vòng lặp vô tận
```

Exclusion `/change-password` phá vỡ vòng lặp: "đã ở /change-password rồi
thì không redirect nữa, cho qua".

### `user?.must_change_password` — Optional Chaining `?.`

Dấu `?.` là "optional chaining" — nếu `user` là `null` hoặc `undefined`,
toàn bộ biểu thức trả về `undefined` thay vì ném lỗi `Cannot read properties
of null`. Quan trọng vì khi mới load trang, `user` chưa có giá trị ngay.

## Code — `RoleRoute.jsx`

```jsx
import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

export default function RoleRoute({ allowedRoles }) {
    const { user } = useAuth()

    if (!allowedRoles.includes(user?.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <Outlet />
}
```

## Giải thích — RoleRoute

### `allowedRoles` — prop array thay vì string

```jsx
// Dùng array → dễ mở rộng sau này
<RoleRoute allowedRoles={['ADMIN']} />
<RoleRoute allowedRoles={['ADMIN', 'MANAGER']} />  // trang cho cả 2 role

// Nếu dùng string → phải sửa component khi cần multi-role
<RoleRoute role="ADMIN" />
```

### `allowedRoles.includes(user?.role)`

`user?.role` trả về `'EMPLOYEE'` / `'MANAGER'` / `'ADMIN'` (string, từ
backend serializer). `Array.includes()` kiểm tra có trong mảng không.
Nếu `user` là `null`, `user?.role` là `undefined`, `includes(undefined)`
trả `false` → redirect `/unauthorized`. ProtectedRoute đã chặn user chưa
đăng nhập trước rồi, nên trường hợp này rất hiếm, nhưng vẫn xử lý an toàn.

## Cách dùng trong Router (thứ tự lồng nhau quan trọng)

```jsx
// RoleRoute luôn nằm TRONG ProtectedRoute
{
    element: <ProtectedRoute />,
    children: [
        {
            element: <RoleRoute allowedRoles={['ADMIN']} />,
            children: [
                { path: '/admin', element: <AdminDashboard /> }
            ]
        }
    ]
}
```

Khi user vào `/admin`:
1. `ProtectedRoute` check trước — chưa login → redirect `/login`, dừng
2. Nếu qua được → `RoleRoute` check — không phải ADMIN → redirect `/unauthorized`
3. Nếu qua được → render `AdminDashboard`

## Lỗi thật đã gặp

### Lỗi — Typo `<Oulet />` thiếu chữ `t`

```jsx
return <Oulet />   // SAI — không tồn tại, React render null hoặc lỗi
return <Outlet />  // ĐÚNG
```

Lỗi âm thầm — React không báo lỗi compile, chỉ là trang trắng khi vào route.
Phát hiện nhờ kiểm tra kỹ file trước khi chạy.

### Điều chưa làm — `PermissionRoute`

`PermissionRoute` (chặn theo permission code như `task:create`, `logwork:void`)
chưa được implement trong tuần 1. Đây là lớp guard thứ 3, dùng trong cùng
một trang để ẩn/hiện nút/section theo quyền chi tiết hơn RoleRoute.
Cần bổ sung trong tuần 2.
