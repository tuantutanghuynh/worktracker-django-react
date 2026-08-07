# WorkTracker — Roadmap toàn dự án (28/06/2026 → 06/08/2026)

## Mục tiêu

Hoàn thành **toàn bộ code** (Backend Django + Frontend React Vite, chưa
gồm CSS/UI thiết kế cuối — phần đó cả nhóm làm chung sau) trước
**06/08/2026 (Thứ Năm)**, để giai đoạn còn lại (07/08 → demo) chỉ dành cho
test/kiểm thử/debug/thêm-bớt tính năng nhỏ — **không sửa logic lõi nữa**.

## Phân chia theo vai trò (Role), không theo app Backend cũ

```text
Minh Anh   → Toàn bộ trải nghiệm ADMIN  (Backend + Frontend)
Đức Long   → Toàn bộ trải nghiệm MANAGER (Backend + Frontend)
Tuấn Tú    → Authentication (dùng chung mọi role) + trải nghiệm EMPLOYEE (Backend + Frontend)
```

Mỗi người tự code cả 2 đầu (Django API + trang React tương ứng) cho đúng
phạm vi của mình — không chia riêng "người Backend / người Frontend".

## Lịch trình theo tuần (mốc Chủ Nhật = báo cáo tiến độ + merge code)

| Tuần | Khoảng thời gian | Mốc Chủ Nhật |
|---|---|---|
| Kickoff | 28/06 (CN) | Họp giao việc, thống nhất roadmap này |
| Tuần 1 | 29/06 → 05/07 | **CN 05/07**: merge + báo cáo |
| Tuần 2 | 06/07 → 12/07 | **CN 12/07**: merge + báo cáo |
| Tuần 3 | 13/07 → 19/07 | **CN 19/07**: merge + báo cáo |
| Tuần 4 | 20/07 → 26/07 | **CN 26/07**: merge + báo cáo |
| Tuần 5 | 27/07 → 02/08 | **CN 02/08**: merge + báo cáo |
| Buffer cuối | 03/08 → 06/08 (Thứ Năm) | **06/08**: code-freeze, không sửa logic nữa |

## Bản đồ 18 bảng dữ liệu → người phụ trách

Dựa theo `docs/DFD-specification.md` (8 tiến trình P1.0-P8.0) và
`docs/ERD-specification.md`. Người phụ trách bảng = người viết model +
migration + API CRUD cho bảng đó.

| Bảng | Tiến trình DFD | Người phụ trách |
|---|---|---|
| roles, permissions, role_permissions | P1.0 | **Tuấn Tú** |
| users, password_resets | P1.0 | **Tuấn Tú** |
| departments, employee_profiles | P2.5 / P6.0 | **Tuấn Tú** (đã làm — xem ghi chú dưới) |
| clients, jobs | P2.3, P2.4 | **Minh Anh** |
| audit_logs | P8.0 | **Minh Anh** |
| tasks, task_followers, task_comments, task_attachments | P3.0 | **Đức Long** |
| time_locks, log_works, daily_user_timesheets | P4.0 | **Tuấn Tú** |
| notifications | P5.0 | **Tuấn Tú** |

### Ghi chú quan trọng — giả định cần xác nhận lại với team

