# Executive Code Annotation: `backend/timesheets/urls_employee.py`

**Package / Module:** `backend.timesheets.urls_employee` · Employee Routing Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Định Tuyến URL Employee (Employee Routing Diagram)

```
/api/employee/
  ├── log-works/                  ──► EmployeeLogWorkView.as_view()     (name="employee_log_work_create")
  └── log-works/<id>/void/        ──► EmployeeVoidLogWorkView.as_view() (name="employee_log_work_void")
```

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from django.urls import path
# Nạp hàm path của Django để khai báo các quy tắc ánh xạ URL pattern tới View.

3: from .views_employee import EmployeeLogWorkView, EmployeeVoidLogWorkView
# Nạp 2 API View dành riêng cho Employee.

6: urlpatterns = [
# Khai báo danh sách các tuyến đường URL.

7:     path("log-works/", EmployeeLogWorkView.as_view(), name="employee_log_work_create"),
# Tuyến đường POST /log-works/ để tạo log work mới. Đặt tên 'employee_log_work_create' để dễ tra cứu trong reverse URL.

8:     path("log-works/<int:log_work_id>/void/", EmployeeVoidLogWorkView.as_view(), name="employee_log_work_void"),
# Tuyến đường PATCH /log-works/<log_work_id>/void/ để hủy log work. Sử dụng path converter kiểu số nguyên `<int:log_work_id>`.
9: ]
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| URL Pattern | Endpoint Name | View Associated | Target Operation |
|-------------|---------------|-----------------|------------------|
| `log-works/` | `employee_log_work_create` | `EmployeeLogWorkView` | Tạo mới bản ghi khai báo giờ làm |
| `log-works/<int:log_work_id>/void/` | `employee_log_work_void` | `EmployeeVoidLogWorkView` | Hủy (Void) log work chưa duyệt của chính mình |
