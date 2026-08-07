# Executive Code Annotation: `backend/worktracker_core/urls.py`

**Package / Module:** `backend.worktracker_core.urls` · Root URL Routing Config

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Định Tuyến Gốc (Root Routing Architecture Diagram)

```
                               ┌─────────────────────────┐
                               │   HTTP Client / Frontend │
                               └────────────┬────────────┘
                                            │ Request URL (e.g. /api/auth/login/)
                                            ▼
                        ┌──────────────────────────────────────┐
                        │    worktracker_core/urls.py (Root)   │
                        └───────────────────┬──────────────────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         ▼                                  ▼                                  ▼
┌─────────────────┐                ┌──────────────────┐               ┌─────────────────┐
│ /admin/         │                │ /api/auth/       │               │ /api/docs/      │
│ (Django Admin   │                │ (Authentication, │               │ (Swagger /      │
│  Dashboard)     │                │  RBAC, Users)    │               │  OpenAPI Docs)  │
└─────────────────┘                └────────┬─────────┘               └─────────────────┘
                                            │ include()
                                            ▼
                              ┌──────────────────────────┐
                              │  accounts.urls_auth      │
                              │  accounts.urls_admin     │
                              │  accounts.urls_manager   │
                              └──────────────────────────┘
```

> **Vì sao gom nhiều đường dẫn `/api/auth/`, `/api/admin/`, `/api/manager/` từ các app khác nhau tại Root Router?**
> Cấu trúc này phân định rõ ràng không gian tên (Namespace) theo **vai trò người dùng (RBAC Role Boundaries)** thay vì chỉ theo mô hình dữ liệu. Frontend khi gọi API chỉ cần dựa vào tiền tố URL (`/api/admin/...`, `/api/manager/...`, `/api/timesheets/...`) để biết API đó phục vụ nhóm người dùng nào, giúp dễ bảo mật tại lớp Gateway / Middleware.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Các Module Router & OpenAPI Docs

```python
from django.contrib import admin
# "from django.contrib import admin" = mượn module admin có sẵn của Django.
# Module này cung cấp giao diện quản trị cơ sở dữ liệu mặc định dành cho Quản trị viên hệ thống (Superuser).

from django.urls import include, path
# "from django.urls import include, path" = mượn 2 hàm định tuyến lõi từ Django.
# `path`: hàm định nghĩa một quy tắc khớp chuỗi URL đơn lẻ.
# `include`: hàm "ủy quyền/chuyển tiếp" đường dẫn cho một file urls.py con của app nghiệp vụ xử lý tiếp.

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
# "drf_spectacular.views" = mượn 3 View tự động tạo tài liệu API chuẩn OpenAPI v3:
# `SpectacularAPIView`: xuất ra file JSON/YAML chứa toàn bộ sơ đồ API.
# `SpectacularSwaggerView`: giao diện Swagger UI tương tác trực tiếp (thử nghiệm gửi request).
# `SpectacularRedocView`: giao diện ReDoc đẹp mắt chuyên dùng đọc tài liệu API.
```

---

### 2. Danh Sách Các Tuyến Đường Gốc (`urlpatterns`)

