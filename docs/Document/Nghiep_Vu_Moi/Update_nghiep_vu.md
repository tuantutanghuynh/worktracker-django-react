# KẾ HOẠCH TỔNG THỂ ĐỒNG BỘ 3 PHÂN HỆ: ADMIN - MANAGER - EMPLOYEE (ZERO-SCHEMA-CHANGE)

Tài liệu thiết kế và kế hoạch chi tiết triển khai Quy trình Nghiệp vụ Mới theo `Quy trinh moi.docx`, đồng bộ xuyên suốt cả 3 phân hệ **Admin**, **Manager**, và **Employee** mà **KHÔNG THÊM BẢNG MỚI NÀO VÀO DATABASE**.

---

## 1. MA TRẬN PHÂN QUYỀN & VÒNG ĐỜI NGHIỆP VỤ 3 PHÂN HỆ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 0 & 1: ADMIN (Resource & Portfolio Management)                   │
│  - Tạo Client -> Tạo Job (hạn chót, brief).                                 │
│  - Chỉ định 1 Manager làm Chủ nhiệm dự án (Project Manager).                │
│  - Gom "Project Team": Chọn các Employee từ nhiều phòng ban,                │
│    xem trực quan Workload (% Capacity, Active Jobs, Active Tasks).          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Bàn giao Job & Project Team
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2 & 4: MANAGER (Project Execution & QA Sign-off)                  │
│  - Nhận Job & Team từ Admin. Xé nhỏ Job thành các Task.                     │
│  - Giao Task: Dropdown CHỈ HIỂN THỊ nhân sự trong Project Team của Job.     │
│  - Nghiệm thu sản phẩm bàn giao (Deliverables QA Review).                   │
│  - Khi 100% Task xong -> Chuyển Job sang COMPLETED.                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Giao việc & Phối hợp
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: EMPLOYEE (Execution & Timesheet LogWork)                       │
│  - Nhận Task trên Kanban/List, cập nhật TODO -> IN_PROGRESS -> REVIEWING.   │
│  - Đính kèm file kết quả, trao đổi bình luận, logwork giờ làm.              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ▲
                                       │ Luân chuyển nhân sự
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ VÒNG ĐỜI LUÂN CHUYỂN NHÂN SỰ NÂNG CAO (PHASE-OUT & AUTO-RELEASE)           │
│  - Chuyển Employee sang Job mới:                                            │
│    + Ở Job cũ: Đổi trạng thái Phase-out, khóa giao task mới.               │
│    + Task TODO cũ: Khóa không cho chuyển In Progress, yêu cầu Re-assign.   │
│    + Task IN_PROGRESS cũ: Nhân viên làm nốt đến khi nghiệm thu xong.       │
│    + Auto-Release: Xong task cuối ở Job cũ -> Tự động giải phóng về Job mới.│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DANH SÁCH CHI TIẾT CÁC FILE CẦN CẬP NHẬT THEO TỪNG PHÂN HỆ

### 🛡️ A. PHÂN HỆ 1: ADMIN (TỔ CHỨC & PHÂN BỔ NGUỒN LỰC)

#### 1. Backend Admin:
* **[MODIFY] [`backend/projects/admin/serializers.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/projects/admin/serializers.py)**:
  - Bổ sung trường `initial_team_member_ids` (List ID nhân viên được chọn) khi Admin tạo/cập nhật Job.
  - Tự động liên kết các nhân viên này vào Project Team ban đầu của Job.
* **[MODIFY] [`backend/accounts/admin/views.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/accounts/admin/views.py)**:
  - Bổ sung thông tin Workload động (`active_jobs_count`, `active_tasks_count`, `workload_status`, `utilization_rate`) vào serializer danh sách nhân viên để Admin cân đối năng lực khi gom team.

#### 2. Frontend Admin:
* **[MODIFY] [`frontend/src/pages/admin/JobsPage.jsx`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/frontend/src/pages/admin/JobsPage.jsx)**:
  - Nâng cấp Modal tạo/sửa Job: Bổ sung khu vực **Gom Project Team**.
  - Hiển thị danh sách Employee kèm **Badge Workload trực quan** (`3 Tasks | 1 Job | 45% Capacity - AVAILABLE`).
  - Hỗ trợ chọn nhanh / bỏ chọn nhân sự từ nhiều phòng ban khác nhau vào Job.

---

### 👔 B. PHÂN HỆ 2: MANAGER (LẬP KẾ HOẠCH, PHÂN VIỆC & NGHIỆM THU)

#### 1. Backend Manager:
* **[MODIFY] [`backend/system/security/scoping_manager.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/system/security/scoping_manager.py)**:
  - Cập nhật hàm `assignment_search_employees_queryset(job_id)`: Khi Manager tạo Task trong 1 Job, chỉ trả về các Employee thuộc Project Team của Job đó.
* **[MODIFY] [`backend/tasks/services/task_manager_service.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/tasks/services/task_manager_service.py)**:
  - Chặn không cho Manager gán task cho nhân sự ngoài Project Team của Job.
  - Chặn không cho gán task mới cho nhân sự đang ở trạng thái `PHASE_OUT` tại Job đó.