1. **`departments`/`employee_profiles` thuộc Tuấn Tú** (anh ấy giữ
   `models.py`, `permissions.py`, `authentication.py`, `redis_client.py`
   — phần lõi không ai khác sửa), dù trang "Quản lý Phòng ban" và "Team
   Directory" là giao diện Admin/Manager dùng. Lý do giữ model: 2 bảng
   này dính chặt khóa ngoại với `users`.

   **Cập nhật 29/06/2026 (sau khi áp dụng "3 Quy tắc vàng để ghép code vô
   trùng 100%")**: không còn đúng là "Minh Anh/Đức Long chỉ gọi API có
   sẵn" — mô hình thật là **app `accounts` dùng chung, mỗi vai trò viết
   file riêng trong đó**. Tuấn Tú đã tạo sẵn khung:
   `accounts/views_admin.py` + `urls_admin.py` (cho Minh Anh),
   `accounts/views_manager.py` + `urls_manager.py` (cho Đức Long, đã có
   sẵn `ManagerTeamEmployeeListView`). Minh Anh/Đức Long **tự viết thêm
   view/serializer vào đúng file vai trò của mình** khi cần (ví dụ Minh
   Anh tự viết API tạo user/gán role trong `views_admin.py`), không cần
   chờ Tuấn Tú code sẵn rồi giao API — chỉ cần **không sửa**
   `models.py`/`permissions.py`/`authentication.py`/`redis_client.py`
   (phần lõi) mà không thống nhất trước.
2. **`notifications` thuộc Tuấn Tú** vì đây là dữ liệu Employee tiêu thụ
   (Notification Center) — nhưng **người kích hoạt thông báo lại là Đức
   Long/Minh Anh** (ví dụ Manager duyệt task → cần bắn thông báo cho
   Employee). Tuấn Tú sẽ cung cấp 1 hàm/API "gửi thông báo" dùng chung,
   Đức Long/Minh Anh **gọi vào** hàm đó từ code của mình, không tự ghi
   thẳng vào bảng `notifications`.
3. **Trang "Team Directory" (Manager) trùng với API đã có sẵn**: Tuấn Tú
   đã build `GET /api/auth/team/employees/` ở giai đoạn trước (ví dụ RBAC)
   — đúng chức năng Đức Long cần cho trang Team Directory. Đức Long dùng
   lại API này, không cần viết lại.
4. **WebSocket/Realtime (Django Channels)** — hạ tầng dùng chung cho cả
   Kanban (Đức Long) và Notification Center (Tuấn Tú). Đề xuất: **Đức
   Long** setup hạ tầng Channels/ASGI (vì Kanban là nơi cần realtime sớm
   nhất và phức tạp nhất), Tuấn Tú tái sử dụng kết nối đó cho việc đẩy
   Notification.
5. **Export báo cáo (Excel/PDF, P7.5)** dùng dữ liệu của cả 3 người (jobs,
   tasks, log_works...) — xếp vào việc tích hợp cuối (Tuần 4-5), không
   phải việc làm sớm tuần 1-2.
6. **Celery + Redis** (gửi email duyệt/từ chối Task chạy ngầm, theo đúng
   yêu cầu tài liệu) — hạ tầng dùng chung thứ 2 (cùng nhóm với Channels ở
   mục 4). **Tuấn Tú** setup Celery worker + viết task gửi email, **Đức
   Long** gọi `.delay()` vào khi cần từ luồng Review Workflow.

## Cập nhật 02/07/2026 — Bản thiết kế v2 (WORKTRACKER SYSTEM DESIGN DOCUMENT.docx mới)

Ngày 02/07/2026, tài liệu yêu cầu được nâng cấp lên bản v2. Phân tích impact đầy đủ ở `docs/Xếp hạng mức độ ảnh hưởng của bản v2 đến từng nhóm.pdf`.

**Tóm tắt mức độ ảnh hưởng:**

| Người | Workload thay đổi | Điểm thay đổi lớn nhất |
|---|---|---|
| **Đức Long** | Nặng nhất (~70% FR mới) | FR-124 (review log work) + FR-64-66 (JOB-scoped time lock) |
| **Tuấn Tú** | Trung bình — workflow đã có bị sửa | FR-58 (void log work) + FR-57 (JOB lock check) + FR-72 (3 loại notification mới) |
| **Minh Anh** | Nhẹ nhất — chủ yếu clarify | FR-28 (độc quyền đổi manager_id) + FR-64-66 mở rộng scope |

**Schema DB thay đổi do v2 (ảnh hưởng shared infra):**

1. **`time_locks` cần thêm `job_id`** — v2 xác nhận JOB-scoped lock (FR-64-66). Cấu trúc mới:
   - `job_id = NULL` → GLOBAL lock (toàn công ty, giữ nguyên v1)
   - `job_id = <id>` → khóa riêng 1 job (mới trong v2)
   - Người viết migration: **Minh Anh** (workload nhẹ nhất — PDF đề xuất rõ)

2. **`log_works` cần thêm `review_status`** — phục vụ FR-124 (Manager review/approve/reject/void):
   - `review_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'VOIDED') DEFAULT 'PENDING'`
   - Người viết migration: **Minh Anh** (schema shared, workload nhẹ nhất)

**Permission code mới cần seed (Tuấn Tú thêm migration):**

```python
# Migration mới (sau migration 0003) — thêm vào MANAGER role
"manager:search_employee"        # FR-20
"manager:view_client_list"       # FR-25
"manager:lock_job"               # FR-64-66
"manager:view_activity_history"  # FR-97
"manager:review_logwork"         # FR-124

# Thêm vào EMPLOYEE role
"logwork:void"                   # FR-58 (thay logwork:delete nếu đã có)
```

**Điểm mâu thuẫn v1 đã giải quyết bởi v2:**

- `time_locks` scope: v1 chỉ có GLOBAL — v2 xác nhận cần thêm JOB scope (không phải lựa chọn nữa, là yêu cầu rõ ràng).
- Log work "Delete" → đổi thành "Void" (FR-58): không xóa cứng, đổi `review_status = 'VOIDED'` — giữ lại lịch sử.

---

## Phát hiện từ "01 workTracker System Design Document.docx" (tài liệu do Đức Long soạn, 28/06/2026)

Tài liệu này hiện **chỉ hoàn chỉnh ở Chương 1, 2, 6 và đầu Chương 7** —
các chương Use Case/DFD/ERD/Architecture chi tiết/API Spec/RBAC
Matrix/Test Plan vẫn đang là khung mục lục rỗng. Không nên coi đây là
nguồn chi tiết API/RBAC cuối cùng, nhưng phần Functional Requirements
(FR-xx)/Business Rules (BR-xx) đã viết khá đầy đủ, đáng tin hơn các tài
liệu cũ ở 3 điểm sau:

1. **`time_locks` là khóa TOÀN CÔNG TY theo `(lock_month, lock_year)`,
   KHÔNG khóa riêng theo team/department/Manager.** Trích nguyên văn:
   > *"Under the current database structure, time_locks is unique by
   > lock_month and lock_year, so the lock applies at period level. If
   > team-specific or department-specific locking is required later, the
   > database must add a scope field such as department_id, job_id, or
   > manager_id."*

   Nghĩa là khi **bất kỳ Manager nào** bấm "Chốt báo cáo tháng X", **toàn
   bộ nhân viên công ty** bị khóa log work tháng đó, không chỉ riêng team
   của Manager đó. Đây là giới hạn thiết kế thật, không phải bug — nhưng
   **cả nhóm cần đồng thuận** có chấp nhận giới hạn này không, hay cần
   Tuấn Tú thêm field scope vào `time_locks` trước khi Đức Long code tính
   năng Timesheet Review (xem chi tiết ở file `02`).

2. **Job có thể do cả Admin VÀ Manager tạo, không chỉ Admin** — FR-26:
   > *"The system shall allow Admin or authorized Manager users to create
   > a master job."*

   Nhưng `all worktracker features-fix.md` xếp "Master Job Management"
   hẳn vào mục Admin — 2 tài liệu mâu thuẫn. **Ảnh hưởng tới code đã
   build**: permission `job:create`/`job:update` hiện chỉ seed cho ADMIN
   (migration `0002`, đã chạy + đã push). Nếu team xác nhận Manager cũng
   cần tạo Job, Tuấn Tú cần thêm 1 migration mới gán 2 permission đó cho
   MANAGER — không sửa migration `0002` đã chạy.

3. **`departments`/`employee_profiles` được Đức Long tự xếp vào "Admin
   Management Group"** (cùng nhóm với `clients`, `jobs`, `audit_logs`,
   `time_locks`), khác với lý do FK-locality mà roadmap này dùng để giao
   2 bảng đó cho Tuấn Tú. Tài liệu **không phân công ai code module nào**
   (chỉ phân loại dữ liệu theo nhóm nghiệp vụ) — nên đây chưa chắc là ý
   định đổi người code, nhiều khả năng chỉ là cách phân loại kế thừa từ
   tài liệu yêu cầu gốc (trang "Admin" có hiển thị quản lý phòng ban).
   Tương tự tài liệu phân chia 4 người ban đầu (`Hướng dẫn Django.docx`)
   từng gặp đúng tình huống này và quyết định **vẫn giao theo FK-locality**
   để tránh lỗi khóa ngoại — roadmap này giữ nguyên quyết định đó, nhưng
   **nên nói rõ với Đức Long** lý do tại sao trong buổi họp, vì anh ấy có
   thể đang giả định khác.

