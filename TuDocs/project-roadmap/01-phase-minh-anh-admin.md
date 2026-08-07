# Phase Minh Anh — Trải nghiệm ADMIN (Backend + Frontend)

Tham chiếu: `docs/DFD-specification.md` tiến trình **P2.0** (System Core
Management), **P7.1** (Admin Global Metrics), **P8.0** (Audit & Compliance
Logging). Tham chiếu tính năng: `docs/all worktracker features-fix.md`
mục "MÔI TRƯỜNG ADMIN".

## Bảng dữ liệu bạn phụ trách

```text
clients   — Khách hàng/đối tác gốc (Soft Delete, không xóa cứng)
jobs      — Dự án mẹ, gắn client + manager
audit_logs — Lịch sử thao tác toàn hệ thống
```

## `users`/`roles`/`departments`/`employee_profiles` — app dùng chung với Tuấn Tú

**Cập nhật 29/06/2026** (theo "3 Quy tắc vàng để ghép code vô trùng 100%"):
đây **không phải** "chỉ gọi API có sẵn của Tuấn Tú" — `accounts` là app
**dùng chung**, bạn được tự viết API của riêng mình vào đó, miễn đúng quy
ước file:

```text
accounts/views_admin.py        ← bạn tự viết view tại đây (khung đã có sẵn)
accounts/serializers_admin.py  ← tự tạo file này khi cần serializer riêng
accounts/urls_admin.py         ← bạn tự thêm route tại đây (khung đã có sẵn)
```

Class tự viết phải gắn tiền tố `Admin` (Quy tắc 1), ví dụ
`AdminCreateUserView`, `AdminAssignRoleSerializer`.

**Không đụng vào** (phần lõi Tuấn Tú giữ, cần thống nhất trước khi sửa):
`accounts/models.py`, `accounts/permissions.py`,
`accounts/authentication.py`, `accounts/redis_client.py`,
`views_auth.py`/`serializers_auth.py`/`urls_auth.py` (Login/Logout/Forgot
Password — dùng chung mọi vai trò).

`worktracker_core/urls.py` đã có sẵn khu vực dành cho bạn:
```python
# ================= KHU VỰC CỦA ADMIN (MINH ANH) =================
path('api/auth/', include('accounts.urls_admin')),
```
Bạn chỉ `include()` thêm route mới vào đúng khu vực này, không sửa khu
vực của người khác.

Trang "Quản lý Nhân sự & Phân quyền" và "Quản lý Phòng ban" bạn xây ở
Frontend, nhưng API gọi tới là của Tuấn Tú — phối hợp xác nhận format
request/response trước khi code FE phần này (dự kiến sẵn sàng cuối Tuần 1
— xem `03-phase-tuan-tu-auth-employee.md`).

## Cập nhật 02/07/2026 — Thay đổi từ bản v2 ảnh hưởng Admin

Admin **ít bị ảnh hưởng nhất** trong v2 — chủ yếu làm rõ và củng cố quyền đã có, không có workflow hoàn toàn mới. Nhưng có 2 nhiệm vụ schema mới giao cho Minh Anh (workload nhẹ nhất trong 3 người).

### Quyền được clarify/củng cố

- **FR-28**: Admin là người **DUY NHẤT** được đổi `manager_id` của Job — Manager không có quyền này. Mọi lần đổi `manager_id` phải gọi `log_audit_event()` (yêu cầu audit).
- **Section 8 — Job Status Transition**: Admin có **full quyền** đổi mọi status + **độc quyền reopen** Job đã `COMPLETED`/`CANCELLED`. Manager chỉ được chuyển theo luồng thuận chiều, không được reopen. UI Admin cần dialog xác nhận + lý do khi reopen.
- **FR-97**: Admin giữ **full audit log access** — không bị giới hạn theo scope (khác Manager chỉ xem trong team).

### Quyền được mở rộng

