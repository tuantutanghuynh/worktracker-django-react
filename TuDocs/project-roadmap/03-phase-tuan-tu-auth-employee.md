# Phase Tuấn Tú — Authentication (dùng chung) + Trải nghiệm EMPLOYEE

Tham chiếu: `docs/DFD-specification.md` tiến trình **P1.0** (Authentication
& Authorization), **P4.0** (Log Work & Time Lock Engine), **P5.0**
(Notification Hub), **P6.0** (Profile Management), **P7.3** (Employee
Personal KPI).

## Cập nhật 02/07/2026 — Thay đổi từ bản v2 ảnh hưởng Auth + Employee

Employee **không có quyền mới**, nhưng workflow hàng ngày thay đổi ở 4 điểm. Auth không bị ảnh hưởng bởi v2.

### FR-58 — Void thay vì Delete log work

Employee **không còn được xóa** log work. Thay vào đó:
- Button UI đổi từ "Xóa" → "Void" (kèm dialog xác nhận)
- API: `DELETE /api/timesheets/log-works/<id>/` → đổi thành `PATCH /api/timesheets/log-works/<id>/void/`
- Backend: set `review_status = 'VOIDED'` thay vì xóa record — giữ lịch sử để audit

```text
Permission cần: logwork:void  (thêm vào migration seed cho EMPLOYEE)
```

Employee chỉ được void log work khi `review_status = 'PENDING'` — không được void log work đã `APPROVED`.

### FR-57 — LogWork check thêm JOB lock (ngoài GLOBAL lock)

Serializer `LogWorkSerializer.validate()` hiện chỉ check GLOBAL time lock. V2 cần check thêm JOB-scoped lock:

```python
# Thứ tự kiểm tra:
# 1. Check GLOBAL lock (lock_month, lock_year, job_id=None) — như v1
# 2. Check JOB lock (lock_month, lock_year, job_id=task.job_id) — mới v2
# → Nếu 1 trong 2 match → 403 kèm message rõ: "GLOBAL lock" hoặc "JOB lock"
```

**Phụ thuộc**: cần migration `job_id` vào `time_locks` (Minh Anh viết) trước khi implement.

### FR-72 — 3 loại notification mới từ workflow review log work

Khi Manager approve/reject/void log work của nhân viên, hệ thống phải bắn notification cho nhân viên đó. Tuấn Tú cần thêm 3 type mới vào hàm `notify()`:

```python
notify(user=employee, type="LOG_WORK_APPROVED", title="Log work của bạn đã được duyệt", ...)
notify(user=employee, type="LOG_WORK_REJECTED", title="Log work của bạn bị từ chối", content=note, ...)
notify(user=employee, type="LOG_WORK_VOIDED",   title="Log work của bạn đã bị void", ...)
```

Đức Long sẽ gọi `notify()` này từ endpoint review của anh ấy — đảm bảo 3 type trên được hỗ trợ trước khi Đức Long tích hợp.

### FR-39 — Kanban drag-drop validate chặt hơn (phối hợp với Đức Long)

Employee kéo thả Task trên Kanban phải bị validate: không được kéo Task vào column không hợp lệ với trạng thái hiện tại. Frontend cần disable column không hợp lệ khi đang kéo.

```text
Employee chỉ được kéo: IN_PROGRESS → REVIEWING (Submit for Review)
Không được: TODO → COMPLETED, REVIEWING → IN_PROGRESS (chỉ Manager Reject mới được)
```

Logic validate này nằm ở **Backend của Đức Long** (API cập nhật status) — Frontend của Tuấn Tú chỉ cần disable UI column + hiện error message từ 403 trả về.

### Permission mới cần seed (migration mới sau 0003)

```python
# Thêm cho role EMPLOYEE
{"code": "logwork:void", "name": "Void log work của mình"}

# Thêm cho role MANAGER
{"code": "manager:search_employee",       "name": "Search nhân viên để assign task"},
{"code": "manager:view_client_list",      "name": "Xem danh sách client (read-only)"},
{"code": "manager:lock_job",              "name": "Khóa timesheet theo từng job"},
{"code": "manager:view_activity_history", "name": "Xem activity history trong scope"},
{"code": "manager:review_logwork",        "name": "Review/approve/reject/void log work"},
```