## Đã xác nhận với team (28/06/2026)

- **Luồng trạng thái Task**: Employee chỉ có nút "Submit for Review"
  (`IN_PROGRESS → REVIEWING`), không có nút tự complete. Manager Approve
  → `COMPLETED`; Manager Reject → quay lại `IN_PROGRESS` kèm lý do trong
  comment. (Tài liệu gốc có 1 dòng ghi chú gây hiểu lầm là Employee tự
  complete được — đã thống nhất bỏ qua, dùng đúng luồng này.)
- **Lỗi đánh số mục trong tài liệu gốc** (Admin nhảy từ mục 4 sang 6,
  Manager nhảy từ mục 2 sang 4): xác nhận là lỗi đánh máy của tài liệu
  gốc, không phải tính năng bị thiếu — không cần xử lý gì thêm.

## FAQ — Script trả lời khi team hỏi "sao phần phân quyền lại là Tuấn Tú, không phải Minh Anh (Admin)?"

> "Trang 'Quản lý Nhân sự & Phân quyền' nằm trong tài liệu mô tả khu vực
> Admin — nhưng đó là **trang giao diện** (Frontend), không phải **logic
> kiểm tra quyền** (Backend). 2 cái này tách riêng:
>
> Phần Tuấn Tú làm là **cơ chế phân quyền dùng chung cho cả hệ thống** —
> quyết định "user này có được gọi API này không", áp dụng cho API của cả
> Admin, Manager, Employee. Đây không phải tính năng riêng của Admin, mà
> là hạ tầng nền mọi module khác đều gọi vào — Đức Long cũng cần dùng
> cùng cơ chế này để check quyền cho API Task của anh ấy.
>
> 3 lý do giữ nguyên người phụ trách:
> 1. **Đã code và test xong từ 4 giai đoạn trước** (Login, RBAC, khóa/mở
>    tài khoản, quên mật khẩu) — đổi người giữa đường tốn công học/viết
>    lại hơn để nguyên.
> 2. **Tránh 2 người cùng sửa 1 app** — nguyên tắc nhóm đặt từ đầu: mỗi
>    người 1 thư mục app riêng để giảm xung đột khi merge mỗi Chủ Nhật.
>    `users`/`roles`/`departments` có khóa ngoại dính chặt nhau, tách cho
>    2 người dễ lỗi khóa ngoại.
> 3. **Phần UI và cả API riêng của Admin vẫn là việc của Minh Anh** —
>    trang Quản lý Nhân sự & Phân quyền cô ấy code Frontend, và có thể tự
>    viết thêm API trong `accounts/views_admin.py` (khung đã có sẵn) cho
>    đúng nhu cầu Admin (tạo user, gán role...) — chỉ không đụng vào
>    `models.py`/`permissions.py` (phần lõi mình giữ) mà chưa thống nhất.
>
> Tóm lại: ai code **trang hiển thị cho role nào** thì theo đúng tài liệu
> (Minh Anh = Admin pages, Đức Long = Manager pages); ai code **cơ chế
> xác thực/phân quyền nền** thì tách riêng vì nó phục vụ tất cả, không
> phải tính năng riêng của Admin."