- **FR-64-66**: Admin có thể lock **cả JOB scope lẫn GLOBAL scope** (v1 chỉ có GLOBAL). UI cần thêm branching: chọn scope → nếu JOB thì chọn job_id. Đây là lý do migration `time_locks` cần thêm `job_id` (xem dưới).
- **FR-89**: Admin có thể filter VOIDED log work trong timesheet report (cho mục đích audit). Manager không thấy VOIDED trong view của mình.

### 2 Schema migration mới — Minh Anh viết

PDF phân tích v2 đề xuất giao 2 migration này cho Admin dev (workload nhẹ nhất, infrastructure shared):

**Migration 1 — `time_locks` thêm `job_id`:**
```python
# Thêm vào app timesheets/migrations/
migrations.AddField(
    model_name='timelock',
    name='job',
    field=models.ForeignKey(
        'jobs.Job', null=True, blank=True,
        on_delete=models.SET_NULL,
        help_text="NULL = GLOBAL lock, có giá trị = JOB-scoped lock"
    ),
)
# Cập nhật unique constraint: (lock_month, lock_year, job) thay vì (lock_month, lock_year)
```

**Migration 2 — `log_works` thêm `review_status`:**
```python
# Thêm vào app timesheets/migrations/
migrations.AddField(
    model_name='logwork',
    name='review_status',
    field=models.CharField(
        max_length=20,
        choices=[('PENDING','PENDING'),('APPROVED','APPROVED'),
                 ('REJECTED','REJECTED'),('VOIDED','VOIDED')],
        default='PENDING'
    ),
)
```

⚠️ **Phối hợp**: Tuấn Tú (LogWork API) và Đức Long (review workflow) đều phụ thuộc 2 migration này — làm **sớm nhất có thể trong Tuần 1/2**, báo 2 người kia ngay khi merge xong.

---

## Tuần 1 (29/06 → 05/07)

**Backend**
- App `clients`: model `Client` (`client_name`, `tax_code` unique, `contact_person`, `contact_email`, `contact_phone`, `is_active` — Soft Delete, không có lệnh xóa cứng).
- API CRUD `Client`: dùng `HasPermission` (đã có sẵn ở `accounts/permissions.py`, copy cách dùng từ `DisableUserView`) với `required_permission = "client:create"` / `"client:update"` (2 permission này **đã seed sẵn** cho role ADMIN từ Giai đoạn 3 — không cần thêm migration mới).
- Override `destroy()` trong ModelViewSet (nếu dùng ViewSet) hoặc tự viết action riêng để set `is_active=False` thay vì `DELETE` thật.

**Frontend**
- Layout Admin (sidebar, header), routing khung (`react-router-dom`).
- Tích hợp Login: dùng lại Zustand store + Axios interceptor + `ProtectedRoute`/`RoleRoute` do Tuấn Tú cung cấp (xem file 03) — **không tự viết lại** phần này.
- Trang danh sách Client: `TanStack Table` (pagination + search qua URL, theo đúng tài liệu), form tạo/sửa Client (`react-hook-form` + `zod`).

## Tuần 2 (06/07 → 12/07)

**Backend**
- App `jobs`: model `Job` (FK `client`, FK `manager` → `users`, `job_name`, `start_date`, `deadline`, `status` enum gồm `PLANNING/ACTIVE/COMPLETED/ON_HOLD/CANCELLED` — không xóa cứng Job, chỉ đổi status sang `CANCELLED`, theo đúng `01 workTracker System Design Document.docx` FR-30). Validate: chỉ tạo Job khi `client.is_active=True` (kiểm tra ở tầng Serializer, không tin ràng buộc DB vì FK không tự check cờ Soft Delete).
- API CRUD `Job` (`required_permission = "job:create"` / `"job:update"`).
- **⚠️ Cần xác nhận với team**: `01 workTracker System Design Document.docx` (FR-26) ghi *"Admin or authorized Manager users"* được tạo Job — nhưng `all worktracker features-fix.md` xếp hẳn vào trang Admin. Permission `job:create`/`job:update` hiện **chỉ seed cho ADMIN** (Giai đoạn 3). Nếu team xác nhận Manager cũng cần tạo/sửa Job, báo Tuấn Tú thêm migration gán permission cho MANAGER — không tự seed lại, tránh đụng code app `accounts`.

