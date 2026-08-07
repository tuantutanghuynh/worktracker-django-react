# 01 — Notification API: thực thi khác đề xuất, và 1 bug route trùng lặp

## Vì sao thiết kế cuối cùng khác đề xuất ở giai-doan-4-log/05

Đề xuất trước đó dùng `GenericViewSet + ListModelMixin` + `DefaultRouter` +
`@action` cho mark-as-read (đóng gói 2 hành vi vào 1 ViewSet). Khi thực thi
lại chọn **2 `APIView` thuần** (`NotificationListView`,
`NotificationMarkReadView`) tách riêng, vì:

- Toàn bộ view Employee khác trong project (`EmployeeLogWorkView`,
  `EmployeeVoidLogWorkView`, `ManagerTeamEmployeeListView`) đều là `APIView`
  đơn giản, không dùng ViewSet/Router — chọn nhất quán với pattern có sẵn
  thay vì đưa thêm 1 kiểu tổ chức code mới vào cùng 1 app.
- Chỉ có đúng 2 hành động (list, mark 1 cái đã đọc) — không đủ lớn để cần
  bộ máy Router.

Khác biệt khác: bỏ field `"type"` (kênh phân phối: SYSTEM_ONLY/EMAIL_ONLY/
ALL) khỏi `NotificationSerializer` so với đề xuất — Frontend không cần biết
notification được gửi qua kênh nào, chỉ cần nội dung + trạng thái đã đọc.

## Code cuối cùng

`backend/system/serializers_employee.py`:
```python
from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "event_type", "title", "content",
            "related_url", "is_read", "created_at",
        ]
        read_only_fields = fields
```

`backend/system/views_employee.py`:
```python
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import Notification
from .serializers_employee import NotificationSerializer


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(
            user=request.user
        ).order_by("-created_at")

        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        notification = get_object_or_404(
            Notification, id=notification_id, user=request.user
        )

        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response(
            NotificationSerializer(notification).data, status=status.HTTP_200_OK
        )
```

Giống đề xuất cũ: `IsAuthenticated` (không phải `HasPermission`) vì thông
báo là dữ liệu riêng mỗi user, không phân theo role — và data isolation
bằng ownership check (`get_object_or_404(..., user=request.user)`) chống 1
Employee mark-as-read thông báo của người khác (404, không phải 403 —
không tiết lộ record có tồn tại hay không, cùng nguyên tắc đã dùng ở
`EmployeeVoidLogWorkView`).

## Bug thật gặp phải: route trùng `api/notifications/notifications/`

Lần đầu wire route:

```python
# system/urls_employee.py (SAI)
urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification_list"),
    path(
        "notifications/<int:notification_id>/read/",
        NotificationMarkReadView.as_view(),
        name="notification_mark_read",
    ),
]
```

```python
# worktracker_core/urls.py
path('api/notifications/', include('system.urls_employee')),
```

2 mảnh nhìn riêng đều hợp lý, nhưng ráp lại thành `api/notifications/` +
`notifications/` = `/api/notifications/notifications/`. Phát hiện qua
Swagger UI (`/api/docs/`) khi soi danh sách endpoint thật — không phải đọc
code tay, vì đọc từng file riêng lẻ rất dễ bỏ sót kiểu lỗi ráp-2-mảnh này.

**Sửa**: vì prefix ngoài đã là `api/notifications/`, path bên trong không
cần lặp lại tên resource:

```python
urlpatterns = [
    path("", NotificationListView.as_view(), name="notification_list"),
    path(
        "<int:notification_id>/read/",
        NotificationMarkReadView.as_view(),
        name="notification_mark_read",
    ),
]
```

Kết quả đúng: `GET /api/notifications/`, `PATCH /api/notifications/{id}/read/`.

## Verify — test thật bằng curl, không chỉ `manage.py check`

Trình tự đã chạy thật (tài khoản `admin@worktracker.com`, DB
`worktracker_db` qua Postgres cổng 5432 — có 1 lần lạc đường vào nhầm
Postgres khác ở cổng 5433 trong DBeaver, phải tạo lại connection đúng):

1. `POST /api/auth/login/` → lấy `access` token.
2. `GET /api/notifications/` → `[]` (đúng, chưa có notification nào).
3. Tạo 1 notification qua `manage.py shell`:
   ```python
   from django.contrib.auth import get_user_model
   from system.services.notification_manager_service import notify

   User = get_user_model()
   me = User.objects.get(email="admin@worktracker.com")

   notify(recipients=[me], event_type="LOG_WORK_APPROVED", title="Test notification")
   ```
4. `GET /api/notifications/` → thấy 1 object, `"is_read": false`.
5. `PATCH /api/notifications/1/read/` → trả về đúng object, `"is_read": true`.
6. `GET /api/notifications/` lần nữa → xác nhận `"is_read": true` **bền
   vững** (không chỉ đúng ở response tạm thời của PATCH).

Cả 6 bước pass. **Nợ lại**: chưa test case "mark-as-read thông báo của
người khác" (kỳ vọng 404) — cần 2 tài khoản thật để test, chưa có sẵn lúc
làm phần này.
