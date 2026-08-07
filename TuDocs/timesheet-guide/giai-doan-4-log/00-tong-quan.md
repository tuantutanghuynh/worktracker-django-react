# Giai đoạn 4 — Sau merge team: FR-57/58/72, Audit Log, Notification API

Bản ghi lại toàn bộ việc làm ngày **22/07/2026**, nối tiếp
[giai-doan-3-log](../giai-doan-3-log/). Khác với các giai đoạn trước, ngày
này bắt đầu bằng 1 sự kiện lớn ngoài phạm vi `timesheets` — merge code thật
với 2 nhánh còn lại của team — rồi mới quay lại làm tiếp các FR còn thiếu
theo `project-roadmap/03-phase-tuan-tu-auth-employee.md`.

## Bối cảnh: merge team (tóm tắt, chi tiết đầy đủ ở nơi khác)

Thực hiện merge thật `origin/LongNguyen` + `origin/MinhAnh` vào nhánh
`TuanTu`, trên nhánh mới `merge-team-integration` (chưa push), theo kịch
bản đã viết ở
`TuDocs/progress-report/11-tong-hop-xung-dot-va-ke-hoach-merge-toi-uu.md`.
4 commit, không có trailer AI, message tiếng Anh ngắn gọn:

```text
0d60ab5 Reconcile the 3 divergent accounts/CustomUser designs and merge requirements.txt ahead of the team branch merges.
d8996cf Merge origin/LongNguyen: keep our auth/JWT setup, take Long's fuller timesheets manager code, and drop the empty scaffold apps.
cd83bf9 Merge origin/MinhAnh: fix an admin/ package name collision and a HasPermission signature mismatch found along the way.
cc59f8c Fix TimeLock migration: backfill legacy rows to GLOBAL scope instead of the JOB default, which violated the new check constraint on existing data.
```

Chi tiết đầy đủ (từng file conflict, quyết định resolve, bug phát sinh
ngoài kế hoạch) → xem `TuDocs/progress-report/11-...md` +
memory nội bộ (không lặp lại ở đây). Chỉ nêu 2 điều ảnh hưởng trực tiếp tới
`timesheets`:

1. **`TimeLock` giờ có `lock_scope` (GLOBAL/JOB) + `job` FK** — trước đây
   chỉ có khóa GLOBAL theo `(month, year)`. Đây là lý do phát sinh
   **Giai đoạn 4a** dưới đây — code cũ ở Giai đoạn 3-4 (giai-doan-3-log) chỉ
   check GLOBAL, giờ sai vì thiếu nửa logic.
2. **`ManagerTimeLockView` (bản 26 dòng, tự viết ở Giai đoạn 3) không còn
   tồn tại** — bị thay hoàn toàn bởi `ManagerTimeLockViewSet` (463 dòng,
   đầy đủ unlock + lý do) của Đức Long. Từ nay **TimeLock API hoàn toàn
   thuộc quyền sở hữu của Đức Long**, không phải Tuấn Tú nữa — khác với giả
   định ban đầu ở `giai-doan-3-log/00-tong-quan.md`.

## Phạm vi đã hoàn thành hôm nay

| # | Việc | Trạng thái |
|---|------|:---:|
| 1 | Merge team 3 nhánh (không tính vào giai đoạn timesheets, xem bối cảnh trên) | ✅ |
| 2 | FR-72 — thêm 3 `EventType` cho notification (`LOG_WORK_APPROVED/REJECTED/VOIDED`) | ✅ |
| 3 | FR-57 — sửa Time Lock check thành 2 lớp GLOBAL + JOB (bug thật, không phải thiếu tính năng) | ✅ |
| 4 | FR-58 — Employee void log work (thay vì xoá), permission `logwork:void` | ✅ |
| 5 | Tích hợp `log_audit_event`/`log_action` vào đổi mật khẩu + tạo/void log work | ✅ |
| 6 | API list + mark-as-read notification cho Employee | 🟡 Đã đưa code mẫu, **chưa được người học gõ/áp dụng** |

## Cây file đã tạo/sửa

```text
backend/
├── system/models.py                    ← sửa: thêm 3 EventType (LOG_WORK_*)
├── system/migrations/0005_...py        ← tự sinh: AlterField event_type (no-op ở DB)
├── accounts/migrations/0006_...py      ← tạo mới: seed permission logwork:void
├── accounts/serializers_auth.py        ← sửa: apply_new_password() trả về user
├── accounts/views_auth.py              ← sửa: log_audit_event() trong Reset/ChangePassword
├── timesheets/serializers_employee.py  ← sửa: Time Lock 2 lớp + log_action() khi tạo
└── timesheets/views_employee.py        ← sửa: thêm EmployeeVoidLogWorkView
```

(Phần notification API — `system/views_employee.py`,
`system/serializers_employee.py`, `system/urls_employee.py` — **chưa tồn
tại**, mới ở dạng code mẫu đưa ra, xem file 05.)

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-fr57-job-scope-timelock-check.md](01-fr57-job-scope-timelock-check.md) | Bug `.filter().first()` không lọc `job`, sửa thành 2 query tách biệt |
| 2 | [02-fr58-void-logwork.md](02-fr58-void-logwork.md) | Void thay Delete, tái dùng `rebuild_daily_user_timesheet()` của Đức Long |
| 3 | [03-audit-log-integration.md](03-audit-log-integration.md) | 2 helper `log_audit_event`/`log_action` cùng tồn tại, vì sao không gộp, vì sao không log password |
| 4 | [04-notification-eventtype-fr72.md](04-notification-eventtype-fr72.md) | Thêm `EventType`, bug hiểu sai của Claude về migration (`choices` không cần migration — sai), verify bằng `sqlmigrate` |
| 5 | [05-notification-api-de-xuat.md](05-notification-api-de-xuat.md) | Code đề xuất cho API list + mark-as-read — **chưa áp dụng**, còn nợ |

## Nguyên tắc đáng nhớ nhất để trình bày với team

1. **Quyền sở hữu bảng có thể đổi chủ khi merge** — `TimeLock` API không
   còn là của Tuấn Tú sau khi merge với Long, dù model gốc do Tuấn Tú viết.
   Đừng giả định quyền sở hữu cũ còn đúng sau 1 merge lớn — kiểm tra lại.
2. **`choices=` trên field không tạo CheckConstraint ở DB** — chỉ validate
   ở tầng Python/Admin/DRF. Đổi `choices` vẫn sinh migration (để đồng bộ
   "sổ sách" của Django), nhưng SQL thật là `(no-op)` — có thể verify bằng
   `manage.py sqlmigrate`.
3. **Không log giá trị mật khẩu vào AuditLog**, kể cả đã hash — chỉ log
   action + actor + record_id là đủ cho mục đích audit trail.
