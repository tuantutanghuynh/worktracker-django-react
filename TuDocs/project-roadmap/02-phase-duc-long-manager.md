# Phase Đức Long — Trải nghiệm MANAGER (Backend + Frontend)

Tham chiếu: `docs/DFD-specification.md` tiến trình **P3.0** (Task & Kanban
Orchestration), **P7.2** (Manager Team Analytics). Tham chiếu tính năng:
`docs/all worktracker features-fix.md` mục "MÔI TRƯỜNG MANAGER".

## Bảng dữ liệu bạn phụ trách

```text
tasks, task_followers, task_comments, task_attachments
```

## API bạn dùng lại / có thể tự viết thêm vào app `accounts` dùng chung

**Cập nhật 29/06/2026** (theo "3 Quy tắc vàng để ghép code vô trùng
100%"): `accounts` là app dùng chung — bạn có khung sẵn
`accounts/views_manager.py` + `urls_manager.py` (đã có
`ManagerTeamEmployeeListView`). Nếu cần thêm API Manager-side trong app
này (ví dụ API gán department cho nhân viên), **tự viết thêm vào đúng 2
file đó** (class gắn tiền tố `Manager...`), không cần chờ Tuấn Tú code
sẵn rồi giao API — chỉ không đụng `models.py`/`permissions.py` của anh ấy.

```text
GET  /api/auth/team/employees/        — đã có sẵn (Tuấn Tú code), dùng thẳng cho Team Directory
POST /api/timesheets/time-locks/      — chốt sổ kỳ báo cáo (Tuấn Tú code, bạn chỉ gọi — đụng tới
                                         time_locks/log_works là dữ liệu nhạy cảm tính lương, để Tuấn Tú giữ)
Hàm notify(...)                        — gửi notification cho Employee (Tuấn Tú cung cấp, bạn .delay()/gọi vào)
API gán department cho nhân viên       — bạn TỰ VIẾT vào accounts/views_manager.py (xem trên),
                                         không cần Tuấn Tú làm hộ nữa
```

Xác nhận format các API có sẵn (2 dòng đầu + notify) với Tuấn Tú trước khi
code FE phần liên quan; phần department thì tự chủ động viết.
(xem `03-phase-tuan-tu-auth-employee.md` để biết tiến độ).

## Cập nhật 02/07/2026 — Thay đổi từ bản v2 ảnh hưởng Manager

Manager là nhóm **bị ảnh hưởng nhiều nhất** trong v2 (~70% các thay đổi). Có 2 workflow hoàn toàn mới và nhiều quyền mới được bổ sung.

### Quyền mới được cấp

| FR | Nội dung | Tuần nên làm |
|---|---|---|
| **FR-20** | Search employee theo tên/email để assign Task (API riêng) | Tuần 1 |
| **FR-25** | Xem read-only client list (để chọn khi tạo task/filter) | Tuần 1 |
| **FR-97** | Xem activity history trong scope của mình + API `/manager/activity-history/` | Tuần 4 |
| **FR-124** | Review/approve/reject/void log work của nhân viên | **Tuần 2 — xem chi tiết dưới** |
| **FR-64-66** | Lock từng Job riêng biệt (JOB-scoped lock) | **Tuần 3 — xem chi tiết dưới** |

### Quyền bị siết

- **FR-28**: Manager **không được** đổi `manager_id` của Job — chỉ Admin. Nếu cố tình gọi API PATCH Job kèm `manager_id`, backend phải chặn 403.
- **FR-88**: Filter Department trong API của Manager **luôn bị scope** theo department/team mình quản lý — không được bypass để xem dữ liệu team khác. Backend cần branch logic riêng (Manager vs Admin cho cùng endpoint filter).

### FR-124 — Workflow review log work (mới hoàn toàn)

Đây là thay đổi lớn nhất của v2 với Manager. Manager có thể review log work nhân viên submit:

```text
Nhân viên submit log work
  → review_status = 'PENDING'  (mặc định)
  → Manager xem trong Timesheet Review

Manager có 3 action:
  → Approve  → review_status = 'APPROVED'
  → Reject   → review_status = 'REJECTED'  + lý do (ghi vào response/notification)
  → Void     → review_status = 'VOIDED'    (thay thế cho "Delete" — không xóa cứng)

⚠️ Sau khi Manager Approve/Reject/Void → bắn notification cho Employee (FR-72)
```

API cần thêm:
```text
PATCH /api/timesheets/log-works/<id>/review/
Body: { "action": "approve"|"reject"|"void", "note": "lý do" }
Permission: manager:review_logwork
```

**Phối hợp**: `review_status` field phụ thuộc migration Minh Anh viết — chờ migration merge trước khi code workflow này.

### FR-64-66 — JOB-scoped time lock (thay đổi cấu trúc lớn)

V2 cho phép Manager lock **từng Job riêng biệt**, không chỉ lock toàn công ty như v1:

```text
v1: time_locks(lock_month, lock_year) → khóa toàn công ty
v2: time_locks(lock_month, lock_year, job_id)
    → job_id = NULL  : GLOBAL lock (giữ nguyên v1)
    → job_id = <id>  : chỉ khóa log work thuộc job đó
```

UI cần thêm: khi Manager bấm "Chốt báo cáo" → chọn scope: [Toàn công ty | Theo Job] → nếu chọn Job thì dropdown chọn job.

API cần cập nhật:
```text
POST /api/timesheets/time-locks/
Body: { "lock_month": 7, "lock_year": 2026, "job_id": null }   # GLOBAL
Body: { "lock_month": 7, "lock_year": 2026, "job_id": 5 }      # JOB-scoped
```

**Phối hợp**: `job_id` field phụ thuộc migration Minh Anh viết. Tuấn Tú cũng cần cập nhật LogWork check (FR-57) để check cả JOB lock, không chỉ GLOBAL.

### FR-31 — Validate job status khi tạo task

Khi Manager tạo Task, backend phải kiểm tra: Job mẹ phải đang ở status `ACTIVE` — không cho tạo Task vào Job đang `PLANNING`/`COMPLETED`/`CANCELLED`/`ON_HOLD`.

### FR-99 — Làm rõ scope Manager vs directory search

- API `/api/auth/team/employees/` (đã có) = employee trong **department của Manager đó** → dùng cho Team Directory
- API tìm kiếm để assign task (`FR-20`) = **toàn bộ employee active** — không bị scope, vì Manager có thể assign task cho người ngoài team (clarify với team nếu chưa chắc).

---

## Luồng trạng thái Task — đã chốt với team (28/06/2026)

```text
Employee làm xong task
  → Employee bấm "Submit for Review"
  → Task chuyển sang REVIEWING
  → Manager kiểm tra
      → Manager Approve  → Task chuyển sang COMPLETED (ghi completed_at)
      → Manager Reject   → Task quay lại IN_PROGRESS, Manager ghi lý do vào task_comments
                          → Employee sửa lại, lặp lại từ đầu
```

Employee **không có** nút tự complete Task của chính mình — chỉ có
`IN_PROGRESS → REVIEWING`. Mọi yêu cầu chuyển trạng thái khác từ phía
Employee phải bị chặn 403. (Tài liệu gốc `all worktracker features-fix.md`
dòng 179 có ghi chú gây hiểu lầm là Employee tự complete được — đã xác
nhận lại với team, **bỏ qua chi tiết đó**, dùng đúng luồng ở trên.)

## ⚠️ Lưu ý: `order_index` — 2 tài liệu mâu thuẫn nhau

`all worktracker features-fix.md` ghi `order_index (Integer)`, nhưng
`DATABASE_WORKTRACKER (FIXED).md` và `THỐNG_KÊ_DATABASE...md` (2 tài liệu
chi tiết hơn, đáng tin hơn) đều ghi rõ:

> `order_index: VARCHAR(255) NOT NULL` — dùng thuật toán Lexicographical
> String Indexing thay cho số nguyên, để tránh tràn số khi kéo thả liên tục.

**Dùng `VARCHAR` + Lexicographical String Indexing**, không dùng
`Integer` — nếu cần tìm hiểu thuật toán này, tìm kiếm "LexoRank algorithm"
hoặc "fractional indexing" làm tham khảo cách implement.

## Tuần 1 (29/06 → 05/07)

**Backend**
- App `tasks`: model `Task` (FK `job`, FK `assignee` → users, FK `creator` → users, `title`, `description`, `priority` enum LOW/MEDIUM/HIGH, `status` enum TODO/IN_PROGRESS/REVIEWING/COMPLETED/CANCELLED, `deadline`, `completed_at`, `order_index` — dùng Lexicographical String Indexing, không dùng số nguyên, để tránh tràn số khi kéo thả liên tục).
- Model `TaskFollower` (composite unique `task`+`user`), `TaskComment`, `TaskAttachment`.
- API tạo Task (P3.1 Task Assigner): validate `deadline` Task ≤ `deadline` Job (đọc Job từ app của Minh Anh, chỉ đọc). **⚠️ Cần xác nhận với team**: theo FR-26 của `01 workTracker System Design Document.docx`, Manager có thể cũng cần quyền **tạo/sửa Job** (không chỉ đọc) — nếu team xác nhận, bạn sẽ cần gọi API tạo Job của Minh Anh (không tự viết model `Job` riêng), và Tuấn Tú cần thêm permission `job:create`/`job:update` cho role MANAGER.
- **Setup Django Channels** (ASGI app, `routing.py`, consumer skeleton rỗng) — làm sớm vì Notification Hub của Tuấn Tú sẽ dùng chung hạ tầng này. **Lưu ý điều chỉnh**: theo `01 workTracker System Design Document.docx`, Channels/WebSocket được thiết kế để **đẩy Notification** (phát sinh từ assign/comment/review/lock...), không phải 1 channel riêng chỉ để đồng bộ trạng thái Kanban board — board vẫn cập nhật qua gọi lại REST API sau mỗi action kéo-thả, WebSocket chỉ lo phần "có sự kiện mới → bắn notification real-time".

**Frontend**
- Layout Manager (sidebar, header), routing khung.
- Tích hợp Login: dùng lại Zustand store + Axios interceptor + `ProtectedRoute`/`RoleRoute` của Tuấn Tú — không tự viết lại.
- Khung Kanban Board (`dnd-kit` hoặc `@hello-pangea/dnd` theo tài liệu), cột tĩnh trước, chưa kéo-thả thật.

## Tuần 2 (06/07 → 12/07)

**Backend**
- P3.2 Kanban Board Updater: API cập nhật `status` + `order_index` khi kéo thả.
- P3.3 Review Workflow: API duyệt/từ chối — Manager chuyển `REVIEWING → COMPLETED` (ghi `completed_at`) hoặc `REVIEWING → IN_PROGRESS` (kèm lý do, ghi vào `task_comments`). Đúng luồng đã chốt ở trên — phối hợp với Tuấn Tú để API cập nhật status phía Employee chỉ cho phép `IN_PROGRESS → REVIEWING`, chặn mọi transition khác bằng 403.
- **Celery + Redis cho gửi email nghiệm thu/reject** (theo đúng yêu cầu tài liệu — *"Django sẽ gọi thư viện Celery + Redis chạy ngầm để gửi Email thông báo... không làm chậm giao diện"*): API duyệt/từ chối **không gọi gửi email trực tiếp (đồng bộ)**, mà đẩy task vào Celery queue. Redis dùng lại instance đã có từ Giai đoạn 2 (đổi `REDIS_BLACKLIST_DB` sang db index khác cho Celery broker, không dùng chung db). Phối hợp với Tuấn Tú vì hàm gửi email thực tế nằm trong Notification Hub của anh ấy — bạn chỉ cần `.delay()` gọi task Celery, không tự viết logic gửi email.
- P3.4 Comment Handler: API thêm comment vào Task.

**Frontend**
- Kanban kéo-thả thật, gọi API cập nhật `order_index`/`status`.
- Task Detail Drawer (Shadcn UI Drawer/Sheet theo tài liệu) — xem chi tiết, danh sách follower, nút Duyệt/Từ chối, khung comment.

## Tuần 3 (13/07 → 19/07)

**Backend**
- P3.5 Attachment Handler: upload file đính kèm (lưu local media tạm thời nếu chưa có dịch vụ storage ngoài, metadata vào `task_attachments`). Theo `01 workTracker System Design Document.docx` (FR-54): nếu file đính kèm được xem là bằng chứng nghiệm thu, **phải gọi cả `notify()` và `log_audit_event()`** khi upload — không chỉ lưu file, đừng quên 2 việc này.
- NFR-21 (File Upload Reliability): nếu lưu file vật lý thất bại, **không tạo** record `task_attachments`; nếu lưu file thành công nhưng ghi metadata thất bại, phải dọn lại file đã lưu (không để rác) hoặc đánh dấu upload thất bại — đừng để 2 trạng thái (file thật vs metadata DB) lệch nhau.
- P3.6 Team Coordinator: tự viết API gán/đổi `department` cho nhân viên vào `accounts/views_manager.py` (class `ManagerAssignDepartmentView` hoặc tên tương tự, theo Quy tắc 1) — không sửa `employee_profiles` model, chỉ dùng ORM của model đã có.
- Tích hợp `log_audit_event()` (Minh Anh cung cấp cuối Tuần 3 của cô ấy) vào các hành động: tạo Task, assign, duyệt/từ chối, khóa kỳ timesheet.
- Tích hợp gọi `notify(...)` (Tuấn Tú cung cấp) khi: assign Task mới, duyệt/từ chối Task — bắt buộc theo đúng logic P3.3 đã đặc tả (*"Mọi thao tác duyệt hoặc từ chối đều phải phát sinh notification cho Employee"*).

**Frontend**
- Trang Team Directory — tài liệu cũ (`all worktracker features-fix.md`) tự ghi *"Backend: check lại backend"*, nhưng `01 workTracker System Design Document.docx` (FR-20) đã bổ sung rõ hơn: hiển thị *"full name, email, phone number, department, avatar"*, phạm vi xem = *"manager's relevant department, team, or managed project scope"*. Dùng `ManagerTeamEmployeeListView` có sẵn (đã trả đúng các field này) để hiển thị danh sách, thêm nút "Thêm/Xoá nhân viên" gọi API gán department (FR-19) bạn vừa tự viết ở trên.
- UI upload file đính kèm trong Task Drawer.

## Tuần 4 (20/07 → 26/07)

**Backend**
- P7.2 Manager Team Analytics: tỷ lệ Task trễ hạn (Overdue) trên tổng Task của team, heatmap số giờ log work theo nhân viên (đọc `log_works` của Tuấn Tú — chỉ đọc, không sửa).
- Backend cho Timesheet Review: API filter `log_works` theo `date_range`/`employee_id` (đọc dữ liệu của Tuấn Tú qua ORM) + nút gọi API `time-locks/` của Tuấn Tú để chốt sổ.

**⚠️ Quan trọng — đọc kỹ trước khi làm nút "Chốt báo cáo"**: theo
`01 workTracker System Design Document.docx` (do chính bạn viết), bảng
`time_locks` chỉ unique theo `(lock_month, lock_year)` — **không có field
phân theo team/department/manager**. Nghĩa là khi bạn (hoặc bất kỳ Manager
nào) bấm "Chốt báo cáo tháng X", **toàn bộ nhân viên công ty** bị khóa
log work tháng đó, không chỉ riêng team của bạn. Trước khi code:
- Xác nhận với team đây có phải hành vi mong muốn không (1 Manager khóa
  ảnh hưởng toàn công ty), hay cần Tuấn Tú thêm field scope
  (`department_id`/`manager_id`) vào `time_locks` trước.
- Nếu giữ nguyên hành vi toàn công ty, nên thêm cảnh báo rõ trên UI trước
  khi Manager xác nhận bấm nút (vì hậu quả lớn hơn họ tưởng).

**Frontend**
- Manager Dashboard: biểu đồ (`Recharts`/`Chart.js`) + heatmap năng suất.
- Trang Timesheet Review: filter theo ngày/nhân viên, nút "Chốt báo cáo
  tuần/tháng" — kèm dialog xác nhận nêu rõ phạm vi ảnh hưởng (toàn công ty,
  trừ khi team quyết định thêm scope như trên).

## Tuần 5 (27/07 → 02/08) — Realtime & Tích hợp

**Backend**
- Hoàn thiện WebSocket: đẩy event real-time khi có comment mới / Task đổi trạng thái (qua Channels đã setup từ Tuần 1).
- Test chéo với Tuấn Tú: Employee chuyển Task sang `REVIEWING` → bạn duyệt → Employee phải nhận được notification + thấy Task chuyển `COMPLETED` đúng.
- Test chéo: khóa kỳ timesheet → Employee bị chặn log work đúng kỳ đó (xác nhận lỗi 403 đúng từ phía Tuấn Tú).

**Frontend**
- Kết nối WebSocket thật ở Kanban/Task Drawer, hiển thị toast khi có event mới (`react-hot-toast` theo tài liệu).

## Buffer cuối (03/08 → 06/08)

- Rà lại state machine chuyển trạng thái Task — không có đường nào cho phép Employee tự hoàn thành Task của mình.
- Xác nhận mọi action nhạy cảm trong app `tasks` đã gọi `log_audit_event()`.
- Không thêm tính năng mới — chỉ sửa lỗi phát hiện được khi test chéo.
