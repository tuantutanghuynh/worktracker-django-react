# Auth Kit — Hướng Dẫn Tích Hợp 

---

## 1. Khởi động môi trường dev

### Backend (Django)

```bash
# Bước 1 — Vào thư mục backend và kích hoạt virtual env
cd backend
source .venv/bin/activate          # macOS/Linux
# .venv\Scripts\activate           # Windows

# Bước 2 — Cài dependencies (chỉ cần lần đầu hoặc sau khi có package mới)
pip install -r requirements.txt

# Bước 3 — Chạy migrations (chỉ cần sau khi pull code mới có migration)
python manage.py migrate

# Bước 4 — Chạy server
python manage.py runserver         # Chạy tại http://localhost:8000
```

### Frontend (React + Vite)

```bash
# Bước 1 — Vào thư mục frontend
cd frontend

# Bước 2 — Cài dependencies (chỉ cần lần đầu hoặc sau khi có package mới)
npm install

# Bước 3 — Tạo file .env (chỉ cần lần đầu — file này gitignored)
# Tạo file frontend/.env với nội dung:
VITE_API_BASE_URL=http://localhost:8000

# Bước 4 — Chạy dev server
npm run dev                        # Chạy tại http://localhost:5173
```

> **Lưu ý**: Phải chạy cả backend (port 8000) VÀ frontend (port 5173) cùng lúc.
> Mở 2 terminal riêng.

---

## 2. Packages đã cài sẵn trong frontend

Không cần cài thêm gì — tất cả đã có trong `package.json`:

| Package | Phiên bản | Dùng để |
|---|---|---|
| `zustand` | ^5.0 | Global auth state |
| `axios` | ^1.18 | HTTP client + interceptor tự refresh token |
| `react-router-dom` | ^7.18 | Routing + route guards |
| `react-hook-form` | ^7.80 | Form state management |
| `zod` | ^4.4 | Schema validation |
| `@hookform/resolvers` | ^5.4 | Kết nối zod với react-hook-form |

---

## 3. Cấu trúc auth kit — file nào dùng để làm gì

```text
frontend/src/
├── stores/
│   └── authStore.js          ← Zustand store (KHÔNG import trực tiếp — dùng useAuth)
├── api/
│   ├── axiosClient.js        ← Axios instance đã cấu hình — dùng cho MỌI API call
│   └── authApi.js            ← Hàm gọi API auth (login, logout, v.v.)
├── hooks/
│   └── useAuth.js            ← Hook chính — import cái này, không import authStore
├── components/auth/
│   ├── ProtectedRoute.jsx    ← Dùng trong router để chặn chưa đăng nhập
│   ├── RoleRoute.jsx         ← Dùng trong router để chặn sai role
│   └── PermissionRoute.jsx   ← Dùng trong router để chặn thiếu permission cụ thể
└── constants/
    └── routes.js             ← ROUTES + ROLE_DASHBOARD constants
```

---

## 4. Gọi API — luôn dùng `axiosClient`, không dùng `axios` trực tiếp

```js
// ✅ ĐÚNG — axiosClient tự gắn Bearer token và tự refresh khi 401
import axiosClient from '../api/axiosClient'

const res = await axiosClient.get('/api/tasks/')
const res = await axiosClient.post('/api/tasks/', { title: '...' })
const res = await axiosClient.patch('/api/tasks/1/', { status: 'DONE' })

// ❌ SAI — axios gốc không có token, không có interceptor
import axios from 'axios'
const res = await axios.get('/api/tasks/')
```

Không cần tự thêm `Authorization: Bearer ...` vào header — `axiosClient` tự làm.

---

## 5. Đọc thông tin user đang đăng nhập — `useAuth()`

```jsx
import useAuth from '../hooks/useAuth'

export default function MyComponent() {
    const { user, isLoggedIn, hasPermission, logout } = useAuth()

    // user object có shape:
    // {
    //   id: 1,
    //   email: "name@example.com",
    //   role: "MANAGER",               // "ADMIN" | "MANAGER" | "EMPLOYEE"
    //   must_change_password: false,
    //   permissions: ["task:create", "task:assign", ...]
    // }

    return (
        <div>
            <p>Xin chào, {user?.email}</p>
            <p>Role: {user?.role}</p>

            {/* Ẩn/hiện nút theo permission */}
            {hasPermission('task:create') && (
                <button>Tạo Task</button>
            )}

            <button onClick={logout}>Đăng xuất</button>
        </div>
    )
}
```

> ⚠️ **Quy tắc bắt buộc**: Chỉ import `useAuth`, KHÔNG import `useAuthStore` trực tiếp.

---

## 6. Bảo vệ route trong router của bạn

Khi bạn thêm route mới vào router của role mình (Admin hoặc Manager), lồng
vào đúng guard. Xem `frontend/src/router/index.jsx` làm tham chiếu.

### Chặn theo role (phổ biến nhất)

```jsx
import ProtectedRoute from '../components/auth/ProtectedRoute'
import RoleRoute from '../components/auth/RoleRoute'

// Trong createBrowserRouter:
{
    element: <ProtectedRoute />,           // Lớp 1: phải đăng nhập
    children: [
        {
            element: <RoleRoute allowedRoles={['MANAGER']} />,  // Lớp 2: phải là MANAGER
            children: [
                { path: '/manager/tasks', element: <ManagerTaskPage /> },
                { path: '/manager/jobs',  element: <ManagerJobPage /> },
            ]
        }
    ]
}
```

