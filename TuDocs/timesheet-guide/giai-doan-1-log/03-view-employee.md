# 03 — `EmployeeLogWorkView`: View mỏng + RBAC

## Vì sao View gần như không có logic gì

Toàn bộ nghiệp vụ (validate hours_spent, check data isolation, gắn user)
đã nằm ở `EmployeeLogWorkSerializer` (file `02`). View chỉ còn 3 việc: nhận
request, giao cho serializer, trả response — đúng pattern "thin view" đã
dùng ở `LoginView`/`ResetPasswordView` trong `accounts/views_auth.py`. Tách
rõ như vậy giúp test serializer độc lập (không cần dựng request thật) và
giữ View dễ đọc dù sau này thêm nhiều action khác (Time Lock check, review...).

## Code cuối cùng — `backend/timesheets/views_employee.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from accounts.permissions import HasPermission
from .serializers_employee import EmployeeLogWorkSerializer


class EmployeeLogWorkView(APIView):
    permission_classes = [HasPermission]
    required_permission = "timesheet:create"

    def post(self, request):
        serializer = EmployeeLogWorkSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        log_work = serializer.save()

        return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_201_CREATED)
```

## Vì sao `required_permission` là class attribute, không phải biến trong `__init__`

`HasPermission` (đã code từ Giai đoạn 3 của `auth-guide`, xem
`accounts/permissions.py`) đọc quyền cần thiết bằng:

```python
required_code = getattr(view, "required_permission", None)
```

`getattr` đọc thẳng attribute ở **cấp class**, được gọi trước cả khi
method `post()` chạy — vì DRF cần biết quyền cần kiểm tra *trước khi* vào
tới logic xử lý request. Nếu khai báo `self.required_permission = ...` bên
trong `__init__`/`post()`, `HasPermission.has_permission()` sẽ không đọc
được (nó nhận `view` là class instance vừa khởi tạo, chạy `has_permission()`
trước khi `post()` được gọi tới).

## Vì sao dùng permission code có sẵn `timesheet:create`, không tạo migration mới

Đã kiểm tra `accounts/migrations/0002_seed_roles_permissions.py` — permission
`timesheet:create` đã được seed sẵn cho role `EMPLOYEE` từ trước (cùng đợt
với `task:view_own`, `task:update_own`, `timesheet:update_own`). Không cần
viết migration mới cho bước này — chỉ cần *dùng lại* đúng code permission đã
có, tránh sinh thêm permission trùng ý nghĩa.

## Vì sao trả `EmployeeLogWorkSerializer(log_work).data`, không trả `serializer.data`

Sau khi `serializer.save()` chạy xong, `serializer.data` (từ instance ban
đầu, được khởi tạo với `data=request.data`) đôi khi không phản ánh đúng giá
trị đã thật sự lưu vào DB (ví dụ field có `default` do DB sinh, hoặc
`auto_now_add`). Serialize lại object `log_work` vừa `.save()` trả về đảm
bảo response luôn khớp với dữ liệu thật trong DB — bao gồm cả `id` do DB tự
sinh, thứ mà request gửi lên không hề có.
