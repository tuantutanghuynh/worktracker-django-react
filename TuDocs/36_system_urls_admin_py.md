# Executive Code Annotation: `backend/system/urls_admin.py`

**Package / Module:** `backend.system.urls_admin` · System Admin Endpoint Routing Central

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (bản đồ chỉ đường, bảng phân luồng giao thông, biển chỉ dẫn...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Định Tuyền API Trang Quản Trị (Admin Routing Architecture Diagram)

```
                            HTTP Request từ Admin Client
                                      │
                                      ▼
                        backend/system/urls_admin.py
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        router.register('audit-logs')             path('dashboard/')
                   │                                     │
                   ▼                                     ▼
         ┌───────────────────┐                 ┌───────────────────┐
         │ AuditLogViewSet   │                 │   DashboardView   │
         └─────────┬─────────┘                 └─────────┬─────────┘
                   │                                     │
       ┌───────────┴───────────┐                         │
       ▼                       ▼                         ▼
GET /audit-logs/       GET /audit-logs/{id}/   GET /dashboard/
(Danh sách nhật ký)    (Chi tiết nhật ký)      (Thống kê tổng quan)
```

> **Vì sao lại kết hợp cả `DefaultRouter` (cho ViewSet) và danh sách `urlpatterns` tùy biến (cho APIView)?**
> DRF `DefaultRouter` rất mạnh trong việc tự động sinh ra bộ các đường dẫn URL chuẩn RESTful cho ViewSet (`GET /audit-logs/`, `GET /audit-logs/<id>/`) mà không cần phải khai báo thủ công từng đường dẫn. Tuy nhiên, với các trang tổng hợp đặc thù như `DashboardView` (dạng `APIView`), việc dùng `path('dashboard/', ...)` giúp định tuyến ngắn gọn, minh bạch và linh hoạt. Kết hợp cả hai phương pháp giúp mã nguồn gọn gàng và dễ mở rộng.

> **Vì sao cần khai báo tham số `basename='auditlog'` khi đăng ký ViewSet với Router?**
> Thông thường, DRF Router sẽ tự động đoán tên URL ngược (reverse URL name) dựa trên thuộc tính `queryset` khai báo trong ViewSet. Tuy nhiên, `AuditLogViewSet` không khai báo thuộc tính `queryset` cố định ở cấp class mà định nghĩa linh hoạt bên trong phương thức `get_queryset(self)` để xử lý bộ lọc. Do đó, việc khai báo explicit `basename='auditlog'` là bắt buộc để Router tạo đúng các tên định danh URL như `auditlog-list` và `auditlog-detail`.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### Định Tuyền Các Đường Dẫn Quản Trị Hệ Thống

```python
from django.urls import path
# "from django.urls import path" = nạp hàm `path` từ Django để khớp các đường dẫn URL đơn lẻ.

from rest_framework.routers import DefaultRouter
# "from rest_framework.routers import DefaultRouter" = nạp bộ định tuyến tự động `DefaultRouter` của Django REST Framework.

from .views_admin import AuditLogViewSet, DashboardView
# Nạp 2 View quản trị hệ thống vừa định nghĩa ở `views_admin.py`.


router = DefaultRouter()
# Khởi tạo một đối tượng Router mặc định.

router.register('audit-logs', AuditLogViewSet, basename='auditlog')
# "router.register(...)" = đăng ký ViewSet với Router:
# - Tham số 1: `'audit-logs'` = tiền tố đường dẫn URL (kết quả sinh ra `/audit-logs/`).
# - Tham số 2: `AuditLogViewSet` = ViewSet chịu trách nhiệm xử lý logic.
# - Tham số 3: `basename='auditlog'` = đặt tên gốc cho bộ URL reverse routing (`auditlog-list`, `auditlog-detail`).

urlpatterns = router.urls + [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
]
# "urlpatterns = router.urls + [...]" = hợp nhất danh sách URL tự sinh từ Router và danh sách URL tự định nghĩa:
# - `router.urls` = chứa các URL cho `/audit-logs/` và `/audit-logs/<pk>/`.
# - `path('dashboard/', DashboardView.as_view(), name='dashboard')` = đăng ký đường dẫn `/dashboard/` trỏ tới `DashboardView`.
# - `.as_view()` = chuyển đổi class-based view `DashboardView` thành một hàm view function tiêu chuẩn mà Django URL dispatcher hiểu được.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Endpoint Path | HTTP Method | Class Đảm Nhận | Tên Reverse Routing | Mục Đích Nghiệp Vụ WorkTracker |
|---------------|-------------|----------------|---------------------|--------------------------------|
| `/audit-logs/` | GET | `AuditLogViewSet` | `auditlog-list` | Trả về danh sách nhật ký vết an ninh hệ thống có bộ lọc dynamic |
| `/audit-logs/<id>/` | GET | `AuditLogViewSet` | `auditlog-detail` | Xem chi tiết 1 bản ghi nhật ký vết an ninh theo ID |
| `/dashboard/` | GET | `DashboardView` | `dashboard` | Trả về dữ liệu số liệu thống kê tổng quan toàn hệ thống |
