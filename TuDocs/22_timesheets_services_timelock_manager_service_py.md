# Executive Code Annotation: `backend/timesheets/services/timelock_manager_service.py`

**Package / Module:** `backend.timesheets.services.timelock_manager_service` · Time Lock Management Service

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Quy Trình Lock / Unlock Kỳ Công (Time Lock State Transition & Notification Flow)

```
                       ┌──────────────────────────────────────────┐
                       │   Manager Lock/Unlock Request (Job)      │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       assert_job_in_manager_scope(user, job)
                       validate_month_year(lock_month, lock_year)
                                            │
                                            ▼
                                 transaction.atomic()
                                            │
                 ┌──────────────────────────┴──────────────────────────┐
                 ▼                                                     ▼
         [lock_job_period]                                     [unlock_job_period]
                 │                                                     │
                 ├─► select_for_update() TimeLock                      ├─► Check unlock_reason non-empty
                 ├─► Set is_locked = True                              ├─► select_for_update() TimeLock
                 ├─► Record locked_by & locked_at                      ├─► Set is_locked = False
                 │                                                     ├─► Record unlocked_by & unlocked_at
                 └──────────────────────────┬──────────────────────────┘
                                            │
                                            ▼
                              log_action() Audit Trail
                                            │
                                            ▼
                    notify(recipients=Manager + Assignees of Job)
                                            │
                                            ▼
                                     Return TimeLock
```

> **Vì sao khi Unlock kỳ công lại bắt buộc phải truyền `unlock_reason` (Lý do mở khóa)?**
> Việc khóa sổ kỳ công là một chốt chặn tài chính. Mở khóa lại đồng nghĩa với việc cho phép thay đổi dữ liệu quá khứ. Việc bắt buộc nhập `unlock_reason` ở cả tầng service lẫn API đảm bảo tính minh bạch kiểm toán (Audit Traceability), tránh việcManager mở khóa tùy tiện mà không có căn cứ.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from django.db import transaction
# Nạp công cụ quản lý giao dịch CSDL.

2: from django.utils import timezone
# Nạp công cụ múi giờ chuẩn.

3: from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
# Nạp các lớp ngoại lệ của DRF.

5: from tasks.models import Task
6: from timesheets.models import TimeLock
7: from system.models import Notification
8: from system.services.audit_manager_service import snapshot, log_action
9: from system.services.notification_manager_service import notify
# Nạp các models và services liên quan.

12: class TimeLockError(APIException):
13:     status_code = 400
14:     default_detail = "Time lock rule violation."
15:     default_code = "time_lock_error"
# Exception custom cho các vi phạm quy tắc TimeLock.

18: def get_period_from_date(work_date):
19:     return work_date.month, work_date.year
# Hàm hỗ trợ tách tháng và năm từ đối tượng date.

22: def assert_job_in_manager_scope(user, job):
23:     if job.manager_id != user.id:
24:         raise PermissionDenied("JOB_OUT_OF_MANAGER_SCOPE")
# Kiểm tra phạm vi quản lý: Ném PermissionDenied nếu Job không thuộc quyền quản lý của user này.

30: def validate_month_year(lock_month, lock_year):
# Kiểm tra định dạng hợp lệ của tháng (1..12) và năm (>= 2000).

60: def is_global_period_locked(lock_month, lock_year):
# Kiểm tra cờ khóa GLOBAL toàn hệ thống cho tháng/năm.

70: def is_job_period_locked(job_id, lock_month, lock_year):
# Kiểm tra cờ khóa JOB riêng cho một dự án cụ thể.

80: def is_period_locked(job_id, lock_month, lock_year):
# Một kỳ bị coi là khóa nếu có cờ GLOBAL lock HOẶC cờ JOB lock đang active.

92: def assert_period_open_for_job(job_id, work_date):
# Chốt chặn kiểm tra kỳ công đã mở. Dùng trước khi thực hiện review/correct/void LogWork. Ném TimeLockError nếu bị khóa.

105: def get_job_timesheet_recipient_ids(job):
# Lấy danh sách ID người nhận thông báo lock/unlock bao gồm Manager của Job và tất cả nhân viên được phân công task trong Job.

