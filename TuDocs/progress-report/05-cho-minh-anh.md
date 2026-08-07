# 05 — Hướng dẫn tích hợp dành cho Minh Anh

> Đọc file `03-accounts-app-dung-chung.md` và `04-frontend-auth-kit.md` trước.
> File này chỉ nói về những việc **cụ thể** Minh Anh cần làm để tích hợp.

---

## Tóm tắt: những gì đã có sẵn cho Minh Anh dùng

| Thứ có sẵn | Cách dùng |
|-----------|-----------|
| Xác thực JWT | Tự động — mọi request qua `axiosClient` đều có token |
| `HasPermission` | `permission_classes = [HasPermission]` + `required_permission = "..."` |
| Redis `is_active` cache | Import `set_user_active_status` khi lock/unlock user |
| `CustomUser`, `Department`, `EmployeeProfile` models | Import từ `accounts.models` |
| Frontend: Zustand + Axios + RoleRoute | Import từ `hooks/useAuth`, `api/axiosClient` |
| Khung file: `views_admin.py`, `urls_admin.py` | Tự viết thêm vào đây |

---

## Việc 1 — 2 Migration cần viết ngay (Tuần 1, cả nhóm đang chờ)

Đây là ưu tiên số 1. Cả Tuấn Tú và Đức Long không thể implement đầy đủ LogWork API
và TimeLock API cho đến khi 2 migration này có mặt.

> **Trạng thái thật (đã kiểm tra 18/07):** `timesheets/migrations/` hiện chỉ có `0001_initial.py`
> — 2 migration dưới đây **chưa được viết**, đúng như mô tả "cả nhóm đang chờ".

### Migration 1: Thêm `job_id` vào `time_locks`

```python
# timesheets/migrations/0002_timelock_add_job.py
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('timesheets', '0001_initial'),
        ('jobs', '0001_initial'),   # phụ thuộc app jobs của Minh Anh
    ]
    operations = [
        migrations.AddField(
            model_name='timelock',
            name='job',
            field=models.ForeignKey(
                'jobs.Job',
                null=True,
                blank=True,
                on_delete=models.SET_NULL,
                related_name='time_locks',
                help_text="NULL = GLOBAL lock, có giá trị = JOB-scoped lock"
            ),
        ),
        # Xóa unique constraint cũ (lock_month, lock_year)
        migrations.RemoveConstraint(
            model_name='timelock',
            name='unique_lock_month_year',
        ),
        # Thêm unique constraint mới bao gồm job
        migrations.AddConstraint(
            model_name='timelock',
            constraint=models.UniqueConstraint(
                fields=['lock_month', 'lock_year', 'job'],
                name='unique_lock_month_year_job'
            ),
        ),
    ]
```

### Migration 2: Thêm `review_status` vào `log_works`

```python
# timesheets/migrations/0003_logwork_add_review_status.py
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('timesheets', '0002_timelock_add_job'),
    ]
    operations = [
        migrations.AddField(
            model_name='logwork',
            name='review_status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('PENDING', 'PENDING'),
                    ('APPROVED', 'APPROVED'),
                    ('REJECTED', 'REJECTED'),
                    ('VOIDED', 'VOIDED'),
                ],
                default='PENDING',
            ),
        ),
    ]
```

**Sau khi viết xong:** báo ngay cho Tuấn Tú và Đức Long, kèm tên migration file.

---

## Việc 2 — API Admin trong `accounts/views_admin.py`

File `views_admin.py` hiện có 1 view mẫu là `AdminDisableUserView`. Minh Anh viết thêm vào đây.

> **Source:** `accounts/views_admin.py:17` (`AdminDisableUserView`); hàm cache bắt buộc gọi
> khi enable/disable — `set_user_active_status` ở `accounts/authentication.py:47`.

### Pattern chuẩn cần tuân theo

```python
# accounts/views_admin.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from .permissions import HasPermission
from .authentication import set_user_active_status  # cần khi lock/unlock

User = get_user_model()

class AdminCreateUserView(APIView):
    permission_classes = [HasPermission]
    required_permission = "user:create"   # permission code đã seed

    def post(self, request):
        # logic tạo user
        ...

class AdminEnableUserView(APIView):
    permission_classes = [HasPermission]
    required_permission = "user:disable"  # dùng chung permission với disable

    def post(self, request, user_id):
        target_user = User.objects.filter(id=user_id).first()
        if target_user is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        target_user.is_active = True
        target_user.save()
        set_user_active_status(target_user.id, True)  # BẮT BUỘC — cập nhật Redis cache
        return Response({"detail": "User enabled"}, status=status.HTTP_200_OK)
```

