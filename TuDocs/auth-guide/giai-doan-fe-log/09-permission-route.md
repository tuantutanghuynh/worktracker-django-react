# 09 — PermissionRoute & `hasPermission`: Chặn Theo Quyền Cụ Thể

## Bổ sung sau khi hoàn thành 00-08

`PermissionRoute` và `hasPermission` được thêm vào cuối tuần 1 sau khi nhận
ra roadmap yêu cầu 3 lớp guard (`ProtectedRoute`, `RoleRoute`, `PermissionRoute`)
nhưng chỉ mới làm 2.

---

## Tại sao cần `PermissionRoute` khi đã có `RoleRoute`?

`RoleRoute` chặn **theo vai trò** — tất cả user cùng role đều được vào hoặc
đều bị chặn. Nhưng trong thực tế có những trường hợp tinh tế hơn:

- Manager A và Manager B đều có role `MANAGER`, nhưng permission `timesheet:lock`
  có thể chỉ được cấp cho Manager cấp cao hơn.
- Hai role khác nhau (ADMIN và MANAGER) có thể cùng có permission `report:view`.

`PermissionRoute` check **chính xác permission code**, không phụ thuộc role.
Đây là lớp guard chi tiết nhất trong 3 lớp.

---

## Backend thay đổi — thêm `permissions` vào login response

`PermissionRoute` cần biết danh sách permission của user. Login response trước
đây không trả về thông tin này. Thêm vào `LoginSerializer.get_tokens()`:

```python
# backend/accounts/serializers_auth.py
from .models import PasswordReset, RolePermission   # thêm RolePermission

def get_tokens(self):
    ...
    perms = (
        list(
            RolePermission.objects.filter(role=self.user.role)
            .values_list("permission__code", flat=True)
        )
        if self.user.role
        else []
    )

    return {
        "access": str(access),
        "refresh": str(refresh),
        "user": {
            "id": self.user.id,
            "email": self.user.email,
            "role": self.user.role.code if self.user.role else None,
            "must_change_password": self.user.must_change_password,
            "permissions": perms,   # ← thêm mới
        },
    }
```

### Vì sao không lưu permissions vào JWT claim?

JWT claim đã có `role` — từ role có thể suy ra permissions, nhưng:
1. Danh sách permissions có thể dài → JWT nặng hơn (gắn vào mọi request)
2. Nếu Admin thêm permission mới cho role, JWT cũ vẫn không có permission mới
   cho đến khi token hết hạn và refresh

Trả permissions trong response login một lần → lưu vào Zustand RAM → nhẹ và
luôn nhất quán với thời điểm đăng nhập.

### `values_list("permission__code", flat=True)`

Django ORM cho phép traverse ForeignKey bằng dấu `__`. `RolePermission` có
FK tới `Permission`, và `Permission` có field `code` — nên
`permission__code` lấy thẳng `code` từ bảng `Permission` mà không cần join
tay. `flat=True` trả về list phẳng `['task:view_own', ...]` thay vì list
tuple `[('task:view_own',), ...]`.

---

## `PermissionRoute.jsx`

```jsx
import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

/**
 * PermissionRoute — restricts a route to users who hold a specific permission code.
 * Must be nested inside ProtectedRoute. Redirects to /unauthorized if the
 * user's permission list does not include the required code.
 */

export default function PermissionRoute({ permission }) {
    const { user } = useAuth()

    if (!user?.permissions?.includes(permission)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <Outlet />
}
```

### `user?.permissions?.includes(permission)`

Double optional chaining vì cả `user` lẫn `permissions` đều có thể chưa
có giá trị:
- `user` là `null` khi chưa login (dù ProtectedRoute đã chặn, vẫn phòng thủ)
- `permissions` là `undefined` nếu login response cũ chưa có field này

Nếu bất kỳ bước nào trả `undefined`, toàn bộ biểu thức trả `undefined`
→ `!undefined = true` → redirect `/unauthorized` — hành vi an toàn.

---

## `hasPermission` trong `useAuth.js`

Dùng trong **component/page** để ẩn/hiện UI element (nút, section) theo
quyền — không phải route guard:

```js
const hasPermission = (code) => user?.permissions?.includes(code) ?? false
```

`?? false` — nếu `includes()` trả `undefined` (vì `user` hoặc `permissions`
là null/undefined), fallback về `false` thay vì để `undefined` lan ra
component. Component dùng:

```jsx
const { hasPermission } = useAuth()

{hasPermission('task:review') && <button>Reject Task</button>}
```

### So sánh `PermissionRoute` vs `hasPermission`

| | `PermissionRoute` | `hasPermission` |
|---|---|---|
| Dùng ở đâu | Router tree | Trong JSX của component |
| Chặn cái gì | Cả trang/route | Button, section, tab |
| Khi không có quyền | Redirect `/unauthorized` | Ẩn element (không render) |

Cả 2 đọc cùng dữ liệu `user.permissions` — nhất quán.

---

## Lỗi thật đã gặp

### Lỗi 1 — Quên `RolePermission` trong import

Query `RolePermission.objects.filter(...)` chạy nhưng `NameError` vì chỉ
import `PasswordReset` từ models. Python không báo lỗi lúc save file — chỉ
crash khi request login thật sự chạy tới `get_tokens()`.

### Lỗi 2 — `"permission"` thiếu `s`

```python
"permission": perms   # SAI — frontend đọc user.permissions (có s)
"permissions": perms  # ĐÚNG
```

Key không match → `user.permissions` ở frontend là `undefined` → `hasPermission`
luôn trả `false` → mọi user đều bị chặn bởi `PermissionRoute`. Lỗi âm thầm,
không crash, chỉ thấy qua việc bị redirect unauthorized sau khi đã login đúng.

### Lỗi 3 — Duplicate `return` trong `useAuth.js`

Khi thêm `hasPermission` vào `useAuth`, vô tình tạo thêm 1 `return` mới
thay vì sửa `return` cũ → file có 2 `return`. JavaScript chỉ thực thi
`return` đầu tiên gặp phải — block thứ 2 là dead code. Không crash, nhưng
code gây nhầm lẫn cho người đọc sau.
