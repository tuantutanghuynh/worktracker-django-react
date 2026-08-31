# BÁO CÁO TỔNG HỢP CẬP NHẬT NGHIỆP VỤ & KỸ THUẬT PHÂN HỆ MANAGER
> **Dự án**: WorkTracker (Django + React)  
> **Phân hệ**: Manager (Quản lý dự án & Trưởng phòng ban)  
> **Tài liệu lưu trữ**: `docs/Document/Nghiep_Vu_Moi/update_Manager.md`  
> **Nguyên tắc cốt lõi**: **Zero-Schema-Change** (Tận dụng 100% các bảng Database hiện có, không thay đổi ERD đã nộp tài liệu).

---

## I. TỔNG QUAN LUỒNG NGHIỆP VỤ MỚI NHÁNH MANAGER

Phân hệ Manager đảm nhiệm vai trò trung tâm trong việc điều phối nhân sự, giám sát tiến độ dự án và kiểm soát chất lượng bàn giao (QA Sign-off):

1. **Quản lý & Giám sát Dự án khi Khách hàng Inactive (Project Governance & Inactive Client Freezing)**:
   - Khi Khách hàng bị Admin vô hiệu hóa (`is_active = False`), toàn bộ Job của Khách hàng đó chuyển sang `ON_HOLD`.
   - Toàn bộ giao diện Manager (Danh sách Projects, Chi tiết Project, Kanban, Task Drawer) hiển thị chỉ báo và Banner cảnh báo rõ ràng.
   - Khóa chặt mọi chuyển đổi trạng thái task (Approve, Reject, Start) cho đến khi Client được kích hoạt lại.

2. **Trung tâm Thẩm định & Nghiệm thu Sản phẩm (Task Acceptance & Deliverables Review)**:
   - Cung cấp giao diện 2 cột chuyên nghiệp (Split-pane) phục vụ việc duyệt sản phẩm.
   - Hiển thị lịch sử từ chối (`Rejection History`), đếm số lần reject (`Nx Rejected`), kiểm tra file nộp bàn giao và ghi chú nộp bài của nhân viên.
   - Tự động phân loại 5 Tab: `Pending QA`, `Frozen / On-Hold`, `Approved History`, `Rejected / Rework`, `All History`.
   - Loại trừ 100% các task mới tạo `TODO` (chưa nộp bài) ra khỏi trang nghiệm thu.
   - Tích hợp bộ lọc Ngày nộp bài (`Submission Date Picker`, mặc định là Ngày Hôm Nay - `Today`).

3. **Điều phối Nhân sự & Cảnh báo Phase-out (Workforce Management & Phase-out Reassignment)**:
   - Quản lý tải công việc nhân sự theo công thức Smart Workload Pressure (`Available`, `Balanced`, `Overloaded`).
   - Tự động nhận diện và hiển thị Banner cảnh báo khi nhân viên đang trong giai đoạn chuyển dự án (Phase-out), yêu cầu Manager phân công lại task cho thành viên khác.

4. **Chuẩn hóa Giao diện & Icon Lucide SVG**:
   - Loại bỏ 100% các ký tự emoji Unicode thô (`⏸️`, `⚠️`, `✅`, `⏳`), thay thế bằng Lucide React SVG Vector cao cấp (`<PauseCircle />`, `<AlertTriangle />`, `<CheckCircle2 />`, `<Clock />`).
   - Chuẩn hóa 100% ngôn ngữ tiếng Anh đồng bộ cho toàn bộ phân hệ Manager.

---

## II. CHI TIẾT CÁC FILE ĐÃ CHỈNH SỬA Ở BACKEND (DJANGO / DRF)

### 1. `backend/tasks/services/task_transition_manager_service.py`
* **Mục đích**: Chốt chặn bảo vệ trạng thái task (FSM State Machine).
* **Nghiệp vụ thực thi**:
  - Chặn tuyệt đối cả `APPROVE` lẫn `REJECT` khi `task.job.status != "ACTIVE"` hoặc Client bị vô hiệu hóa:
    ```python
    if task.job.status != "ACTIVE":
        raise BusinessRuleError("JOB_NOT_ACTIVE_CANNOT_TRANSITION_TASK")
    ```
  - Ngăn chặn hoàn toàn việc vô tình duyệt nhầm sản phẩm lỗi khi dự án đang tạm ngưng.

---