## Ngoài phạm vi dự án (theo đúng `01 workTracker System Design Document.docx` mục 1.4.9)

Không ai trong 3 người cần làm các mục sau — nếu thấy đang lan sang hướng
này, dừng lại:

```text
- Xử lý lương (Payroll)
- Kế toán / tài chính
- HRM nâng cao (ngoài CRUD nhân viên/phòng ban cơ bản)
- CRM ngoài thông tin Client cơ bản đã có
- Mobile app
- AI dự đoán hiệu suất
- Tích hợp Jira/Trello/Asana/MS Project hoặc công cụ PM ngoài
```

## Quy tắc làm việc chung

- **Mỗi người code trên branch riêng** (gợi ý: `MinhAnh`, `DucLong`,
  `TuanTu`), merge vào nhánh chung (`main` hoặc `develop`) vào Chủ Nhật
  hàng tuần sau khi báo cáo tiến độ.
- **Trước khi gọi API của người khác**: đọc kỹ tên endpoint + format dữ
  liệu trả về trong file roadmap của người đó (file `01`/`02`/`03` trong
  thư mục này), không tự đoán.
- **Không tự sửa model/migration của app người khác** — nếu cần đổi field
  dùng chung (ví dụ thêm field vào `Task`), báo người phụ trách bảng đó
  sửa, hoặc thống nhất trước trong buổi họp Chủ Nhật.