---

## Trạng thái hiện tại (đã xong trước khi roadmap này bắt đầu)

```text
✅ Giai đoạn 1 — Login/Refresh (JWT)
✅ Giai đoạn 2 — Logout & Redis Blacklist
✅ Giai đoạn 3 — RBAC (HasPermission) + 2 API mẫu (DisableUserView, TeamEmployeeListView)
✅ Giai đoạn 4 — Forgot/Reset Password
```

Chi tiết đầy đủ: `TuDocs/auth-guide/giai-doan-1-log/` đến `giai-doan-4-log/`.

## Bảng dữ liệu bạn phụ trách

```text
roles, permissions, role_permissions, users, password_resets   — Auth
departments, employee_profiles                                  — dùng chung mọi role
time_locks, log_works, daily_user_timesheets                    — Timesheet
notifications                                                    — Notification Hub
```

## ⚠️ Việc ưu tiên số 1 tuần đầu — Minh Anh và Đức Long đang chờ

**Frontend auth kit dùng chung** — cả 2 người kia sẽ tích hợp `ProtectedRoute`,
`RoleRoute`, Zustand store, Axios interceptor của bạn vào layout của họ
ngay từ Tuần 1. Làm xong **sớm nhất có thể** trong Tuần 1, báo ngay cho cả
nhóm cách import/dùng, đừng để việc này trôi sang Tuần 2.

## Tuần 1 (29/06 → 05/07)

**Backend**
- Giai đoạn 5 (đã roadmap sẵn ở `auth-guide/10-review-tien-do.md`): thêm field `must_change_password` vào `CustomUser` + migrate; logic chặn API khi `True` (trừ API đổi password).
- **Đã áp dụng "3 Quy tắc vàng để ghép code vô trùng 100%" (29/06/2026)**: app `accounts` giờ dùng chung — đã tạo khung `views_admin.py`/`urls_admin.py` (Minh Anh) và `views_manager.py`/`urls_manager.py` (Đức Long, đã có `ManagerTeamEmployeeListView`). **Không cần tự code API tạo user/CRUD Department/mở khóa tài khoản để "giao" cho Minh Anh nữa** — cô ấy tự viết vào `views_admin.py` của mình. Việc của bạn ở đây chỉ còn: thêm 1 permission mới (`department:manage`/`user:create` nếu thiếu) qua **migration mới** khi Minh Anh cần, seed cho role ADMIN — không sửa migration `0002`/`0003` đã chạy.
- Báo cả nhóm cấu trúc file mới của `accounts` (xem `00-tong-quan.md` mục "3 Quy tắc vàng") để Minh Anh/Đức Long biết file nào của mình.

**Frontend**
- Zustand store (`accessToken`/`refreshToken`/`user`), Axios instance + interceptor tự refresh token khi 401.
- `ProtectedRoute`, `RoleRoute`, `PermissionRoute`.
- Trang Login, Forgot Password, Reset Password (`react-hook-form` + `zod`).

## Tuần 2 (06/07 → 12/07)

**Backend**
- Notification Hub (P5.0): hàm dùng chung `notify(user, title, content, type, related_url)` — ghi vào `notifications`, đây là điểm Minh Anh/Đức Long sẽ gọi vào khi có event (review task, khóa timesheet...). API list + mark-as-read cho Employee.
- **Cài Celery** (`pip install celery`), cấu hình broker dùng lại Redis đã có (đổi `REDIS_BLACKLIST_DB` hoặc thêm db index riêng cho Celery, không dùng chung db với blacklist). Viết Celery task `send_notification_email(...)` — đây là phần Đức Long sẽ gọi `.delay()` vào khi Manager duyệt/từ chối Task (theo đúng yêu cầu *"Celery + Redis chạy ngầm để gửi Email... không làm chậm giao diện"*). Báo cả nhóm cách chạy `celery -A worktracker_core worker` song song với `runserver` khi dev.
- Theo NFR-20 (`01 workTracker System Design Document.docx`): nếu gửi email lỗi do mạng/SMTP tạm thời, Celery task nên **tự retry** (Celery có sẵn `autoretry_for`/`retry_backoff`, không cần tự viết loop retry tay).
- Profile Management (P6.0): API cập nhật profile (`full_name`, `phone_number`), upload avatar (lưu local media tạm, ghi `avatar_url`).
- **Bắt đầu app `timesheets`** (theo roadmap đã viết sẵn ở `TuDocs/timesheet-guide/08-roadmap-and-talking-points.md`, Giai đoạn 1-2): API Log Work cơ bản (`LogWorkView`), sau đó thêm Pessimistic Locking (`select_for_update`) chống Race Condition khi cộng dồn giờ trong `daily_user_timesheets`.