### 2. `backend/tasks/manager/filters_manager.py`
* **Mục đích**: Xử lý bộ lọc nâng cao cho danh sách Task của Manager.
* **Nghiệp vụ thực thi**:
  - `filter_review_scope(is_review_scope=true)`: Lọc các task thuộc chu trình thẩm định (`REVIEWING`, `COMPLETED`, `IN_PROGRESS` có rejection history, hoặc task có attachments), **loại trừ triệt để 100% các task ở trạng thái `TODO`**.
  - `filter_submitted_date(submitted_date)`: Lọc các task có hoạt động nộp bài (`QA_SUBMISSION`), đính kèm file bàn giao hoặc cập nhật trạng thái trong ngày cụ thể (`YYYY-MM-DD`).
  - `filter_rejections(has_rejections=true)`: Lọc các task từng bị từ chối sửa lại.

---

### 3. `backend/tasks/manager/serializers_manager.py`
* **Mục đích**: Cung cấp dữ liệu Job và Khách hàng cho Task Serializers.
* **Nghiệp vụ thực thi**:
  - Cập nhật `ManagerJobMiniSerializer`: Bổ sung trường `client_name` và `client_is_active` (`serializers.BooleanField(source="client.is_active", read_only=True)`).
  - Cung cấp trường `job` cho `ManagerTaskListSerializer` giúp Frontend nắm bắt ngay trạng thái `ON_HOLD` / `ACTIVE` và Client Inactive của từng task.

---

### 4. `backend/projects/manager/filters_manager.py`
* **Mục đích**: Xử lý bộ lọc dự án cho Manager.
* **Nghiệp vụ thực thi**:
  - Bổ sung phương thức `filter_client_is_active`: Cho phép lọc trực tiếp qua query parameter `client_is_active=false` để lấy toàn bộ các dự án bị đóng băng do Khách hàng Inactive.

---

### 5. `backend/projects/manager/serializers_manager.py`
* **Mục đích**: Tuần tự hóa thông tin chi tiết Job và Client cho Manager.
* **Nghiệp vụ thực thi**:
  - `ManagerClientMiniSerializer`: Trả về đầy đủ `is_active`, `client_name`, `contact_person`, `contact_email`, `contact_phone`, `industry`.
  - `ManagerJobListSerializer` & `ManagerJobDetailSerializer`: Trả về thông tin Client đầy đủ giúp giao diện hiển thị nhãn cảnh báo Client Inactive.

---

## III. CHI TIẾT CÁC FILE ĐÃ CHỈNH SỬA Ở FRONTEND (REACT / TAILWIND)

### 6. `frontend/src/pages/manager/ManagerTaskReviewPage.jsx`
* **Mục đích**: Trung tâm Thẩm định Nghiệm thu Bàn giao Sản phẩm (Task Acceptance & Deliverables Review).
* **Nghiệp vụ & UI/UX thực thi**:
  1. **Tái cấu trúc 2 Cột (Split-pane Workspace)**:
     - Cột trái (56%): Danh sách deliverables kèm mã task, tên nhân sự, số lượng file nộp, số lần reject (`<AlertTriangle /> Nx Rejected`) và badge trạng thái chuẩn.
     - Cột phải (44%): Inspector chi tiết xem tài liệu bàn giao, ghi chú của nhân viên, tiêu chí nghiệm thu ban đầu và lịch sử phản hồi từ chối.
  2. **Hệ thống 5 Tab Lọc Thông Minh**:
     - `Pending QA`: Task chờ duyệt (Job Active).
     - `Frozen / On-Hold`: Task chờ duyệt nhưng Dự án bị tạm dừng (Job On-Hold / Planning).
     - `Approved History`: Task đã nghiệm thu thành công (`COMPLETED`).
     - `Rejected / Rework`: Task bị từ chối đang sửa lại (`IN_PROGRESS` có rejection history).
     - `All History`: Toàn bộ chu trình thẩm định (Loại trừ hoàn toàn `TODO`).
  3. **Thanh Toolbar Tinh Gọn**:
     - Thu nhỏ ô tìm kiếm (~38%).
     - Bộ chọn dự án (~28%).
     - **Bộ lọc Ngày nộp bài (`type="date"`)**: Mặc định là Ngày hôm nay (`Today`), có nút `X` xóa nhanh ngày và nút `Reset` toàn bộ.
  4. **Tối ưu Thanh Hành Động Footer**:
     - Khi xem task `COMPLETED` hoặc `IN_PROGRESS`: Tự động **ẩn footer** để tối đa hóa không gian đọc tài liệu.
     - Khi xem task `REVIEWING` (Job Active): Hiển thị 2 nút `Reject with Fix Notes` (Đỏ) và `Approve & Complete Task →` (Xanh).
     - Khi xem task bị `Frozen`: Hiển thị thanh thông báo màu xám + nút dẫn nhanh đến trang Dự án (`View Projects →`).
     - Xóa bỏ nút chat trùng lặp ở footer, giữ 1 nút `Chat Directly` duy nhất tại thẻ nhân viên.