### Danh sách API cần xây (Admin scope)

| Endpoint | Permission | Ghi chú |
|----------|-----------|---------|
| `POST /api/auth/user/` | `user:create` | Tạo user mới, gán role |
| `GET /api/auth/users/` | `user:view_all` | Danh sách toàn bộ user |
| `PATCH /api/auth/user/<id>/` | `user:update` | Sửa thông tin user |
| `POST /api/auth/user/<id>/enable/` | `user:disable` | Mở khóa tài khoản |
| `POST /api/auth/user/<id>/disable/` | `user:disable` | Đã có sẵn |
| `GET /api/auth/departments/` | `department:manage` | Danh sách phòng ban |
| `POST /api/auth/departments/` | `department:manage` | Tạo phòng ban |
| `PATCH /api/auth/departments/<id>/` | `department:manage` | Sửa phòng ban |
| `DELETE /api/auth/departments/<id>/` | `department:manage` | Xóa phòng ban |

> Nếu cần thêm permission mới (ví dụ `user:view_all`, `department:manage`), báo Tuấn Tú
> để tạo migration mới — không tự sửa migration `0002`.

---

## Việc 3 — TimeLock Admin API

Admin có quyền lock cả GLOBAL scope và JOB scope.
API này nằm trong app `timesheets` — nhưng Tuấn Tú cần phối hợp để Minh Anh biết cách gọi.

**Sau khi Tuấn Tú viết `POST /api/timesheets/time-locks/`**, Minh Anh chỉ cần gọi
từ Frontend Admin mà không cần tự viết endpoint.

### Lưu ý quan trọng khi xây UI Admin lock
Khi Admin bấm "Lock":
- Nếu lock GLOBAL → ảnh hưởng **tất cả nhân viên** toàn công ty tháng đó
- Nếu lock JOB → chỉ ảnh hưởng log work thuộc Job đó

UI Admin **phải hiển thị cảnh báo rõ ràng** trước khi confirm, đặc biệt với GLOBAL lock.

---

## Việc 4 — `log_audit_event()` (Tuần 3 của Minh Anh)

Minh Anh sẽ viết hàm `log_audit_event()` trong `audit/` app.

Khi xong, **báo ngay** Tuấn Tú và Đức Long với:
1. Chữ ký hàm: `log_audit_event(actor, action, table_name, record_id, old_values, new_values, request)`
2. Cách import: `from audit.utils import log_audit_event`
3. Ví dụ gọi thực tế 1-2 dòng

Tuấn Tú cần gọi vào các chỗ: tạo user, khóa tài khoản, đổi role, chốt timesheet.

---

## Việc 5 — Frontend Admin

### Bắt đầu từ `router/index.jsx`

Thay placeholder bằng layout thật:
```jsx
// Trước
{ path: '/admin', element: <div>Admin Dashboard</div> },

// Sau
import AdminLayout from '../components/admin/AdminLayout'
import AdminDashboard from '../components/admin/AdminDashboard'

{
    element: <RoleRoute allowedRoles={['ADMIN']} />,
    children: [
        {
            element: <AdminLayout />,
            children: [
                { path: '/admin', element: <AdminDashboard /> },
                { path: '/admin/clients', element: <ClientListPage /> },
                { path: '/admin/jobs', element: <JobListPage /> },
                { path: '/admin/users', element: <UserManagementPage /> },
                { path: '/admin/departments', element: <DepartmentPage /> },
                { path: '/admin/audit-logs', element: <AuditLogPage /> },
            ]
        }
    ]
}
```

### Import auth kit đúng cách
```jsx
import useAuth from '../../hooks/useAuth'
import axiosClient from '../../api/axiosClient'

// Trong component
const { user, hasPermission } = useAuth()
```

### Không tự viết lại login logic
Login, logout, refresh token — đã xong rồi. Chỉ dùng `useAuth().logout()` và `axiosClient`.

---

## Checklist tích hợp Minh Anh

- [ ] Viết migration thêm `job_id` vào `time_locks` (ưu tiên 1)
- [ ] Viết migration thêm `review_status` vào `log_works` (ưu tiên 1)
- [ ] Báo Tuấn Tú + Đức Long tên migration file khi xong
- [ ] Viết API Admin trong `accounts/views_admin.py` (class prefix `Admin...`)
- [ ] Nhớ gọi `set_user_active_status()` khi lock/unlock user
- [ ] Xây Frontend Admin dùng `axiosClient` + `useAuth()`
- [ ] Tuần 3: viết `log_audit_event()` + báo cả nhóm cách import
