# 04 — Quy ước đặt tên & Wiring vào `worktracker_core/urls.py`

## Áp dụng "3 Quy tắc vàng để ghép code vô trùng 100%" cho `timesheets`

`timesheets` là app dùng chung với Đức Long — anh ấy đã có sẵn stub
`views_manager.py`/`urls_manager.py` (review log work, chưa code). Log Work
là hành động **riêng của Employee**, nên theo đúng quy tắc đã áp dụng ở
`accounts` (xem `project-roadmap/00-tong-quan.md`):

1. **Strict Naming**: class riêng 1 vai trò phải gắn tiền tố vai trò —
   `EmployeeLogWorkSerializer`, `EmployeeLogWorkView` (không đặt tên chung
   chung như `LogWorkSerializer`).
2. **Tách file vật lý theo vai trò**: `serializers_employee.py`,
   `views_employee.py`, `urls_employee.py` — song song với
   `views_manager.py`/`urls_manager.py` đã có, không đụng vào file của Đức
   Long.

## Code cuối cùng — `backend/timesheets/urls_employee.py`

```python
from django.urls import path

from .views_employee import EmployeeLogWorkView

urlpatterns = [
    path("log-works/", EmployeeLogWorkView.as_view(), name="employee_log_work_create"),
]
```

## Sự cố phát hiện ở `worktracker_core/urls.py`: dòng comment gõ dở

Trước khi wiring, file này có 1 dòng bị gõ dở (thiếu dấu `'` và `)` đóng):

```python
    # path('api/v1/employee/', include('timesheets.urls_employee
```

Không gây lỗi vì cả dòng nằm trong comment (`#`), nhưng nếu để nguyên và
lỡ tay bỏ dấu `#` sau này (ví dụ tìm-thay-thế hàng loạt) sẽ crash ngay do
thiếu ngoặc đóng. Nhân tiện sửa route cũng đổi luôn prefix — dòng cũ dùng
`api/v1/employee/`, không khớp với prefix `api/timesheets/` đã dùng cho
`urls_manager` ngay phía dưới.

## Quyết định: dùng chung 1 prefix `api/timesheets/` cho cả Employee lẫn Manager

Giống cách `accounts` dùng chung `api/auth/` cho cả `urls_auth`/`urls_admin`/
`urls_manager` (khác nhau ở path con bên trong file, không phải ở prefix
mount). `timesheets` áp dụng lại đúng mẫu này.

## Code cuối cùng — `backend/worktracker_core/urls.py` (phần liên quan)

```python
    # ================= EMPLOYEE =================
    # path('api/v1/employee/', include('tasks.urls_employee')),

    # ================= TIMESHEETS =================
    path('api/timesheets/', include('timesheets.urls_manager')),
    path('api/timesheets/', include('timesheets.urls_employee')),
```

2 `include()` cùng prefix là hợp lệ trong Django — `urlpatterns` của cả 2
file được ghép lại, miễn là path con bên trong (`log-works/` của Employee,
path review của Manager) không trùng nhau.

## Xác nhận route đã đăng ký đúng

```bash
python manage.py check
```
```text
System check identified no issues (0 silenced).
```

Duyệt resolver để in ra toàn bộ URL thật:

```bash
python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worktracker_core.settings')
django.setup()
from django.urls import get_resolver
def walk(patterns, prefix=''):
    for p in patterns:
        if hasattr(p, 'url_patterns'):
            walk(p.url_patterns, prefix + str(p.pattern))
        else:
            print(prefix + str(p.pattern))
walk(get_resolver().url_patterns)
" | grep timesheet
```
```text
api/timesheets/log-works/
```