```python
# File cấu hình URL chính của toàn dự án.
# Django đọc file này đầu tiên khi nhận một request, sau đó chuyển tiếp sang file urls.py của từng app tương ứng.
urlpatterns = [
# "urlpatterns = [...]" = Danh sách (List) chứa tất cả các đường dẫn được chấp nhận ở cấp cao nhất của hệ thống.

    # Trang quản trị nội bộ Django (dành cho dev, không phải giao diện công ty).
    path('admin/', admin.site.urls),
    # "path('admin/', admin.site.urls)" = Nếu URL bắt đầu bằng `admin/`, chuyển cho Django Admin xử lý.
    # Ví von: Cổng sau dành riêng cho thợ bảo trì và quản trị viên kỹ thuật của tòa nhà.

    # ================= AUTH =================
    path('api/auth/', include('accounts.urls_auth')),
    # "include('accounts.urls_auth')" = Chuyển tiếp các request có tiền tố `api/auth/` sang file `urls_auth.py` của app `accounts`.
    # Phục vụ nghiệp vụ: Đăng nhập (Login), Đăng xuất (Logout), Refresh Token, Đổi mật khẩu.

    # ================= ADMIN (accounts: users/roles/permissions/departments) =================
    path('api/auth/', include('accounts.urls_admin')),
    # Chuyển tiếp tới `urls_admin.py` của app `accounts`.
    # Phục vụ nghiệp vụ Admin: Quản lý danh sách người dùng, gán vai trò RBAC (Role), phân quyền (Permission), phòng ban (Department).

    # ================= ADMIN (projects: clients/jobs, system: audit-logs/dashboard) =================
    path('api/admin/', include('projects.urls')),
    # Chuyển tiếp tới `urls.py` của app `projects` với tiền tố `/api/admin/` (Quản lý Khách hàng Clients, Dự án Jobs).

    path('api/admin/', include('system.urls')),
    # Chuyển tiếp tới `urls.py` của app `system` (Nhật ký thao tác Audit Logs, Dashboard hệ thống).

    # ================= MANAGER (accounts) =================
    path('api/auth/', include('accounts.urls_manager')),
    # Chuyển tiếp tới `urls_manager.py` của `accounts` (Quản lý xem danh sách nhân viên thuộc quyền quản lý).

    # ================= MANAGER (projects/tasks/reports) =================
    path('api/manager/', include('projects.urls_manager')),
    # Chuyển tiếp API phân công/quản lý dự án dành cho Trưởng phòng (Manager).

    path('api/manager/', include('tasks.urls_manager')),
    # Chuyển tiếp API giao việc, theo dõi tiến độ nhiệm vụ (Task Management).

    path('api/manager/', include('reports.urls_manager')),
    # Chuyển tiếp API xem & xuất báo cáo năng suất, báo cáo giờ làm nhân viên.

    # ================= TIMESHEETS =================
    path('api/timesheets/', include('timesheets.urls_manager')),
    # API duyệt chấm công, khóa kỳ chấm công (TimeLock) dành cho Quản lý.

    path('api/timesheets/', include('timesheets.urls_employee')),
    # API bấm giờ, khai báo giờ làm (LogWork), gửi bảng chấm công dành cho Nhân viên (Employee).

    # ================= SCHEMA =================
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # API trả về file OpenAPI Schema JSON/YAML gốc.

    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Trang giao diện Swagger UI (truy cập `/api/docs/` để xem và test API trực quan).

    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    # Trang giao diện ReDoc UI (truy cập `/api/redoc/` để xem tài liệu định dạng đẹp).
]
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Tiền tố URL (Endpoint Prefix) | Target Routing File | Nhóm Vai Trò & Nghiệp Vụ Phụ Trách |
|-------------------|------------------------|-----------------------------|
| `/admin/` | `admin.site.urls` | Django Core Admin (Bảo trì dữ liệu gốc) |
| `/api/auth/` | `accounts.urls_auth`<br>`accounts.urls_admin`<br>`accounts.urls_manager` | Đăng nhập/Đăng xuất (Auth), Quản lý User/RBAC (Admin), Quản lý Nhân sự thuộc cấp (Manager) |
| `/api/admin/` | `projects.urls`<br>`system.urls` | Quản lý Khách hàng, Dự án cấp công ty, Xem Audit Log toàn hệ thống |
| `/api/manager/` | `projects.urls_manager`<br>`tasks.urls_manager`<br>`reports.urls_manager` | Phân công công việc, Quản lý Nhiệm vụ, Báo cáo tiến độ & Năng suất |
| `/api/timesheets/` | `timesheets.urls_manager`<br>`timesheets.urls_employee` | Duyệt/Khóa bảng chấm công (Manager) & LogWork giờ làm hàng ngày (Employee) |
| `/api/docs/` | `SpectacularSwaggerView` | Tài liệu API tương tác công khai cho lập trình viên Frontend |
