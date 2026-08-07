# 06 — Hướng dẫn tích hợp dành cho Đức Long

> Đọc file `03-accounts-app-dung-chung.md` và `04-frontend-auth-kit.md` trước.
> File này chỉ nói về những việc **cụ thể** Đức Long cần làm để tích hợp.

---

## Tóm tắt: những gì đã có sẵn cho Đức Long dùng

| Thứ có sẵn | Cách dùng |
|-----------|-----------|
| Xác thực JWT | Tự động — mọi request đều qua `WorkTrackerJWTAuthentication` |
| `HasPermission` | `permission_classes = [HasPermission]` + `required_permission` |
| `ManagerTeamEmployeeListView` | `GET /api/auth/team/employees/` — đã chạy được |
| `notify()` | Tuần 2 Tuấn Tú cung cấp — dùng để bắn thông báo cho Employee |
| Frontend auth kit | `useAuth()`, `axiosClient`, `ProtectedRoute`, `RoleRoute` |
| Khung file | `accounts/views_manager.py`, `accounts/urls_manager.py` |

---

## API đã có sẵn — dùng ngay không cần code thêm

### `GET /api/auth/team/employees/`

> **Source:** `accounts/views_manager.py:15` (`ManagerTeamEmployeeListView`) + `accounts/urls_manager.py:7`.

Trả danh sách employee trong department mà Manager đang quản lý.

```bash
curl -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8000/api/auth/team/employees/
```

Response:
```json
[
    {"id": 2, "full_name": "Nguyễn Văn A", "department": "Backend Team"},
    {"id": 3, "full_name": "Trần Thị B", "department": "Backend Team"}
]
```

**Data isolation đã được tích hợp sẵn:** Manager chỉ thấy employee trong team mình,
không cần truyền `department_id` trong query param — server tự filter theo `request.user`.

---

## Việc 1 — Thêm API Manager trong `accounts/views_manager.py`

Nếu Đức Long cần thêm API Manager-side trong app `accounts` (ví dụ: gán department cho nhân viên),
viết vào `views_manager.py` với class prefix `Manager...`.

```python
# accounts/views_manager.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .permissions import HasPermission
from .models import EmployeeProfile, Department

class ManagerAssignDepartmentView(APIView):
    permission_classes = [HasPermission]
    required_permission = "manager:assign_department"

    def post(self, request, employee_id):
        department_id = request.data.get("department_id")
        profile = EmployeeProfile.objects.filter(user_id=employee_id).first()
        if not profile:
            return Response({"detail": "Employee not found"}, status=404)

        # Data isolation: chỉ được gán vào department thuộc manager mình quản lý
        department = Department.objects.filter(
            id=department_id, manager=request.user
        ).first()
        if not department:
            return Response({"detail": "Department not found or not in your scope"}, status=404)

        profile.department = department
        profile.save()
        return Response({"detail": "Department assigned"}, status=200)
```

---

## Việc 2 — Timesheets: Review LogWork

API review log work (`PATCH /api/timesheets/log-works/<id>/review/`) sẽ nằm trong app `timesheets`.

### Thống nhất với Tuấn Tú về cấu trúc file trước khi code

Vì `timesheets` thuộc về Tuấn Tú, cần xác nhận cách chia file:

**Phương án A (đề xuất):** Tuấn Tú tạo khung sẵn `timesheets/views_manager.py` + `urls_manager.py` giống pattern `accounts/` — Đức Long viết vào đó.

**Phương án B:** Tuấn Tú viết luôn endpoint review (vì logic thay đổi `review_status` của bảng Tuấn Tú), Đức Long chỉ viết Frontend gọi vào.

→ **Cần xác nhận với Tuấn Tú trước Tuần 2.**

### Format API review (đã xác định trong roadmap)
```
PATCH /api/timesheets/log-works/<id>/review/
Authorization: Bearer <manager_token>
Body:
{
    "action": "approve",   // hoặc "reject", "void"
    "note": "Lý do từ chối"   // bắt buộc khi action = "reject"
}
```

Response thành công:
```json
{"detail": "Log work approved"}
```

---

## Việc 3 — `notify()` sẽ có sẵn từ Tuần 2