- **CSS/UI/giao diện chưa cần làm đẹp** — tập trung đúng chức năng (API
  chạy đúng, trang React render đúng dữ liệu, luồng hoạt động đúng), phần
  thiết kế UI cả nhóm làm chung sau 06/08.

## "3 Quy tắc vàng để ghép code vô trùng 100%" (đã áp dụng 29/06/2026)

Áp dụng cho **mọi app dùng chung giữa nhiều vai trò** (`accounts`, `tasks`,
`timesheets`...), không chỉ riêng `accounts`:

1. **Strict Naming**: class (Serializer/View/ViewSet) phục vụ riêng 1 vai
   trò phải gắn tiền tố vai trò — `AdminXSerializer`, `ManagerXView`,
   `EmployeeXViewSet`. Không dùng tên chung chung (`TaskSerializer`).
   Class dùng chung cho mọi vai trò (ví dụ `LoginView`) thì không cần
   tiền tố — không có gì để phân biệt.
2. **Tách file vật lý theo vai trò**: trong 1 app, mỗi vai trò có
   `views_<role>.py`/`serializers_<role>.py`/`urls_<role>.py` riêng. File
   mặc định (`views.py`/`serializers.py`/`urls.py`) **để trống**, không
   ai tự ý thêm code vào nếu chưa thống nhất.
3. **Trạm tổng `worktracker_core/urls.py`**: chia khu vực rõ bằng comment
   theo vai trò, mỗi người chỉ `include()` thêm route vào đúng khu vực
   của mình.

`accounts` app đã áp dụng đủ 3 quy tắc này (xem
`backend/accounts/views_auth.py`, `views_admin.py`, `views_manager.py`...
và `worktracker_core/urls.py`) — dùng làm mẫu tham khảo khi Minh Anh/Đức
Long áp dụng cho `clients`/`jobs`/`tasks`/`timesheets`.

## Đọc tiếp theo

- [01-phase-minh-anh-admin.md](01-phase-minh-anh-admin.md)
- [02-phase-duc-long-manager.md](02-phase-duc-long-manager.md)
- [03-phase-tuan-tu-auth-employee.md](03-phase-tuan-tu-auth-employee.md)
