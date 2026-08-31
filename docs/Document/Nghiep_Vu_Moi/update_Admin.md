# BÁO CÁO TỔNG HỢP CẬP NHẬT NGHIỆP VỤ & KỸ THUẬT PHÂN HỆ ADMIN
> **Dự án**: WorkTracker (Django + React)  
> **Phân hệ**: Admin (Quản trị viên)  
> **Thư mục lưu trữ**: `docs/Document/Nghiep_Vu_Moi/update_Admin.md`  
> **Nguyên tắc cốt lõi**: **Zero-Schema-Change** (Tận dụng 100% các bảng Database hiện có, không thay đổi ERD đã nộp tài liệu).

---

## I. TỔNG QUAN LUỒNG NGHIỆP VỤ MỚI NHÁNH ADMIN

Trong luồng quy trình mới, Admin đóng vai trò là chốt chặn khởi tạo và quản trị danh mục cấp cao:
1. **Quản lý Khách hàng / Đối tác (Client Governance)**:
   - Khi vô hiệu hóa một Client (`is_active = False`), hệ thống tự động khóa/chuyển trạng thái toàn bộ các Job đang chạy của Client đó sang `ON_HOLD` và chặn toàn bộ các hoạt động tạo task hoặc thực thi task liên quan.
2. **Khởi tạo & Phân bổ Project Team cho Job (Job Staffing Allocation)**:
   - Khi tạo mới Job hoặc chỉnh sửa Job, Admin có thể lựa chọn các Employee từ nhiều phòng ban khác nhau để đưa vào **Project Team** của Job.
   - Khi tạo Job có kèm Team, hệ thống tự động tạo các Task Onboarding khởi tạo cho từng nhân sự để thiết lập ràng buộc thành viên vào Job.
3. **Đánh giá Năng lực Nhân sự Thời gian Thực (Smart Workload Pressure - SWP)**:
   - Admin được cung cấp giao diện trực quan hiển thị đầy đủ các chỉ số: **Active Tasks, Active Jobs, % Capacity, Status Badge (Available / Balanced / Overloaded)** để đưa ra quyết định giao việc chính xác, tránh quá tải và phân mảnh nguồn lực.

---

## II. CHI TIẾT CÁC FILE ĐÃ CHỈNH SỬA Ở BACKEND (DJANGO / DRF)

### 1. `backend/timesheets/services/manager_employee_utilization_service.py`
* **Mục đích**: Xây dựng thuật toán tính tải động đa chiều dùng chung cho toàn hệ thống (`calculate_smart_workload_pressure`).
* **Nghiệp vụ thực thi**:
  - Quét toàn bộ Task đang mở (`TODO`, `IN_PROGRESS`, `REVIEWING`) của nhân sự.
  - Quy đổi trọng số giờ theo độ ưu tiên: `HIGH: 8.0h`, `MEDIUM: 4.0h`, `LOW: 1.5h`.
  - Xác định `Max Deadline` thực tế và tính số ngày làm việc còn lại (`horizon_working_days`, tối thiểu 6 ngày công để phân bổ cả backlog).
  - Tính cường độ giờ làm cần thiết:
    $$\text{daily\_required\_hours} = \frac{\sum \text{Effort}}{\text{horizon\_working\_days}}$$
  - Tính tỷ lệ công suất tải chuẩn:
    $$\text{capacity\_pct} = \text{round}\left(\frac{\text{daily\_required\_hours}}{8.0\text{h}} \times 100\%, 1\right)$$
  - Phân loại trạng thái:
    + `< 4.0h/ngày` ($< 50\%$): 🟢 `AVAILABLE` (Rảnh / Sẵn sàng nhận việc).
    + `4.0h - 8.0h/ngày` ($50\% - 100\%$): 🟡 `BALANCED` (Vừa tải / Ổn định).
    + `> 8.0h/ngày` ($> 100\%$): 🔴 `OVERLOADED` (Quá tải thực tế).

---

### 2. `backend/accounts/admin/serializers.py`
* **Mục đích**: Cung cấp dữ liệu người dùng, phòng ban và chỉ số Workload cho Admin API.
* **Nghiệp vụ thực thi**:
  - `EmployeeProfileSerializer`: Bổ sung trường `department_name = serializers.CharField(source='department.name', read_only=True, default=None)` giúp trả về chính xác tên phòng ban (*Information Technology, Digital Marketing, Human Resources...*), khắc phục lỗi hiển thị fallback `General`.
  - `UserSerializer`: Bổ sung trường `workload = serializers.SerializerMethodField()`, gọi hàm `calculate_smart_workload_pressure(obj)` khi role là `EMPLOYEE`.

---

