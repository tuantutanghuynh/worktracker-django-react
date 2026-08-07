# Executive Code Annotation: `backend/timesheets/urls_manager.py`

**Package / Module:** `backend.timesheets.urls_manager` · Manager Routing Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Định Tuyến URL Manager (Manager RESTful Router Map)

```
/api/manager/
  ├── log-works/                     ──► ManagerLogWorkViewSet (basename="manager-log-works")
  │     ├── GET /                     (list)
  │     ├── GET /{id}/                (retrieve)
  │     ├── POST /{id}/approve/       (action: approve)
  │     ├── POST /{id}/reject/        (action: reject)
  │     ├── POST /{id}/correct/       (action: correct)
  │     └── POST /{id}/void/          (action: void)
  │
  └── time-locks/                    ──► ManagerTimeLockViewSet (basename="manager-time-locks")
        ├── GET /                     (list)
        ├── GET /{id}/                (retrieve)
        ├── POST /                    (create)
        └── POST /{id}/unlock/        (action: unlock)
```

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from rest_framework.routers import DefaultRouter
# Nạp công cụ tự động đăng ký router RESTful của DRF.

3: from timesheets.views_manager import (
4:     ManagerLogWorkViewSet,
5:     ManagerTimeLockViewSet,
6: )
# Nạp 2 ViewSet chính dành cho Manager.

9: router = DefaultRouter()
# Khởi tạo đối tượng DefaultRouter.

11: router.register(
12:     r"log-works",
13:     ManagerLogWorkViewSet,
14:     basename="manager-log-works",
15: )
# Đăng ký ViewSet log-works tự động tạo các tuyến đường list, detail và các custom actions (approve, reject, correct, void).

17: router.register(
18:     r"time-locks",
19:     ManagerTimeLockViewSet,
20:     basename="manager-time-locks",
21: )
# Đăng ký ViewSet time-locks tự động tạo các tuyến đường list, detail, create và custom action unlock.

23: urlpatterns = router.urls
# Gán danh sách url patterns sinh ra từ router cho biến urlpatterns.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Resource Route | Registered ViewSet | Generated Endpoint Names | Key Functionality |
|----------------|--------------------|--------------------------|-------------------|
| `log-works/` | `ManagerLogWorkViewSet` | `manager-log-works-list`, `manager-log-works-detail`, `manager-log-works-approve`, etc. | Quản lý danh sách và phê duyệt/từ chối/điều chỉnh/hủy logwork |
| `time-locks/` | `ManagerTimeLockViewSet` | `manager-time-locks-list`, `manager-time-locks-detail`, `manager-time-locks-unlock` | Quản lý tạo và mở khóa cờ khóa kỳ công cấp Job |