* **[MODIFY] [`backend/tasks/services/task_transition_manager_service.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/tasks/services/task_transition_manager_service.py)**:
  - Kích hoạt logic **Auto-Release**: Khi Manager duyệt `COMPLETED` cho Task `IN_PROGRESS` cuối cùng của nhân viên Phase-out $\rightarrow$ Tự động tháo gỡ hoàn toàn khỏi Job cũ.
* **[MODIFY] [`backend/projects/services/job_status_manager_service.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/projects/services/job_status_manager_service.py)**:
  - Khi Manager chuyển Job sang `COMPLETED`: Tự động giải phóng toàn bộ nhân sự trong Job về trạng thái `Available`.

#### 2. Frontend Manager:
* **[MODIFY] [`frontend/src/pages/manager/ManagerJobDetailPage.jsx`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/frontend/src/pages/manager/ManagerJobDetailPage.jsx)**:
  - Modal/Drawer tạo Task mới: Dropdown `Select Assignee` tự động lọc chỉ hiển thị nhân sự thuộc Project Team của Job này.
  - Tab `Team & Workload`: Hiển thị rõ trạng thái từng thành viên (`Active` / `Phase-out`).
* **[MODIFY] [`frontend/src/components/manager/TaskDetailDrawer.jsx`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/frontend/src/components/manager/TaskDetailDrawer.jsx)**:
  - Hiển thị nhãn cảnh báo `Đang luân chuyển (Phase-out)` và nút `Re-assign Task` cho Manager đối với các task TODO dở dang.

---

### 👨‍💻 C. PHÂN HỆ 3: EMPLOYEE (THỰC THI, BÀN GIAO & LOGWORK)

#### 1. Backend Employee:
* **[MODIFY] [`backend/tasks/employee/views_employee.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/tasks/employee/views_employee.py)**:
  - Khi Employee thực hiện chuyển trạng thái Task (`TODO -> IN_PROGRESS`): Kiểm tra nếu Task đang bị khóa do quy trình Phase-out $\rightarrow$ Báo lỗi `TASK_LOCKED_EMPLOYEE_IS_BEING_TRANSFERRED`.
  - Cho phép Employee tiếp tục nộp bàn giao (Deliverables) và LogWork trên các task đang `IN_PROGRESS`.

#### 2. Frontend Employee:
* **[MODIFY] [`frontend/src/pages/employee/MyTasksPage.jsx`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/frontend/src/pages/employee/MyTasksPage.jsx)**:
  - Nếu Task `TODO` thuộc Job cũ đang trong quá trình luân chuyển: Khóa nút kéo thả / chuyển `Start Progress` và hiển thị cảnh báo: *"Task này đang được bàn giao phân công lại cho nhân sự khác"*.
  - Task `IN_PROGRESS`: Hiển thị bình thường để nhân viên hoàn thành dứt điểm bàn giao.
* **[MODIFY] [`frontend/src/components/common/forms/QuickLogWorkFormCard.jsx`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/frontend/src/components/common/forms/QuickLogWorkFormCard.jsx)**:
  - Đảm bảo nhân viên chỉ logwork cho các Task hợp lệ đang thực thi.

---

## 3. KỊCH BẢN KIỂM THỬ XUYÊN SUỐT 3 PHÂN HỆ (END-TO-END VERIFICATION)

1. **Test Case 1 (Admin Staffing)**: Admin tạo Job `Marketing CRM`, chọn Manager `Alexander Wright`, chọn 3 Employee: `Amelia Wilson`, `Ava Garcia`, `Benjamin Anderson`.
   - *Kết quả*: Job được tạo thành công với 3 thành viên trong Team.
2. **Test Case 2 (Manager Scoped Assignment)**: Manager `Alexander Wright` vào Job tạo Task `Tạo Database Schema`. Mở dropdown Assignee.
   - *Kết quả*: Dropdown **CHỈ HIỆN 3 NHÂN VIÊN TRÊN**, không hiện nhân viên ngoài luồng.
3. **Test Case 3 (Employee Execution)**: Employee `Amelia Wilson` nhận task, chuyển `IN_PROGRESS`, đính kèm file bàn giao và nộp sang `REVIEWING`.
   - *Kết quả*: Manager nhận thông báo QA Review.
4. **Test Case 4 (Phase-out & Auto-release)**: Admin chuyển `Amelia Wilson` sang Job mới.
   - *Kết quả*: Ở Job cũ, các task TODO của Amelia bị khóa, Manager cũ Re-assign cho Benjamin. Amelia làm nốt task In Progress. Khi Manager duyệt Task xong $\rightarrow$ Amelia tự động được giải phóng (Auto-release) hoàn toàn sang Job mới.
