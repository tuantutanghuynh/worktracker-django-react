# 03 — App `accounts`: Quy tắc Dùng chung

> App `accounts` là app dùng chung của cả 3 người.
> File này giải thích cấu trúc file, ai được phép sửa file nào,
> và cách thêm code mà không đụng vào phần của người khác.

---

## Cấu trúc file hiện tại

> **Đã đối chiếu với repo thật (18/07):** toàn bộ file bên dưới đều tồn tại đúng như liệt kê,
> trừ `views_employee.py`/`serializers_employee.py`/`urls_employee.py` **trong app `accounts`**
> — 3 file này chưa tồn tại (mới là kế hoạch Tuần 2). Lưu ý: tên file trùng đã tồn tại nhưng
> nằm ở app khác — `backend/timesheets/views_employee.py:15` (`EmployeeLogWorkView`).

```
accounts/
├── models.py               ← Tuấn Tú giữ — KHÔNG ĐƯỢC SỬA khi chưa hỏi
├── authentication.py       ← Tuấn Tú giữ — KHÔNG ĐƯỢC SỬA
├── permissions.py          ← Tuấn Tú giữ — KHÔNG ĐƯỢC SỬA
├── redis_client.py         ← Tuấn Tú giữ — KHÔNG ĐƯỢC SỬA
│
├── serializers_auth.py     ← Tuấn Tú (Login, Logout, Forgot/Reset/Change Password)
├── views_auth.py           ← Tuấn Tú (LoginView, LogoutView, ForgotPasswordView...)
├── urls_auth.py            ← Tuấn Tú (route /api/auth/login/, /logout/, /refresh/...)
│
├── views_admin.py          ← Minh Anh viết vào đây (AdminDisableUserView đã có làm mẫu — L17)
├── serializers_admin.py    ← Minh Anh tự tạo khi cần
├── urls_admin.py           ← Minh Anh viết route vào đây (route mẫu ở L7)
│
├── views_manager.py        ← Đức Long viết vào đây (ManagerTeamEmployeeListView đã có làm mẫu — L15)
├── urls_manager.py         ← Đức Long viết route vào đây (route mẫu ở L7)
│
├── views_employee.py       ← Tuấn Tú (Profile API — Tuần 2)
├── serializers_employee.py ← Tuấn Tú (ProfileSerializer — Tuần 2)
├── urls_employee.py        ← Tuấn Tú (route /api/employee/profile/ — Tuần 2)
│
└── migrations/
    ├── 0001_initial.py
    ├── 0002_seed_roles_permissions.py
    ├── 0003_add_employee_view_permission.py
    └── 0004_customuser_must_change_password.py
```

---

## Quy tắc 1: Tiền tố class

Mọi class trong file của mình phải gắn tiền tố role:

| File | Tiền tố bắt buộc | Ví dụ |
|------|-----------------|-------|
| `views_admin.py` | `Admin...` | `AdminCreateUserView`, `AdminListDepartmentView` |
| `views_manager.py` | `Manager...` | `ManagerAssignDepartmentView` |
| `views_employee.py` | `Employee...` | `EmployeeProfileView` |

Lý do: khi nhiều người đang mở cùng file, tiền tố giúp biết ngay class nào của ai.

---

## Quy tắc 2: File nào dùng chung, file nào sở hữu riêng

### File ai cũng có thể đọc (import từ đây):
```python
from accounts.permissions import HasPermission          # dùng trong mọi view
from accounts.authentication import set_user_active_status  # Minh Anh cần khi lock/unlock user
from accounts.authentication import invalidate_user_active_status  # Minh Anh cần khi unlock
from accounts.models import CustomUser, Department, EmployeeProfile  # mọi người đọc
```

### File chỉ được viết thêm, KHÔNG XÓA/SỬA code cũ:
- `worktracker_core/urls.py` — mỗi người chỉ thêm route vào **khu vực của mình**

### File tuyệt đối không được đụng (trừ Tuấn Tú):
- `accounts/models.py`
- `accounts/authentication.py`
- `accounts/permissions.py`
- `accounts/redis_client.py`

---

## Quy tắc 3: Thêm permission mới

Nếu Minh Anh hoặc Đức Long cần thêm permission mới (ví dụ `department:manage`):

**KHÔNG** tự sửa migration `0002` hoặc `0003` đã chạy.

**Thay vào đó:** báo Tuấn Tú, Tuấn Tú tạo migration mới:
```python
# accounts/migrations/0005_add_department_permission.py
operations = [
    migrations.RunPython(seed_department_permission)
]
```

---

## URL Routing — `worktracker_core/urls.py`

> **Source thật:** `worktracker_core/urls.py:21-41`. Lưu ý: bản thật hiện đã có thêm
> `path('api/timesheets/', include('timesheets.urls_manager'))` và `urls_employee` (L40-41)
> — chưa được ghi trong khối mẫu bên dưới, vì đây là route mới thêm sau khi doc này viết.

```python
urlpatterns = [
    path('admin/', admin.site.urls),

    # ===== Tuấn Tú — Auth chung mọi role =====
    path('api/auth/', include('accounts.urls_auth')),

    # ===== Minh Anh — ADMIN =====
    path('api/auth/', include('accounts.urls_admin')),

    # ===== Đức Long — MANAGER =====
    path('api/auth/', include('accounts.urls_manager')),

    # ===== Tuấn Tú — EMPLOYEE (Tuần 2) =====
    # path('api/employee/', include('accounts.urls_employee')),
]
```

Mỗi người chỉ `include()` thêm vào **khu vực mình**, không sửa khu vực người khác.

---

## Ví dụ đầy đủ: Minh Anh muốn thêm API tạo User mới

**Bước 1:** Viết vào `accounts/views_admin.py`:
```python
from .permissions import HasPermission
from .models import CustomUser, Role

class AdminCreateUserView(APIView):
    permission_classes = [HasPermission]
    required_permission = "user:create"

    def post(self, request):
        # ... logic tạo user
        pass
```

**Bước 2:** Thêm route vào `accounts/urls_admin.py`:
```python
from .views_admin import AdminCreateUserView, AdminDisableUserView

urlpatterns = [
    path("user/<int:user_id>/disable/", AdminDisableUserView.as_view(), name="admin_disable_user"),
    path("user/create/", AdminCreateUserView.as_view(), name="admin_create_user"),
]
```

**Bước 3:** KHÔNG sửa `worktracker_core/urls.py` — route `api/auth/` đã `include('accounts.urls_admin')` rồi,
route mới sẽ tự động có ở `POST /api/auth/user/create/`.

**Bước 4 (nếu cần permission mới):** Nhắn Tuấn Tú thêm `"user:create"` vào migration.

---

## Lưu ý: `set_user_active_status` và cache is_active

> **Source:** `set_user_active_status`/`invalidate_user_active_status` —
> `accounts/authentication.py:47`/`L52`.

Khi Minh Anh viết API lock/unlock tài khoản, **bắt buộc phải** gọi hàm cache:

```python
from accounts.authentication import set_user_active_status, invalidate_user_active_status

# Khi khóa user
target_user.is_active = False
target_user.save()
set_user_active_status(target_user.id, False)  # ← BẮT BUỘC

# Khi mở khóa user
target_user.is_active = True
target_user.save()
set_user_active_status(target_user.id, True)   # ← BẮT BUỘC
```

**Nếu không gọi:** cache còn 5 phút cũ → user bị khóa vẫn truy cập được API thêm tối đa 5 phút.
Đây không phải bug nghiêm trọng nhưng không đúng với NFR-04 (khóa có hiệu lực ngay).