Sau khi Tuấn Tú viết xong Notification Hub, Đức Long gọi hàm này khi:
- Manager approve task → bắn notification cho Employee
- Manager reject task → bắn notification kèm lý do
- Manager approve/reject/void log work → bắn notification

### Cách dùng (sẽ xác nhận khi Tuấn Tú deploy)

> **Source:** `notifications/utils.py:4` — `def notify(user, title, type, content=None, related_url=None)`.
> Đã tồn tại và khớp với ví dụ dưới (gọi bằng keyword argument nên thứ tự tham số không ảnh hưởng).

```python
from notifications.utils import notify

# Trong API duyệt task
notify(
    user=task.assignee,
    type="TASK_APPROVED",
    title="Task của bạn đã được duyệt",
    content=f"Task '{task.title}' đã hoàn thành.",
    related_url=f"/emp/tasks/{task.id}"
)
```

**Lưu ý:** Đây là synchronous call ghi vào DB. Email gửi qua Celery task riêng (Tuần 2–3).
Gọi `notify()` là đủ — không cần tự gửi email.

---

## Việc 4 — Data Isolation: CRITICAL cho mọi API Manager

**Nguyên tắc vàng:** Manager chỉ được thấy và tác động dữ liệu trong **scope của mình**.

Scope của Manager = các Job mà `job.manager_id = request.user.id`.

```python
# SAI — Manager thấy tất cả task trong hệ thống
tasks = Task.objects.all()

# ĐÚNG — Manager chỉ thấy task trong job của mình
tasks = Task.objects.filter(job__manager=request.user)
```

```python
# SAI — Manager thấy log work của mọi người
log_works = LogWork.objects.filter(work_date=date)

# ĐÚNG — Manager chỉ thấy log work thuộc job mình quản lý
log_works = LogWork.objects.filter(task__job__manager=request.user)
```

**Không bao giờ tin tham số từ client:** `?manager_id=2` không có nghĩa Manager đó được xem,
phải luôn dùng `request.user` để filter.

---

## Việc 5 — Django Channels (WebSocket)

Đức Long setup hạ tầng WebSocket từ Tuần 1 để Notification Hub của Tuấn Tú dùng.

Sau khi Tuấn Tú implement Notification Hub (Tuần 2), cần phối hợp để:
1. `notify()` call có thể đẩy event vào WebSocket channel của user
2. Frontend Employee nhận thông báo real-time qua WebSocket

Xác nhận schema WebSocket event với Tuấn Tú trước khi implement.

---

## Việc 6 — Frontend Manager

### Bắt đầu từ `router/index.jsx`

```jsx
{
    element: <RoleRoute allowedRoles={['MANAGER']} />,
    children: [
        {
            element: <ManagerLayout />,
            children: [
                { path: '/manager', element: <ManagerDashboard /> },
                { path: '/manager/tasks', element: <KanbanBoard /> },
                { path: '/manager/team', element: <TeamDirectory /> },
                { path: '/manager/timesheets', element: <TimesheetReview /> },
            ]
        }
    ]
}
```

### API `GET /api/auth/team/employees/` — dùng ngay

```jsx
import axiosClient from '../../api/axiosClient'

// Trong TeamDirectory component
const [employees, setEmployees] = useState([])

useEffect(() => {
    axiosClient.get('/api/auth/team/employees/')
        .then(res => setEmployees(res.data))
}, [])
```

---

## Checklist tích hợp Đức Long

- [ ] Đọc `03-accounts-app-dung-chung.md` — nắm quy tắc file
- [ ] Đọc `04-frontend-auth-kit.md` — biết cách dùng auth kit
- [ ] Setup Django Channels từ Tuần 1 — cả nhóm cần hạ tầng này
- [ ] Xác nhận với Tuấn Tú về cấu trúc `timesheets/views_manager.py` trước Tuần 2
- [ ] Chờ Minh Anh merge migration `review_status` trước khi code workflow review
- [ ] Dùng `notify()` khi approve/reject task và log work (Tuần 2 trở đi)
- [ ] Mọi query đều filter theo `request.user` (data isolation)
- [ ] Frontend: dùng `axiosClient` + `useAuth()`, không tự viết lại