### 3. `backend/projects/admin/serializers.py`
* **Mục đích**: Xử lý dữ liệu Job, danh sách Team và điều phối nhân sự ban đầu.
* **Nghiệp vụ thực thi**:
  - `team_size` (`SerializerMethodField`): Đếm số lượng nhân sự tham gia Job (`obj.tasks.values('assignee_id').distinct().count()`).
  - `project_team` (`SerializerMethodField`): Trả về danh sách chi tiết các thành viên trong Team (`id`, `email`, `full_name`, `department_name`).
  - `initial_team_member_ids` (`write_only=True`):
    + `create()`: Tạo task Onboarding ban đầu để liên kết nhân viên vào Job.
    + `update()`: Cho phép Admin chọn bổ sung thêm nhân viên mới vào Job Team khi chỉnh sửa Job mà không ảnh hưởng thành viên cũ.

---

### 4. `backend/projects/admin/views.py`
* **Mục đích**: Quản lý vòng đời Client và bảo vệ toàn vẹn dữ liệu.
* **Nghiệp vụ thực thi**:
  - Cập nhật `ClientViewSet.perform_destroy()`: Khi Admin vô hiệu hóa một Client (`is_active = False`), hệ thống **tự động chuyển toàn bộ các Job `ACTIVE` và `PLANNING` thuộc Client đó sang `ON_HOLD`** và ghi nhận vào hệ thống `AuditLog`.

---

### 5. `backend/tasks/services/task_manager_service.py`
* **Mục đích**: Kiểm soát nghiệp vụ tạo và phân công Task.
* **Nghiệp vụ thực thi**:
  - Trong `create_task()`: Bổ sung chốt chặn kiểm tra:
    ```python
    if not job.client or not job.client.is_active:
        raise BusinessRuleError("CANNOT_CREATE_TASK_FOR_INACTIVE_CLIENT")
    ```

---

### 6. `backend/tasks/services/task_transition_manager_service.py`
* **Mục đích**: Kiểm soát luồng chuyển đổi trạng thái Task (FSM).
* **Nghiệp vụ thực thi**:
  - Trong `validate_transition()`: Bổ sung chốt chặn không cho phép nhân viên/quản lý Start hoặc chuyển trạng thái task nếu Client của Job đó đang bị vô hiệu hóa hoặc Job không ở trạng thái `ACTIVE`.

---

## III. CHI TIẾT CÁC FILE ĐÃ CHỈNH SỬA Ở FRONTEND (REACT / TAILWIND)

### 7. `frontend/src/pages/admin/JobsPage.jsx`
* **Mục đích**: Giao diện Quản trị Jobs chính của Admin.
* **Nghiệp vụ thực thi**:
  1. **Bảng danh sách Jobs**:
     - Thêm cột **`Team`** (`w-[11%]`) hiển thị biểu tượng `👥 {job.team_size || 0} members` kèm tooltip danh sách tên nhân viên tham gia.
     - Cân đối lại tỷ lệ phần trăm độ rộng tất cả các cột giúp bảng luôn vừa khung màn hình, không bị tràn thanh cuộn ngang.
  2. **Mở rộng kích thước Modal**:
     - Tăng kích thước `maxWidth` của cả 2 Modal `New Job` và `Edit Job` từ `max-w-lg` (512px) lên **`max-w-2xl` (672px)** giúp form rộng rãi, thoáng đãng.
  3. **Thiết kế Form Phân bổ Nhân sự 5 Cột Minh Bạch**:
     - Hiển thị đầy đủ thông tin:
       `[✓] Sophia Johnson (sophia.johnson@worktracker.vn · Information Technology)` $\mid$ `8 Tasks` $\mid$ `7 Jobs` $\mid$ `Capacity: 75%` $\mid$ `🟡 Balanced`
     - Đọc đúng tên phòng ban thực tế từ `emp.profile?.department_name`.
  4. **Nâng cấp Modal Edit Job**:
     - Tích hợp khu vực **Project Team Allocation**: Tải danh sách thành viên hiện tại của Job và cho phép Admin chọn thêm nhân sự mới vào Team.
  5. **Form Validation & Dấu Sao Đỏ `*` (Required Asterisk)**:
     - Chuẩn hóa Zod schema `z.string().trim().min(1, 'Job name is required')`.
     - Kích hoạt cờ `required={true}` trên toàn bộ các trường bắt buộc (`Job Name *`, `Client *`, `Manager *`, `Start Date *`, `Deadline *`, `Priority *`, `Status *`).

---

## IV. BẰNG CHỨNG XÁC MINH TOÀN DIỆN (VERIFICATION EVIDENCE)

Tuân thủ nghiêm ngặt quy trình `verification-before-completion`:

### 1. Backend Django System Check
```powershell
PS D:\Study\HK2\Final Project HK2\WORK-TRACKER GITHUB\worktracker-django-react> python backend/manage.py check
System check identified no issues (0 silenced).
Exit Code: 0
```

### 2. Frontend Production Build
```powershell
PS D:\Study\HK2\Final Project HK2\WORK-TRACKER GITHUB\worktracker-django-react\frontend> npm run build
vite v8.0.16 building client environment for production...
transforming...✓ 3063 modules transformed.
rendering chunks...
dist/assets/JobsPage-CBbSI4MH.js 20.95 kB
✓ built in 817ms
Exit Code: 0
```

---
*Báo cáo được hoàn thiện và lưu trữ tại `docs/Document/Nghiep_Vu_Moi/update_Admin.md`.*
