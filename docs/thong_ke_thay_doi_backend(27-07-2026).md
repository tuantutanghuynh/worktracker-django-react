# 📋 BẢNG THỐNG KÊ CÁC THAY ĐỔI BACKEND — Phiên nâng cấp 24–27/07/2026

> **Phạm vi:** Merge các field từ Admin models + Nâng cấp Client model  
> **Trạng thái:** ✅ 100% ĐÃ HOÀN THÀNH  
> **Ngày cập nhật:** 27/07/2026

---

## 🔵 PHẦN A: MERGE FIELDS TỪ ADMIN VỀ (job_code, priority, joined_date, severity, summary)

| Trường      | vị trí models.py        | Đề xuất  | Trạng thái    |
| ----------- | ----------------------- | ------- | ------------- |
| job_code    | ❌ `projects/models.py`   | Thêm    | update từ Admin |
| priority    | ❌ `projects/models.py`   | Thêm    | update từ Admin |
| joined_date | ❌ `accounts/models.py`   | Thêm    | update từ Admin |
| severity    | ❌ `system/models.py`     | Thêm    | update từ Admin |
| summary     | ❌ `system/models.py`     | Thêm    | update từ Admin |
---

### A1. `projects/models.py` — Model `Job`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| class `Job` | `job_code = models.CharField(max_length=20, unique=True, null=True, blank=True)` | Mã dự án duy nhất (VD: ERP-2024-068) để định danh Job trên UI và báo cáo |
| class `Job` | `priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM, db_index=True)` | Phân loại độ ưu tiên Job (HIGH/MEDIUM/LOW), phục vụ lọc và sắp xếp |

---

### A2. `accounts/models.py` — Model `EmployeeProfile`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| class `EmployeeProfile` | `joined_date = models.DateField(blank=True, null=True)` | Ngày bắt đầu vào công ty của nhân viên, phục vụ quản lý nhân sự trên UI |

---

### A3. `system/models.py` — Model `AuditLog`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| class `AuditLog` | `severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.NORMAL, db_index=True)` | Mức độ nghiêm trọng của hành động (CRITICAL, WARNING, NORMAL) |
| class `AuditLog` | `summary = models.TextField(blank=True, null=True)` | Dòng tóm tắt ngắn gọn mô tả hành động cho Audit Log |

---

### A4. `projects/manager/serializers_manager.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `ManagerJobListSerializer.Meta.fields` | Thêm `"job_code"`, `"priority"` | Hiển thị Mã Job và Độ ưu tiên trên danh sách Job của Manager |
| `ManagerJobCreateSerializer.Meta.fields` | Thêm `"job_code"`, `"priority"` | Cho phép Manager truyền Mã Job và chọn Độ ưu tiên khi tạo Job mới |
| `ManagerJobUpdateSerializer.Meta.fields` | Thêm `"priority"` | Cho phép Manager sửa Độ ưu tiên khi chỉnh sửa Job |

---

### A5. `projects/manager/filters_manager.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `VALID_ORDER_FIELDS` | Thêm `"job_code"`, `"priority"` | Cho phép Frontend sắp xếp danh sách Job theo Mã Job và Độ ưu tiên |
| `apply()` | Thêm gọi `cls.filter_priority(queryset, params)` | Kích hoạt bộ lọc Priority trong pipeline filter |
| Hàm mới `filter_priority()` | Lọc Job theo giá trị `priority` (HIGH/MEDIUM/LOW) với validation | Cho phép API `?priority=HIGH` trả về chỉ Job ưu tiên cao |
| `filter_search()` | Thêm `Q(job_code__icontains=search)` | Cho phép tìm kiếm Job theo Mã Job |
| `filter_search()` | Thêm `Q(client__client_name__icontains=search)`, `Q(client__industry__icontains=search)` | Cho phép tìm kiếm Job theo tên Khách hàng và Ngành nghề |

---

### A6. `projects/manager/views_manager.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `partial_update()` → `snapshot(job, fields=[...])` | Thêm `"priority"` vào danh sách `fields` của `old_values` và `new_values` | Ghi nhận giá trị Priority cũ/mới vào Audit Log khi Manager sửa Job |