126: def lock_job_period(
127:     *,
128:     user,
129:     job,
130:     lock_month,
131:     lock_year,
132:     reason=None,
133:     request=None,
134: ):
# Service thực hiện khóa kỳ công theo Job cho Manager.

141:     assert_job_in_manager_scope(user, job)
142:     validate_month_year(lock_month, lock_year)
# Kiểm tra quyền hạn và định dạng thời gian.

146:     with transaction.atomic():
# Mở Atomic Transaction.

147:         existing_lock = (
148:             TimeLock.objects.select_for_update()
149:             .filter(
150:                 lock_scope=TimeLock.LockScope.JOB,
151:                 job=job,
152:                 lock_month=lock_month,
153:                 lock_year=lock_year,
154:             )
155:             .first()
156:         )
# Tìm và khóa dòng bản ghi TimeLock tương ứng.

158:         if existing_lock and existing_lock.is_locked:
159:             raise TimeLockError("JOB_PERIOD_ALREADY_LOCKED")
# Nếu đã ở trạng thái khóa thì ném lỗi.

161:         if existing_lock:
162:             old_values = snapshot(existing_lock)
163:             existing_lock.is_locked = True
164:             existing_lock.locked_by = user
165:             existing_lock.locked_at = timezone.now()
166:             existing_lock.lock_reason = clean_reason
167:             existing_lock.unlocked_by = None
168:             existing_lock.unlocked_at = None
169:             existing_lock.unlock_reason = None
171:             existing_lock.save(...)
# Cập nhật lại bản ghi cũ đã từng unlock thành locked.

186:         else:
187:             time_lock = TimeLock.objects.create(...)
# Tạo mới bản ghi TimeLock nếu chưa từng có.

199:         log_action(...)
# Ghi nhật ký kiểm toán LOCK_TIMESHEET.

209:         notify(...)
# Gửi thông báo hệ thống TIMESHEET_LOCK đến tất cả nhân sự liên quan trong Job.

218:     return time_lock

221: def unlock_job_period(
222:     *,
223:     user,
224:     time_lock,
225:     reason,
226:     request=None,
227: ):
# Service mở khóa kỳ công theo Job.

233:     if not reason or not str(reason).strip():
234:         raise ValidationError({"reason": "Unlock reason is required."})
# Bắt buộc phải có lý do mở khóa.

242:     with transaction.atomic():
243:         locked_time_lock = (
244:             TimeLock.objects.select_for_update()
245:             .select_related("job")
246:             .get(pk=time_lock.pk)
247:         )
# Khóa dòng dòng bản ghi TimeLock.

249:         if locked_time_lock.lock_scope != TimeLock.LockScope.JOB:
250:             raise PermissionDenied("MANAGER_CAN_ONLY_UNLOCK_JOB_SCOPE")
# Manager chỉ được phép unlock phạm vi JOB, không được unlock GLOBAL.

252:         assert_job_in_manager_scope(user, locked_time_lock.job)
# Đảm bảo Job thuộc phạm vi quản lý.

254:         if not locked_time_lock.is_locked:
255:             raise TimeLockError("JOB_PERIOD_ALREADY_UNLOCKED")

259:         locked_time_lock.is_locked = False
260:         locked_time_lock.unlocked_by = user
261:         locked_time_lock.unlocked_at = timezone.now()
262:         locked_time_lock.unlock_reason = clean_reason
263:         locked_time_lock.save(...)
# Cập nhật trạng thái un-locked.

273:         log_action(...)
# Ghi Audit Log UNLOCK_TIMESHEET.

283:         notify(...)
# Bắn thông báo TIMESHEET_UNLOCK.

292:     return locked_time_lock
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Function / Service Name | Boundary & Authorization | Key Outputs & Side Effects |
|-------------------------|--------------------------|----------------------------|
| `assert_period_open_for_job()` | Kiểm tra cờ Lock | Ném `TimeLockError` nếu kỳ công đã bị lock ở cấp GLOBAL hoặc JOB |
| `lock_job_period()` | Manager Scope | Khóa kỳ công JOB, ghi Audit Log, gửi thông báo hệ thống đến team |
| `unlock_job_period()` | Manager Scope + Reason Required | Mở khóa kỳ công JOB, yêu cầu bắt buộc `unlock_reason`, ghi Audit Log |