**Frontend**
- Layout Employee, routing khung.
- Trang Profile (sửa info, upload avatar).

## Tuần 3 (13/07 → 19/07)

**Backend**
- Hoàn thiện `timesheets` (Giai đoạn 3-4 trong roadmap timesheet-guide): API `TimeLock` (chốt sổ kỳ báo cáo — Đức Long sẽ gọi API này từ trang Timesheet Review của anh ấy), thêm Lớp phòng thủ 1 (check Time Lock) vào API Log Work.
- Phối hợp với Đức Long: xác nhận API "My Tasks" / cập nhật status Task (chỉ `IN_PROGRESS → REVIEWING`) — API này nằm trong app `tasks` của Đức Long, bạn **không viết lại**, chỉ tích hợp gọi từ Frontend Employee.
- Bắt đầu P7.3 Employee Personal KPI: API thống kê cá nhân (số Task quá hạn, tổng giờ log trong tuần, tỷ lệ hoàn thành) — đọc dữ liệu của chính `request.user` (Data Isolation).

**Frontend**
- Trang "My Tasks": list/filter Task được giao (gọi API của Đức Long), Drawer xem chi tiết, nút chuyển trạng thái `Ready for Review`.
- Trang Log Work / Quick Log: form nhập giờ (`react-hook-form`, disable nút khi submit — chống Double Submit, đã phân tích kỹ ở `timesheet-guide/06-frontend-architecture.md`).

## Tuần 4 (20/07 → 26/07)

**Backend**
- Hoàn thiện P7.3 (nếu chưa xong Tuần 3).
- Đảm bảo mọi action nhạy cảm của bạn (tạo user, khóa/mở tài khoản, đổi password, log work, chốt timesheet) đã gọi `log_audit_event()` của Minh Anh (cô ấy giao hàm này cuối Tuần 3 của cô ấy — tích hợp ngay khi nhận được).

**Frontend**
- Trang Personal Dashboard: KPI box (Tremor/Shadcn Card theo tài liệu), nút "Quick Log" ngay trên Dashboard.
- Notification Center (biểu tượng chuông): list thông báo, đánh dấu đã đọc, đếm số chưa đọc.

## Tuần 5 (27/07 → 02/08) — Realtime & Tích hợp

**Backend**
- Kết nối Notification Hub vào WebSocket/Channels (hạ tầng Đức Long đã setup từ Tuần 1) — để Notification đẩy real-time, không chỉ lưu DB.
- Test chéo: Manager duyệt/từ chối Task → Employee nhận notification đúng; Manager khóa kỳ timesheet → Employee bị chặn log work đúng kỳ đó (403).

**Frontend**
- Notification Center nhận real-time qua WebSocket (`react-use-websocket` theo tài liệu), toast khi có thông báo mới.
- Rà lại toàn bộ trang Employee đã dùng đúng `ProtectedRoute` chưa.

## Buffer cuối (03/08 → 06/08)

- Rà lại toàn bộ API Auth (Login/Logout/RBAC/Forgot Password) một lần cuối — đây là phần nền cả 2 người kia phụ thuộc vào, lỗi ở đây ảnh hưởng toàn hệ thống.
- Xác nhận `must_change_password` chặn đúng mọi API trừ API đổi password.
- Không thêm tính năng mới — chỉ sửa lỗi phát hiện được khi test chéo với Minh Anh/Đức Long.