---

### A7. `accounts/manager/serializers_manager.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `ManagerEmployeeListSerializer` | Thêm `joined_date = serializers.DateField(source="profile.joined_date", read_only=True)` và thêm `"joined_date"` vào `fields` | Hiển thị Ngày vào công ty của nhân viên trên giao diện Team |

---

### A8. `system/services/audit_manager_service.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `log_action()` — tham số | Thêm `severity=AuditLog.Severity.NORMAL` | Phân loại mức độ nghiêm trọng của hành động (CRITICAL/WARNING/NORMAL) |
| `log_action()` — tham số | Thêm `summary=None` | Dòng tóm tắt hành động ngắn gọn, dễ đọc cho Audit Log |
| `AuditLog.objects.create()` | Thêm `severity=severity`, `summary=summary` | Lưu 2 trường mới vào database |

---

### A9. `reports/services/manager_task_summary_report_service.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `build_job_summary()` → `.values()` | Thêm `"job__job_code"` | Truy vấn DB lấy Mã Job cho bảng tổng hợp |
| `build_job_summary()` → dict trả về | Thêm `"job_code": row["job__job_code"]` | Xuất Mã Job trong Job Summary |
| `serialize_task_row()` → dict `"job"` | Thêm `"job_code": task.job.job_code` | Xuất Mã Job trong từng dòng Task của báo cáo |

---

### A10. `reports/services/manager_timesheet_detail_report_service.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `build_job_summary()` → `data[job_id]` | Thêm `"job_code": job.job_code` | Xuất Mã Job trong bảng tổng hợp theo Job |
| `build_job_summary()` → `result.append` | Thêm `"job_code": row["job_code"]` | Truyền Mã Job ra kết quả cuối |
| `serialize_logwork_row()` → dict `"job"` | Thêm `"job_code": job.job_code` | Xuất Mã Job trong từng dòng LogWork |

---

### A11. `reports/services/manager_report_export_service.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `write_task_summary_sheet()` → `headers` | Thêm `"Job Code"` (sau `"Title"`) | Cột Mã Job trong file Excel xuất ra |
| `write_task_summary_sheet()` → `sheet.append` | Thêm `row["job"]["job_code"]` | Ghi giá trị Mã Job vào từng dòng Excel |
| `export_manager_report()` → `log_action()` | Thêm `summary=f"Manager exported {report_type} report as {file_format} file ({filename})"` | Ghi tóm tắt hành động xuất báo cáo vào Audit Log |

---

### A12. `reports/templates/reports/task_summary_pdf.html`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `<thead>` | Thêm `<th>Mã Job</th>` (sau Tên Task) | Cột Mã Job trong tiêu đề bảng PDF |
| `<tbody>` | Thêm `<td>{{ row.job.job_code }}</td>` | Hiển thị giá trị Mã Job trong từng dòng |
| `{% empty %}` | Đổi `colspan="7"` → `colspan="8"` | Khớp đúng số lượng 8 cột khi bảng rỗng |

---

### A13. `reports/templates/reports/timesheet_detail_pdf.html`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `<thead>` | Thêm `<th>Mã Job</th>` (sau Nhân viên) | Cột Mã Job trong tiêu đề bảng PDF |
| `<tbody>` | Thêm `<td>{{ row.job.job_code }}</td>` | Hiển thị giá trị Mã Job trong từng dòng |
| `{% empty %}` | Đổi `colspan="7"` → `colspan="8"` | Khớp đúng số lượng 8 cột khi bảng rỗng |

---

### A14. `tasks/manager/views_manager.py`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `ManagerJobKanbanView.get()` → dict `"job"` | Thêm `"job_code": job.job_code` | Trả về Mã Job cho Frontend Kanban Board |

---

