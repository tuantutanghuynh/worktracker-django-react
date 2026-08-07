# 03 — 2 API mẫu: `AdminDisableUserView` & `ManagerTeamEmployeeListView`

## Vì sao chọn đúng 2 API này để minh họa

- **`AdminDisableUserView`** — chỉ cần Permission check thuần (ADMIN khóa tài
  khoản nhân viên, đúng tính năng Offboarding đã nói ở `auth-guide`). Admin
  được phép khóa **bất kỳ** nhân viên nào, không bị giới hạn phạm vi riêng
  — không cần Data Isolation.
- **`ManagerTeamEmployeeListView`** — cần **cả** Permission check **và** Data
  Isolation (Manager chỉ xem nhân viên phòng ban mình quản lý). Đây là ví
  dụ đầy đủ nhất, kết hợp cả 2 khái niệm trong cùng 1 API.

## Code cuối cùng — `backend/accounts/views_admin.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model

from .permissions import HasPermission

User = get_user_model()


class AdminDisableUserView(APIView):
    required_permission = "user:disable"
    permission_classes = [HasPermission]

    def post(self, request, user_id):
        target_user = User.objects.filter(id=user_id).first()
        if target_user is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        target_user.is_active = False
        target_user.save()
        return Response({"detail": "User disabled"}, status=status.HTTP_200_OK)
```

## Code cuối cùng — `backend/accounts/views_manager.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .permissions import HasPermission
from .models import EmployeeProfile


class ManagerTeamEmployeeListView(APIView):
    required_permission = "employee:view_team"
    permission_classes = [HasPermission]

    def get(self, request):
        employees = EmployeeProfile.objects.filter(department__manager=request.user)

        data = [
            {"id": e.user_id, "full_name": e.full_name, "department": e.department.name}
            for e in employees
        ]
        return Response(data, status=status.HTTP_200_OK)
```

(Lúc mới viết, cả 2 class này nằm chung 1 file `accounts/views.py` — sau
này tách riêng theo "3 Quy tắc vàng để ghép code vô trùng 100%", xem
`project-roadmap/00-tong-quan.md`.)

## Điểm mấu chốt của Data Isolation trong `ManagerTeamEmployeeListView`

```python
employees = EmployeeProfile.objects.filter(department__manager=request.user)
```

Lọc theo `request.user` — **lấy từ token đã xác thực**, không lấy từ query
param do client gửi lên. Một Manager dù sửa URL/params thế nào cũng không
lấy được dữ liệu phòng ban khác — đúng nguyên tắc "không tin Frontend" đã
học ở `auth-guide/04-rbac-and-data-isolation.md`.

## Routing — `backend/accounts/urls_admin.py` + `backend/accounts/urls_manager.py`

```python
# urls_admin.py
from .views_admin import AdminDisableUserView

urlpatterns = [
    path("user/<int:user_id>/disable/", AdminDisableUserView.as_view(), name="disable_user"),
]
```

```python
# urls_manager.py
from .views_manager import ManagerTeamEmployeeListView

urlpatterns = [
    path("team/employees/", ManagerTeamEmployeeListView.as_view(), name="team_employee"),
]
```

(Lúc mới viết, 2 route này nằm chung 1 file `accounts/urls.py` — sau này
tách riêng theo vai trò, đồng thời `worktracker_core/urls.py` cũng đổi
sang `include()` trực tiếp từng file `urls_<role>.py`.)

`<int:user_id>` là path parameter — Django tự truyền giá trị lấy từ URL
vào tham số cùng tên `user_id` trong `def post(self, request, user_id)`.
`ManagerTeamEmployeeListView` không cần path parameter vì không có gì cần lấy từ
URL — toàn bộ thông tin "ai đang gọi" đã có sẵn trong `request.user`.

## Các lỗi đã gặp khi viết 2 View này

### 1. Quên import `HasPermission`

```python
permission_classes = [HasPermission]   # gạch vàng: chưa import
```

Thiếu `from .permissions import HasPermission` — Pylance báo ngay trong
editor (gạch vàng, khác gạch đỏ của lỗi cú pháp, nhưng vẫn là vấn đề thật:
tên chưa được định nghĩa trong file).

### 2. Quên import `User` model

Thân hàm dùng `User.objects.filter(...)` nhưng chưa có
`from django.contrib.auth import get_user_model` + `User = get_user_model()`
— đúng cách đã làm ở `serializers_auth.py`, dùng `get_user_model()` thay vì
import trực tiếp `CustomUser` để code không phụ thuộc cứng vào tên model.

### 3. Ba lỗi gõ thiếu chữ trên cùng 1 dòng

```python
employees = EmployeeProfile.object.filer(deparment__manager=request.user)
```

| Sai | Đúng | Hậu quả |
|---|---|---|
| `EmployeeProfile` chưa import | `from .models import EmployeeProfile` | `NameError` |
| `.object` | `.objects` (thiếu "s") | `AttributeError` |
| `.filer(` | `.filter(` (thiếu "t") | `AttributeError` |
| `deparment__manager` | `department__manager` (thiếu "t") | `FieldError: Cannot resolve keyword 'deparment'` |

Đáng chú ý: nếu chỉ sửa lỗi import mà không soát kỹ phần còn lại của dòng,
3 lỗi gõ thiếu chữ tiếp theo sẽ lộ ra **lần lượt** qua nhiều lần chạy thử —
mỗi lần sửa 1 lỗi lại gặp lỗi tiếp theo trên cùng dòng. Bài học: khi thấy 1
dòng có vẻ "khả nghi" (nhiều từ khóa lạ), nên soát toàn bộ dòng 1 lần, không
chỉ sửa từng lỗi một cách rời rạc.