**Frontend**
- Trang Master Job Management: form tạo Job (validate `deadline > start_date` bằng `zod`), gắn Client + Manager qua dropdown.
- Trang "Quản lý Nhân sự & Phân quyền": list user, form tạo user mới (gọi API Tuấn Tú), gán Role, nút khóa/mở tài khoản (gọi `DisableUserView` đã có sẵn + API mở khóa khi Tuấn Tú bổ sung).
- Trang "Quản lý Phòng ban": CRUD Department (gọi API Tuấn Tú).

## Tuần 3 (13/07 → 19/07)

**Backend**
- App `audit_logs` (hoặc app `system` theo cấu trúc cũ): model `AuditLog` (`actor_id`, `action`, `table_name`, `record_id`, `old_values`/`new_values` JSON, `ip_address`, `created_at`).
- Viết 1 hàm/utility dùng chung, ví dụ `log_audit_event(actor, action, table_name, record_id, old_values, new_values, request)` — để **Đức Long và Tuấn Tú gọi vào** từ code của họ khi có hành động nhạy cảm (tạo/sửa job, assign task, khóa timesheet...). Thông báo cho cả 2 người cách gọi hàm này **ngay khi xong**, vì họ cần tích hợp trước Tuần 4.
- API tra cứu Audit Log (`required_permission = "audit:view"` — đã seed sẵn cho ADMIN): filter theo `actor_id`/`action`/`table_name`/khoảng ngày.

**Frontend**
- Trang Audit Logs: bảng tra cứu + filter, hiển thị `old_values`/`new_values` dạng diff dễ đọc.

## Tuần 4 (20/07 → 26/07)

**Backend**
- P7.1 Admin Global Metrics: 1 endpoint tổng hợp (dùng `aggregate()`/`annotate()` của Django ORM — **không trả raw data về cho FE tự tính**, theo đúng yêu cầu tài liệu): tổng Client active, tổng Job đang chạy, tổng giờ làm toàn công ty trong tháng (đọc từ `daily_user_timesheets` — bảng của Tuấn Tú, chỉ đọc, không sửa). Theo FR-82 (`01 workTracker System Design Document.docx`), Dashboard còn cần thêm **"Task status overview"** (đếm Task theo từng status) — đọc thêm từ `tasks` của Đức Long, cũng chỉ đọc qua ORM.
- Theo dõi & nhắc Đức Long/Tuấn Tú tích hợp gọi `log_audit_event()` vào code của họ.

**Frontend**
- Admin Dashboard: biểu đồ bằng `Recharts`/`Tremor` (theo đúng gợi ý tài liệu) hiển thị các chỉ số P7.1.

## Tuần 5 (27/07 → 02/08) — Tích hợp & Export

**Backend**
- P7.5 Export Generator (tuỳ thời gian — có thể lùi sang buffer cuối nếu gấp): xuất Excel/PDF báo cáo toàn hệ thống theo filter (date range, department, job, status). Đọc dữ liệu cross-app (jobs của bạn, tasks/log_works của Đức Long/Tuấn Tú) — chỉ đọc qua ORM, không sửa.
- Audit Event cho hành vi export (gọi `log_audit_event`).

**Frontend**
- Nút Export ở Dashboard + Audit Logs.
- Test chéo: tạo user mới → login bằng user đó → khóa tài khoản → xác nhận user bị văng ngay (đã có cơ chế từ phần Auth của Tuấn Tú, chỉ cần xác nhận UI Admin phản ánh đúng trạng thái).

## Buffer cuối (03/08 → 06/08)

- Rà lại toàn bộ API đã làm có áp dụng đúng `HasPermission` chưa (không API nào quên required_permission).
- Xác nhận mọi hành động nhạy cảm trong app của bạn đã gọi `log_audit_event()`.
- Không thêm tính năng mới — chỉ sửa lỗi phát hiện được khi test chéo với Đức Long/Tuấn Tú.
