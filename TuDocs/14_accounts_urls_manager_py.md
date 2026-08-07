# Executive Code Annotation: `backend/accounts/urls_manager.py`

**Package / Module:** `backend.accounts.urls_manager` · Manager IAM Routing Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều me một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Định Tuyến Manager URLs (Manager Routing Map)

```
                                  ┌────────────────────────────────┐
                                  │  /api/v1/manager/accounts/     │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                        ┌────────────────────────────────────────────────────┐
                        │            urls_manager.py (Route Mapping)         │
                        └─────────────────────────┬──────────────────────────┘
                                                  │
                                                  ▼
                        ┌────────────────────────────────────────────────────┐
                        │ path("team/employees/", ManagerTeamEmployeeListView)│
                        └─────────────────────────┬──────────────────────────┘
                                                  │
                                                  ▼
                        ┌────────────────────────────────────────────────────┐
                        │ ManagerTeamEmployeeListView (Trả về Team Members)  │
                        └────────────────────────────────────────────────────┘
```

> **Vì sao tách riêng `urls_manager.py` và `urls_admin.py` thay vì gộp chung vào `urls.py`?**
> - **Nguyên tắc Phân Tách Trách Nhiệm (Separation of Concerns & Role-based Namespace):** Hệ thống API WorkTracker được chia rõ ràng theo từng phân vùng vai trò (Admin API Space vs Manager API Space). Việc tách file giúp cấu hình prefix URL (như `/api/v1/admin/` vs `/api/v1/manager/`) mạch lạc, dễ dàng bảo trì và đăng ký middleware kiểm soát phân quyền ở tầng cổng vào (Gateway Level).

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện Routing & Controller Manager (Imports & Setup)

```python
from django.urls import path
# Chỉ import đúng `path` (không cần `include`/`DefaultRouter` như urls_admin.py) -- file này CHỈ CÓ 1 route
# đơn lẻ, không cần router tự sinh CRUD cho ViewSet nào (ManagerTeamEmployeeListView là APIView, không phải
# ViewSet -- không có gì để router "đăng ký").

from .views_manager import ManagerTeamEmployeeListView

# MANAGER-only routes for the accounts app.
```

---

### 2. Định Nghĩa Danh Sách Route Manager (Urlpatterns Mapping)

```python
urlpatterns = [
    path("team/employees/", ManagerTeamEmployeeListView.as_view(), name="team_employee"),
    # Chuỗi route "team/employees/" KHÔNG chứa converter động nào (không có <int:...>) -- vì view này không
    # cần tham số ID nào trên URL, dữ liệu lọc hoàn toàn dựa vào `request.user` (đã học ở file 13), không dựa
    # vào bất kỳ giá trị nào client tự truyền qua URL.
    # `.as_view()` áp dụng y hệt cơ chế closure đã học ở file 9/12 dù đây là APIView (không phải ViewSet).
]
# List chỉ có ĐÚNG 1 phần tử -- dấu phẩy sau path(...) vẫn hợp lệ dù không có phần tử thứ 2 (TRAILING COMMA,
# quy ước phổ biến trong Python giúp thêm route mới sau này chỉ cần thêm 1 dòng, không cần sửa dòng có sẵn).
```

---

## Bảng Tóm Tắt Thiết Kế (Design Summary Table)

| URL Pattern | Target View Class | Route Name | HTTP Method | Mục Đích Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `team/employees/` | `ManagerTeamEmployeeListView` | `team_employee` | GET | Trả về danh sách nhân viên trực thuộc phòng ban do Manager đăng nhập quản lý. |
