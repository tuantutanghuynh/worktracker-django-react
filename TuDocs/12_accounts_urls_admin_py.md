# Executive Code Annotation: `backend/accounts/urls_admin.py`

**Package / Module:** `backend.accounts.urls_admin` · Admin IAM Routing Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Định Tuyến Admin URLs (Admin Routing Map)

```
                                  ┌────────────────────────────────┐
                                  │   /api/v1/admin/accounts/      │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                        ┌────────────────────────────────────────────────────┐
                        │             urls_admin.py (Router)                 │
                        └───────┬───────────────┬─────────────┬──────────────┘
                                │               │             │
              ┌─────────────────┘               │             └──────────────────┐
              ▼                                 ▼                                ▼
  ┌───────────────────────┐         ┌───────────────────────┐        ┌───────────────────────┐
  │  DefaultRouter Urls   │         │  DefaultRouter Urls   │        │  Explicit Custom Path │
  │  users/               │         │  roles/               │        │  user/<id>/disable/   │
  │  departments/         │         │  permissions/         │        │                       │
  └───────────┬───────────┘         └───────────┬───────────┘        └───────────┬───────────┘
              │                                 │                                │
              ▼                                 ▼                                ▼
  ┌───────────────────────┐         ┌───────────────────────┐        ┌───────────────────────┐
  │ UserViewSet           │         │ RoleViewSet           │        │ AdminDisableUserView  │
  │ DepartmentViewSet     │         │ PermissionViewSet     │        │ (APIView Offboard)    │
  └───────────────────────┘         └───────────────────────┘        └───────────────────────┘
```

> **Vì sao sử dụng `DefaultRouter` của DRF thay vì khai báo từng `path()` thủ công cho ViewSet?**
> - **Tự động hóa RESTful Routing Standard:** `DefaultRouter` tự động sinh ra chuẩn đường dẫn RESTful hoàn chỉnh cho 6 thao tác CRUD mặc định (List `GET`, Create `POST`, Retrieve `GET {id}`, Update `PUT {id}`, Partial Update `PATCH {id}`, Delete `DELETE {id}`) kèm theo cả trang tra cứu API Root UI trong môi trường phát triển.
> - **Tự động định tuyến `@action` tùy chỉnh:** Các hàm như `lock()` và `unlock()` được đánh dấu bằng `@action` trong `UserViewSet` sẽ tự động được gộp vào cây định tuyến dạng `/users/{id}/lock/` và `/users/{id}/unlock/` mà không cần viết thêm bất kỳ dòng code khai báo `path()` nào.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện Routing & Controller Admin (Imports & Router Setup)

```python
from django.urls import include, path
# `include()` nhận vào MỘT DANH SÁCH URL pattern (hoặc 1 chuỗi đường dẫn module chứa urlpatterns khác, như
# cách worktracker_core/urls.py include("accounts.urls_auth")) rồi "NHÚNG" toàn bộ danh sách đó vào ĐÚNG VỊ
# TRÍ nó được gọi trong urlpatterns -- ở file này dùng để nhúng danh sách URL do router TỰ SINH RA (xem dòng
# `path("", include(router.urls))` bên dưới), khác cách include một MODULE PATH dạng chuỗi.

from rest_framework.routers import DefaultRouter
# "DefaultRouter" là 1 CLASS -- khởi tạo ra 1 OBJECT có khả năng TỰ SINH danh sách URLPattern hoàn chỉnh cho
# nhiều ViewSet cùng lúc, thay vì phải tự viết tay `path()` cho từng action CRUD (list/create/retrieve/
# update/destroy) x N ViewSet -- tiết kiệm hàng chục dòng path() lặp đi lặp lại.

from .views_admin import (
    AdminDisableUserView,
    UserViewSet, RoleViewSet, PermissionViewSet, DepartmentViewSet,
)
# 5 tên import trải trên nhiều dòng nhờ cặp ngoặc đơn () -- cùng cú pháp đã thấy ở file views_admin.py.

# ADMIN-only routes for the accounts app.
router = DefaultRouter()
# `DefaultRouter()` KHÔNG CÓ tham số nào -- tạo ra 1 OBJECT RỖNG, CHƯA BIẾT về bất kỳ ViewSet nào. Object này
# là MUTABLE (có thể thay đổi trạng thái nội bộ), sẽ được "nạp" dần qua từng lệnh `.register(...)` bên dưới
# trước khi cuối cùng đọc thuộc tính `.urls` của nó để lấy ra danh sách URLPattern hoàn chỉnh.
```

---

### 2. Đăng Ký Các ViewSets & Khai Báo Danh Sách urlpatterns (Router Registration & Routes)