### Chặn theo permission cụ thể

```jsx
import PermissionRoute from '../components/auth/PermissionRoute'

// Lồng trong ProtectedRoute
{
    element: <PermissionRoute permission="report:view" />,
    children: [
        { path: '/manager/reports', element: <ReportPage /> }
    ]
}
```

### Quy tắc lồng guard

```text
ProtectedRoute           ← luôn là lớp ngoài cùng
  └── RoleRoute          ← lớp thứ 2 (nếu cần chặn role)
        └── PermissionRoute   ← lớp thứ 3 (nếu cần chặn permission chi tiết hơn)
```

`RoleRoute` và `PermissionRoute` phải luôn nằm **bên trong** `ProtectedRoute`.

---

## 7. Ẩn/hiện UI element theo permission

Khác với `PermissionRoute` (chặn cả trang), `hasPermission` dùng để ẩn
nút/section trong cùng một trang:

```jsx
const { hasPermission } = useAuth()

// Nút chỉ hiện nếu user có permission 'task:review'
{hasPermission('task:review') && (
    <button onClick={handleReject}>Reject Task</button>
)}

// Hiện section khác nhau theo role
{user?.role === 'MANAGER' && <ManagerSection />}
{user?.role === 'EMPLOYEE' && <EmployeeSection />}
```

---

## 8. Viết API view mới trong backend — dùng `HasPermission`

Mọi view mới của Minh Anh (`views_admin.py`) và Đức Long (`views_manager.py`)
phải dùng `HasPermission` và khai báo `required_permission`:

```python
# accounts/views_admin.py (Minh Anh)
from accounts.permissions import HasPermission

class CreateUserView(APIView):
    permission_classes = [HasPermission]
    required_permission = 'user:create'    # ← bắt buộc, khớp với seed trong DB

    def post(self, request):
        # request.user đã được xác thực và có quyền 'user:create'
        ...
```

```python
# accounts/views_manager.py (Đức Long)
class TaskAssignView(APIView):
    permission_classes = [HasPermission]
    required_permission = 'task:assign'

    def post(self, request):
        ...
```

> ⚠️ **Nếu quên `required_permission`**: Server sẽ raise `AssertionError`
> ngay khi request đầu tiên vào view — không âm thầm, dễ phát hiện khi test.

### `HasPermission` tự động chặn `must_change_password`

Không cần tự check `if request.user.must_change_password` trong view — đã
được xử lý tự động trong `HasPermission`. View của bạn sẽ không bao giờ
chạy tới nếu user chưa đổi mật khẩu lần đầu.

---

## 9. Danh sách permission theo role (từ seed migration)

### ADMIN (Minh Anh)
| Code | Ý nghĩa |
|---|---|
| `client:create` | Tạo client mới |
| `client:update` | Cập nhật client |
| `job:create` | Tạo job/dự án |
| `job:update` | Cập nhật job |
| `user:create` | Tạo tài khoản nhân viên |
| `user:disable` | Khóa/mở tài khoản |
| `audit:view` | Xem audit log |

### MANAGER (Đức Long)
| Code | Ý nghĩa |
|---|---|
| `task:create` | Tạo task |
| `task:assign` | Giao task cho nhân viên |
| `task:review` | Review / approve task |
| `timesheet:lock` | Chốt sổ kỳ báo cáo |
| `report:view` | Xem báo cáo |
| `manager:search_employee` | Tìm kiếm nhân viên |
| `manager:view_client_list` | Xem danh sách client (read-only) |
| `manager:lock_job` | Khóa timesheet theo job |
| `manager:review_logwork` | Review/approve/reject log work |

### EMPLOYEE (Tuấn Tú)
| Code | Ý nghĩa |
|---|---|
| `task:view_own` | Xem task của mình |
| `task:update_own` | Cập nhật task của mình |
| `timesheet:create` | Tạo log work |
| `timesheet:update_own` | Sửa log work của mình |
| `logwork:void` | Void log work đang pending |

---

## 10. Auth API endpoints (đã sẵn sàng, không cần làm thêm)

Tất cả đều mount tại `/api/auth/`:

| Method | Endpoint | Cần auth? | Mô tả |
|---|---|---|---|
| POST | `/api/auth/login/` | Không | Đăng nhập, nhận JWT |
| POST | `/api/auth/logout/` | Có | Blacklist refresh token |
| POST | `/api/auth/refresh/` | Không | Lấy access token mới |
| POST | `/api/auth/forgot-password/` | Không | Gửi email reset |
| POST | `/api/auth/reset-password/` | Không | Đặt mật khẩu mới qua token email |
| POST | `/api/auth/change-password/` | Có | Đổi mật khẩu (cần mật khẩu cũ) |

`axiosClient` tự gọi `/api/auth/refresh/` khi access token hết hạn — không
cần bạn xử lý gì thêm.

---

## 11. Quy tắc vàng — checklist trước khi code

- [ ] Dùng `axiosClient`, không dùng `axios` trực tiếp
- [ ] Dùng `useAuth()`, không import `useAuthStore` trong component
- [ ] View mới khai báo `required_permission` nếu dùng `HasPermission`
- [ ] Route mới lồng trong `ProtectedRoute` + `RoleRoute` phù hợp
- [ ] Không hardcode `if user.role == "MANAGER"` trong backend — dùng `HasPermission`
