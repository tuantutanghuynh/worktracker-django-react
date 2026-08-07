# 05 — API list + mark-as-read notification (ĐỀ XUẤT, chưa áp dụng)

⚠️ Khác các file trước, phần này **chưa được gõ vào code** tính đến cuối
ngày 22/07 — chỉ mới đưa code mẫu, người học chưa xác nhận "đã xong". Ghi
lại ở đây để không mất phần thiết kế đã thống nhất, làm tiếp trong phiên
sau bắt đầu ngay từ đây, không cần thiết kế lại.

## Vì sao đặt trong app `system`, không phải `accounts`/`timesheets`

Model `Notification` sống trong `system/models.py` (không có app
`notifications` riêng như `project-roadmap` giả định ban đầu — đã đổi khi
merge, xem `00-tong-quan.md`). Theo đúng convention `views_<role>.py` +
`urls_<role>.py` đã dùng khắp nơi, thêm cặp `views_employee.py`/
`urls_employee.py` vào app `system`, cạnh `views_admin.py` đã có sẵn.

## Vì sao dùng `IsAuthenticated`, không phải `HasPermission`

Thông báo là dữ liệu của riêng mỗi user, không phân biệt role (Admin/
Manager/Employee ai cũng nhận notification) — không cần seed permission
theo role, chỉ cần lọc theo `request.user` để cô lập dữ liệu. Giống cách
`ChangePasswordView` đã làm (xem `auth-guide`).

## Thiết kế: chỉ List + mark-as-read, không có create/update/delete

Notification chỉ được tạo qua `notify()` (service layer), không qua API
trực tiếp — nên dùng `GenericViewSet` + `ListModelMixin` (không phải
`ModelViewSet`) để không vô tình mở endpoint tạo/sửa/xoá không nên tồn tại.

## Code đề xuất

`backend/system/serializers_employee.py` (file mới):
```python
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "event_type", "title", "content", "related_url", "is_read", "created_at"]
        read_only_fields = fields
```

`backend/system/views_employee.py` (file mới):
```python
from rest_framework import mixins, viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers_employee import NotificationSerializer


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")

    @action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(self.get_serializer(notification).data, status=status.HTTP_200_OK)
```

Data Isolation cho mark-as-read: `get_object()` tự lọc qua `get_queryset()`
— mark-as-read notification của người khác tự trả 404, không cần check tay.

`backend/system/urls_employee.py` (file mới):
```python
from rest_framework.routers import DefaultRouter
from .views_employee import NotificationViewSet

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
```

`backend/worktracker_core/urls.py` — thêm 1 dòng:
```python
path('api/', include('system.urls_employee')),
```

## Việc cần làm khi quay lại

1. Gõ 3 file mới + 1 dòng route.
2. `manage.py check` + smoke test curl (401 khi chưa auth, giống các route
   khác trong ngày).
3. Cân nhắc (chưa quyết định): có cần endpoint riêng đếm số chưa đọc
   (`unread-count`) cho icon chuông ở Frontend Tuần 4, hay filter
   `?is_read=false` trên list là đủ — quyết định khi bắt đầu code Frontend
   Notification Center, không cần quyết trước.