## 🟢 PHẦN B: NÂNG CẤP CLIENT MODEL (address, industry, notes, created_at, updated_at)
| Trường         | Hiện tại trong models.py | Đề xuất    | Trạng thái            |
| -------------- | ------------------------ | ---------- | --------------------- |
| client_name    | ✅ Có (dòng 13)           | Giữ nguyên | Không cần sửa         |
| tax_code       | ✅ Có (dòng 16-20)        | Giữ nguyên | Không cần sửa         |
| contact_person | ✅ Có (dòng 22-26)        | Giữ nguyên | Không cần sửa         |
| contact_email  | ✅ Có (dòng 27-30)        | Giữ nguyên | Không cần sửa         |
| contact_phone  | ✅ Có (dòng 32-36)        | Giữ nguyên | Không cần sửa         |
| is_active      | ✅ Có (dòng 40-43)        | Giữ nguyên | bổ xung từ nhóm Admin |
| address        | ❌ Chưa có                | Thêm mới   | ⚠️ CẦN BỔ SUNG         |
| industry       | ❌ Chưa có                | Thêm mới   | ⚠️ CẦN BỔ SUNG         |
| notes          | ❌ Chưa có                | Thêm mới   | ⚠️ CẦN BỔ SUNG         |
| created_at     | ❌ Chưa có                | Thêm mới   | ⚠️ CẦN BỔ SUNG         |
| updated_at     | ❌ Chưa có                | Thêm mới   | ⚠️ CẦN BỔ SUNG         |
---

### B1. `projects/models.py` — Model `Client`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| class `Client` | `address = models.CharField(max_length=255, blank=True, null=True)` | Địa chỉ trụ sở / Địa chỉ xuất hóa đơn |
| class `Client` | `industry = models.CharField(max_length=100, blank=True, null=True)` | Lĩnh vực hoạt động (IT, Banking, Finance...) |
| class `Client` | `notes = models.TextField(blank=True, null=True)` | Ghi chú nội bộ / Lưu ý khi hợp tác |
| class `Client` | `created_at = models.DateTimeField(auto_now_add=True)` | Ngày khởi tạo bản ghi — chuẩn Audit Trail |
| class `Client` | `updated_at = models.DateTimeField(auto_now=True)` | Ngày cập nhật gần nhất — chuẩn Audit Trail |

---

### B2. `projects/manager/serializers_manager.py` — `ManagerClientMiniSerializer`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `ManagerClientMiniSerializer.Meta.fields` | Thêm `"tax_code"` | Hiển thị Mã số thuế trên Frontend |
| `ManagerClientMiniSerializer.Meta.fields` | Thêm `"contact_person"` | Hiển thị Người liên hệ |
| `ManagerClientMiniSerializer.Meta.fields` | Thêm `"contact_email"` | Hiển thị Email liên hệ |
| `ManagerClientMiniSerializer.Meta.fields` | Thêm `"contact_phone"` | Hiển thị SĐT liên hệ |
| `ManagerClientMiniSerializer.Meta.fields` | Thêm `"address"` | Hiển thị Địa chỉ trụ sở |
| `ManagerClientMiniSerializer.Meta.fields` | Thêm `"notes"` | Hiển thị Ghi chú nội bộ |
| `ManagerClientMiniSerializer.Meta.fields` | Thêm `"is_active"` | Hiển thị Trạng thái hoạt động |

---

### B3. `projects/manager/filters_manager.py` — `filter_search()`

| Hàm / Vị trí | Nội dung thêm | Lý do |
|---|---|---|
| `filter_search()` | Thêm `Q(client__client_name__icontains=search)` | Tìm kiếm Job theo tên Khách hàng |
| `filter_search()` | Thêm `Q(client__industry__icontains=search)` | Tìm kiếm Job theo Ngành nghề Khách hàng |

---

## 📊 TỔNG KẾT HỆ THỐNG

| Phân loại | Số file | Số thay đổi | Trạng thái |
|---|---|---|---|
| **Phần A:** Merge Admin fields | 14 file | 33 thay đổi | ✅ 100% Hoàn thành |
| **Phần B:** Nâng cấp Client | 3 file (+ 1 migration) | 11 thay đổi | ✅ 100% Hoàn thành |
| **TỔNG CỘNG** | **17 file** | **44 thay đổi** | **✅ 100% HOÀN THÀNH** |