---

### 7. `frontend/src/pages/manager/ManagerJobsPage.jsx`
* **Mục đích**: Trang Quản lý Danh sách Dự án của Manager.
* **Nghiệp vụ & UI/UX thực thi**:
  1. **Hiển thị Cảnh báo Client Inactive**:
     - Bảng: Cột **Client** gắn nhãn `<PauseCircle /> Client Inactive` đỏ; Cột **Status** gắn nhãn phụ `<AlertTriangle /> Frozen (Client Inactive)`.
     - Thẻ Grid: Gắn nhãn `<PauseCircle /> Client Inactive` trên đầu thẻ và ghi chú `(Inactive)` cạnh tên Client.
  2. **Nút Lọc Nhanh `Client Inactive Only`**:
     - Thêm nút toggle **`[<PauseCircle /> Client Inactive Only]`** trên thanh công cụ `FilterToolbar` cạnh `Overdue Only`.
     - Tích hợp tự động reset khi bấm `Clear Filters`.

---

### 8. `frontend/src/pages/manager/ManagerJobDetailPage.jsx`
* **Mục đích**: Trang Chi tiết Dự án của Manager.
* **Nghiệp vụ & UI/UX thực thi**:
  1. **Executive Alert Banner**:
     - Khi `job.client?.is_active === false`: Hiển thị Banner cảnh báo nổi bật màu hổ phách/đỏ trên đầu trang thông báo dự án bị đóng băng do Khách hàng Inactive.
  2. **Metadata Client**: Gắn nhãn đỏ `<PauseCircle /> Inactive` cạnh tên Khách hàng.

---

### 9. `frontend/src/components/manager/TaskDetailDrawer.jsx`
* **Mục đích**: Drawer Chi tiết Task của Manager.
* **Nghiệp vụ & UI/UX thực thi**:
  1. **Banner Cảnh báo Khách hàng Inactive / Project Frozen**:
     - Bổ sung Banner cảnh báo màu vàng/đỏ: `<AlertTriangle /> Project & Task Frozen` khi Client Inactive hoặc Job đang `ON_HOLD`.
  2. **Banner Cảnh báo Phase-out Nhân sự**:
     - Hiển thị `<AlertCircle /> Staff Transition Warning (Phase-out)` khi nhân viên đang luân chuyển, cung cấp nút `Re-assign` nhanh.

---

### 10. `frontend/src/utils/errorMessages.js`
* **Mục đích**: Từ điển thông báo lỗi thân thiện cho toàn bộ ứng dụng Frontend.
* **Nội dung bổ sung**:
  - `JOB_NOT_ACTIVE_CANNOT_TRANSITION_TASK`: *"Cannot transition task because its project is not in ACTIVE state (e.g. Planning, On Hold, or Completed). Please set the project to Active first."*
  - `CLIENT_DEACTIVATED_CANNOT_TRANSITION_TASK`: *"Cannot transition task because this project's client is deactivated. Please reactivate the client first."*
  - `TASK_LOCKED_FOR_REASSIGNMENT_EMPLOYEE_PHASE_OUT`: *"This task is locked for reassignment because the assigned employee is currently in phase-out transition. Please re-assign this task to another active team member."*

---

### 11. `frontend/src/components/common/layout/Footer.jsx`
* **Mục đích**: Footer chân trang toàn hệ thống.
* **Nội dung cập nhật**: Chuyển đổi toàn bộ liên kết sang tiếng Anh chuẩn: `Terms of Service • Privacy Policy • Technical Support`.

---

## IV. BẢNG TỔNG HỢP KIỂM CHỨNG & BẰNG CHỨNG HỆ THỐNG (VERIFICATION EVIDENCE)

Theo quy chuẩn **`verification-before-completion`**, toàn bộ mã nguồn đã được chạy kiểm tra thực tế:

| Phân hệ / Thao tác kiểm chứng | Lệnh thực thi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :---: |
| **Backend System Check** | `python backend/manage.py check` | `System check identified no issues (0 silenced).` (Exit code: 0) | ✅ **PASS** |
| **Frontend Production Build** | `npm run build` (Vite) | `3063 modules transformed successfully.` (0 errors, Exit code: 0) | ✅ **PASS** |
| **Git Working Tree Status** | `git status -s` | Toàn bộ các file thay đổi ăn khớp 100% với kiến trúc Zero-Schema-Change | ✅ **PASS** |
