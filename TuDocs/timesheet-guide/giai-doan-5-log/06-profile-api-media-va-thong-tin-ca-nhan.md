# 06 — Profile API Giai đoạn 1-2: setup media, sửa full_name/phone_number, 2 bug thật

Phần P6.0 (Profile Management) của roadmap, làm sau khi Notification API +
Celery đã xong (xem [00-tong-quan.md](00-tong-quan.md)). Chia 3 giai đoạn
nhỏ đã thống nhất trước khi code: (1) setup hạ tầng media, (2) sửa
`full_name`/`phone_number`, (3) upload avatar (file [07](07-profile-api-avatar-upload.md)).

## Giai đoạn 1 — Setup `MEDIA_ROOT`/`MEDIA_URL`

Project **chưa có** cấu hình media trước đó (khác `STATIC_URL` đã có sẵn từ
đầu) — avatar là file người dùng tải lên lúc runtime, cần cơ chế lưu trữ
riêng, tách biệt hoàn toàn với static assets.

`worktracker_core/settings.py` (thêm dưới `STATIC_URL`):
```python
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

`worktracker_core/urls.py` (thêm import + khối cuối file):
```python
from django.conf import settings
from django.conf.urls.static import static
...
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

`runserver` ở dev **không tự phục vụ** media như nó tự làm với static files
— phải khai báo tường minh, và chỉ bật khi `DEBUG=True` (production thật
serve file qua Nginx/S3, không bao giờ để Django tự làm).

## Giai đoạn 2 — API sửa `full_name`/`phone_number`

3 file mới theo đúng convention `serializers_<role>.py`/`views_<role>.py`/
`urls_<role>.py`: `accounts/serializers_employee.py`,
`accounts/views_employee.py`, `accounts/urls_employee.py` (app `accounts`
**chưa có** bộ 3 file `_employee` trước đó, chỉ có `_auth`/`_admin`/`_manager`).

```python
# accounts/serializers_employee.py
class EmployeeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeProfile
        fields = ["full_name", "phone_number", "department", "avatar_url", "joined_date"]
        read_only_fields = ["department", "avatar_url", "joined_date"]
```

```python
# accounts/views_employee.py
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = get_object_or_404(EmployeeProfile, user=request.user)
        serializer = EmployeeProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile = get_object_or_404(EmployeeProfile, user=request.user)
        serializer = EmployeeProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
```

`partial=True` bắt buộc ở `patch()` — PATCH nghĩa là sửa 1 phần, client chỉ
gửi `{"phone_number": "..."}` mà không cần gửi `full_name`. `IsAuthenticated`
(không phải `HasPermission`) — xem/sửa hồ sơ chính mình là quyền mặc định
mọi role, không phải RBAC theo role.

## Bug thật #1 — Gõ đè lên file `system/serializers_employee.py` đã có sẵn

Lúc hướng dẫn tạo `accounts/serializers_employee.py` (file mới), người học
lại mở nhầm **file đã tồn tại** `system/serializers_employee.py` (chứa
`NotificationSerializer` từ tính năng trước, đã commit) và gõ đè nội dung
`EmployeeProfileSerializer` vào đó. Hậu quả 2 tầng:

1. `NotificationSerializer` biến mất — `system/views_employee.py` (Notification
   API) sẽ vỡ ngay vì import thất bại.
2. Nội dung mới cũng **sai theo**: `from .models import EmployeeProfile` bên
   trong `system/serializers_employee.py` sẽ tìm `EmployeeProfile` ở
   `system/models.py` — model đó thực ra nằm ở `accounts/models.py` — ném
   `ImportError` ngay khi Django load.

**Sửa**: vì file bị đè đã commit trước đó (`8351ebb`), khôi phục an toàn
bằng `git checkout -- backend/system/serializers_employee.py` (không đoán
lại nội dung tay), rồi tạo **đúng** file mới ở `accounts/serializers_employee.py`.

**Bài học**: khi 2 app khác nhau có file trùng tên (`system/serializers_employee.py`
và `accounts/serializers_employee.py` đều tồn tại hợp lệ, độc lập nhau) —
luôn xác nhận rõ **đường dẫn đầy đủ** trước khi mở/sửa, tên file một mình
không đủ để xác định đúng chỗ.

## Bug thật #2 — Không xử lý user không có `EmployeeProfile`

`ProfileView` ban đầu viết `request.user.profile` (truy cập trực tiếp qua
quan hệ `OneToOneField` ngược). Test thử với `admin@worktracker.com` (role
ADMIN) phát hiện: **không phải mọi `CustomUser` đều có `EmployeeProfile`** —
hồ sơ chỉ tạo cho Employee thật, `create_user()` không tự tạo kèm. Vì
`ProfileView` dùng `IsAuthenticated` (mọi role gọi được), Admin/Manager gọi
nhầm endpoint này sẽ khiến `request.user.profile` ném
`RelatedObjectDoesNotExist` — không được bắt, crash HTTP 500 lộ traceback.

**Sửa**: thay `request.user.profile` bằng
`get_object_or_404(EmployeeProfile, user=request.user)` — cùng pattern đã
dùng ở `EmployeeVoidLogWorkView` (`giai-doan-4-log`) — không tìm thấy thì
DRF tự trả 404 sạch (`{"detail": "Not found."}`), không phải 500 crash.

## Verify — test thật bằng curl (không chỉ `manage.py check`)

| # | Test | Kỳ vọng | Kết quả |
|---|------|---------|:---:|
| 1 | GET với `admin@worktracker.com` (không có profile) | `404` sạch | ✅ |
| 2 | GET với `employee@worktracker.com` (có profile) | `200`, đủ 5 field | ✅ |
| 3 | PATCH `{"phone_number": "0901234567"}` | `200`, `full_name` giữ nguyên | ✅ |
| 4 | GET lại lần cuối | `phone_number` vẫn đổi — persist bền vững | ✅ |

Commit: `9154a53` — "Add media file serving and a self-service profile API
for employees to view/edit their name and phone number."