```python
router.register('users', UserViewSet, basename='user')
# `.register(prefix, viewset, basename=...)` là METHOD CALL làm THAY ĐỔI TRẠNG THÁI NỘI BỘ của object router
# (không trả về giá trị dùng được, chỉ "ghi nhớ" thêm 1 mục đăng ký) -- 3 tham số:
#   - `'users'` (positional): TIỀN TỐ URL, mọi route sinh ra từ UserViewSet đều bắt đầu bằng "users/".
#   - `UserViewSet` (positional): class ViewSet cần sinh route -- Router tự soi (introspect) class này để biết
#     nó có action nào (5 CRUD chuẩn + 2 @action tùy chỉnh lock/unlock đã viết ở file views_admin.py).
#   - `basename='user'` (keyword): TIỀN TỐ TÊN NỘI BỘ dùng để sinh `name=` cho từng URLPattern con, vd
#     "user-list" (GET /users/), "user-detail" (GET/PUT/PATCH/DELETE /users/{pk}/), và ĐẶC BIỆT với @action:
#     Router tự lấy `url_path='lock'` đã khai báo trong @action rồi ghép với basename thành "user-lock".
#   Kết quả: TỰ SINH RA `/users/`, `/users/{pk}/`, `/users/{pk}/lock/`, `/users/{pk}/unlock/` mà KHÔNG CẦN
#   viết dù chỉ 1 dòng path() thủ công nào cho 4 route đó.

router.register('roles', RoleViewSet, basename='role')
router.register('permissions', PermissionViewSet, basename='permission')
router.register('departments', DepartmentViewSet, basename='department')
# 3 dòng còn lại CÙNG CẤU TRÚC gọi method y hệt dòng trên, chỉ khác prefix/ViewSet/basename -- router giờ đã
# "ghi nhớ" đủ 4 lượt đăng ký, sẵn sàng sinh URL khi đọc thuộc tính `router.urls` ở dòng bên dưới.

urlpatterns = [
    path("user/<int:user_id>/disable/", AdminDisableUserView.as_view(), name="disable_user"),
    # Cú pháp `<converter:tên_biến>` là PATH CONVERTER của Django: "int" ép đoạn URL khớp phải là CHỮ SỐ THUẦN
    # (không khớp "abc"), VÀ TỰ ĐỘNG CHUYỂN KIỂU chuỗi "5" thành số nguyên 5 trước khi truyền vào view -- đây
    # là lý do `def post(self, request, user_id):` ở views_admin.py nhận `user_id` sẵn là int, không cần tự
    # gọi `int(user_id)` trong thân hàm. Các converter khác có sẵn: str (mặc định), slug, uuid, path.
    # LƯU Ý DỄ NHẦM: route này là "user/..." (SỐ ÍT), khác hẳn "users/" (SỐ NHIỀU) mà router.register() sinh
    # ra ở trên -- 2 route KHÔNG TRÙNG NHAU nên không xảy ra xung đột thứ tự khớp, nhưng dễ gây nhầm lẫn khi
    # đọc lướt qua vì tên rất giống nhau.

    path("", include(router.urls)),
    # Route="" (chuỗi rỗng) nghĩa là KHÔNG THÊM TIỀN TỐ nào -- mọi route bên trong router.urls giữ nguyên
    # path gốc của chúng (users/, roles/...) khi gắn vào urlpatterns của file này.
    # `router.urls` là 1 PROPERTY (không phải method, không gọi ()) trả về LIST các object URLPattern mà
    # router đã tự sinh từ 4 lượt .register() phía trên -- include() ở đây nhận thẳng 1 LIST Python có sẵn,
    # khác cách include("accounts.urls_auth") (nhận 1 CHUỖI tên module) dùng ở file cha worktracker_core/urls.py.
]
# Django khớp lần lượt TỪNG PHẦN TỬ trong urlpatterns THEO ĐÚNG THỨ TỰ khai báo, dừng lại ở khớp ĐẦU TIÊN --
# đặt path("user/<int:user_id>/disable/", ...) TRƯỚC include(router.urls) không ảnh hưởng ở đây (2 route
# không trùng tiền tố), nhưng là thói quen tốt: route CỤ THỂ nên khai báo trước route TỔNG QUÁT/động.
```

---

## Bảng Tóm Tắt Thiết Kế (Design Summary Table)

| URL Pattern | Registered View / ViewSet | Internal URL Name | HTTP Method Mapping | Mục Đích Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `user/<int:user_id>/disable/` | `AdminDisableUserView` | `disable_user` | POST | Tắt tài khoản khẩn cấp (Offboarding). |
| `users/` | `UserViewSet` | `user-list` | GET (List), POST (Create) | Quản lý danh sách & tạo người dùng mới. |
| `users/{pk}/` | `UserViewSet` | `user-detail` | GET, PUT, PATCH, DELETE | Xem/Sửa/Xóa mềm tài khoản theo ID. |
| `users/{pk}/lock/` | `UserViewSet` | `user-lock` | PATCH | Khóa tài khoản và xóa Redis Cache. |
| `users/{pk}/unlock/` | `UserViewSet` | `user-unlock` | PATCH | Mở khóa tài khoản và bật Redis Cache. |
| `roles/` | `RoleViewSet` | `role-list` | GET, POST | Quản lý danh mục Vai trò (Roles). |
| `permissions/` | `PermissionViewSet` | `permission-list` | GET (Read-only) | Tra cứu danh mục Quyền hạn (Permissions). |
| `departments/` | `DepartmentViewSet` | `department-list` | GET, POST, PUT, DELETE | Quản lý danh mục Phòng ban công ty. |
