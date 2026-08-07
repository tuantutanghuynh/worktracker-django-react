# Executive Code Annotation: `backend/timesheets/services/logwork_review_manager_service.py`

**Package / Module:** `backend.timesheets.services.logwork_review_manager_service` · Manager LogWork Review Domain Service

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Chuyển Trạng Thái & Xử Lý Review LogWork (Manager Review Workflow)

```
                              ┌──────────────────────────────────┐
                              │  Manager LogWork Review Request  │
                              └────────────────┬─────────────────┘
                                               │
                                               ▼
                              get_locked_scoped_logwork()
                              (scoped_logworks + select_for_update)
                                               │
                                               ▼
                              assert_logwork_in_manager_scope()
                              assert_period_open_for_job()
                                               │
       ┌───────────────────────┬───────────────┴───────────────┬───────────────────────┐
       ▼                       ▼                               ▼                       ▼
[approve_logwork]       [reject_logwork]              [correct_logwork]          [void_logwork]
  - Check != VOIDED       - Check != VOIDED             - Reason required          - Reason required
  - Check != APPROVED     - Check != REJECTED           - Check != VOIDED          - Check != VOIDED
  - status = APPROVED     - Reason required             - Check 24h cap            - status = VOIDED
                          - status = REJECTED           - Update hours/desc        - set reviewed & adjusted
       │                       │                               │                       │
       └───────────────────────┴───────────────┬───────────────┴───────────────────────┘
                                               │
                                               ▼
                                 rebuild_daily_user_timesheet()
                                               │
                                               ▼
                                   log_action() Audit Trail
```

> **Vì sao mọi hành động (Approve, Reject, Correct, Void) đều phải gọi `rebuild_daily_user_timesheet()`?**
> Bảng `DailyUserTimesheet` duy trì tổng số giờ làm tính lương thực tế trong ngày. Khi một logwork chuyển trạng thái sang `VOIDED` hoặc được điều chỉnh số giờ (`correct_logwork`), tổng số giờ trong ngày thay đổi. Việc tự động gọi `rebuild_daily_user_timesheet()` đảm bảo dữ liệu tổng hợp luôn nhất quán 100% với dữ liệu chi tiết.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from django.db import transaction
2: from django.utils import timezone
3: from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
# Nạp thư viện quản lý transaction, thời gian và ngoại lệ.

5: from timesheets.models import LogWork
6: from system.scoping_manager import scoped_logworks
7: from system.services.audit_manager_service import snapshot, log_action
# Nạp model LogWork, hàm phân quyền dữ liệu scoped_logworks và audit service.

9: from timesheets.services.daily_total_manager_service import (
10:     assert_daily_total_not_exceed_24,
11:     rebuild_daily_user_timesheet,
12: )
13: from timesheets.services.timelock_manager_service import (
14:     assert_period_open_for_job,
15: )
# Nạp các service kiểm tra tổng 24h, đồng bộ ngày và kiểm tra khóa kỳ công.

18: class LogWorkReviewError(APIException):
19:     status_code = 400
20:     default_detail = "LogWork review rule violation."
21:     default_code = "logwork_review_error"
# Ngoại lệ custom cho các lỗi nghiệp vụ duyệt log work.

24: def assert_logwork_in_manager_scope(user, logwork):
25:     if logwork.task.job.manager_id != user.id:
26:         raise PermissionDenied("LOGWORK_OUT_OF_MANAGER_SCOPE")
# Đảm bảo Manager chỉ được duyệt logwork thuộc Job mà mình quản lý.

32: def get_locked_scoped_logwork(user, logwork_id):
33:     return (
34:         scoped_logworks(user)
35:         .select_for_update()
36:         .select_related(...)
37:         .get(pk=logwork_id)
38:     )
# Lấy bản ghi logwork theo phạm vi quyền Manager và thực hiện khóa dòng select_for_update().

47: def approve_logwork(*, user, logwork, note=None, request=None):
# Service phê duyệt LogWork.

59:     with transaction.atomic():
60:         locked_logwork = get_locked_scoped_logwork(user=user, logwork_id=logwork.id)
65:         assert_logwork_in_manager_scope(user, locked_logwork)
67:         assert_period_open_for_job(job_id=locked_logwork.task.job_id, work_date=locked_logwork.work_date)
# Khóa dòng, kiểm tra phạm vi Manager và kiểm tra kỳ công chưa bị khóa.

72:         if locked_logwork.review_status == LogWork.ReviewStatus.VOIDED:
73:             raise LogWorkReviewError("VOIDED_LOGWORK_CANNOT_BE_APPROVED")
75:         if locked_logwork.review_status == LogWork.ReviewStatus.APPROVED:
76:             raise LogWorkReviewError("LOGWORK_ALREADY_APPROVED")
# Không cho duyệt bản ghi đã VOIDED hoặc đã APPROVED trước đó.

88:         locked_logwork.review_status = LogWork.ReviewStatus.APPROVED
89:         locked_logwork.reviewed_by = user
90:         locked_logwork.reviewed_at = timezone.now()
91:         locked_logwork.review_note = note
92:         locked_logwork.save(...)
# Cập nhật trạng thái APPROVED và thông tin người duyệt.

102:        rebuild_daily_user_timesheet(user_id=locked_logwork.user_id, work_date=locked_logwork.work_date)
107:        log_action(user=user, action="APPROVE_LOG_WORK", ...)
# Đồng bộ bảng tổng ngày và ghi Audit Log.

128: def reject_logwork(*, user, logwork, reason, request=None):
# Service từ chối LogWork.

140:     if not reason or not str(reason).strip():
141:         raise ValidationError({"reason": "Reject reason is required."})
# Bắt buộc nhập lý do từ chối.

178:     locked_logwork.review_status = LogWork.ReviewStatus.REJECTED
179:     locked_logwork.reviewed_by = user
180:     locked_logwork.reviewed_at = timezone.now()
181:     locked_logwork.review_note = clean_reason
182:     locked_logwork.save(...)
# Cập nhật trạng thái REJECTED.

218: def correct_logwork(*, user, logwork, hours_spent=None, description=None, adjustment_reason=None, request=None):
# Service điều chỉnh số giờ/mô tả LogWork dành cho Manager.

236:     if not adjustment_reason or not str(adjustment_reason).strip():
237:         raise ValidationError({"adjustment_reason": "Adjustment reason is required."})
# Bắt buộc nhập lý do điều chỉnh.

272:     if hours_spent is not None:
273:         assert_daily_total_not_exceed_24(
274:             user_id=locked_logwork.user_id,
275:             work_date=locked_logwork.work_date,
276:             new_hours=hours_spent,
277:             exclude_logwork_id=locked_logwork.id,
278:         )
280:         locked_logwork.hours_spent = hours_spent
# Nếu thay đổi số giờ, kiểm tra chốt chặn 24h/ngày trước khi gán giá trị mới.

285:     locked_logwork.adjusted_by = user
286:     locked_logwork.adjusted_at = timezone.now()
287:     locked_logwork.adjustment_reason = clean_reason
288:     locked_logwork.save(...)
# Lưu vết điều chỉnh.

326: def void_logwork(*, user, logwork, reason, request=None):
# Service Manager Void bản ghi LogWork sai sót.

376:     locked_logwork.review_status = LogWork.ReviewStatus.VOIDED
377:     locked_logwork.reviewed_by = user
378:     locked_logwork.reviewed_at = timezone.now()
379:     locked_logwork.review_note = clean_reason
380:     locked_logwork.adjusted_by = user
381:     locked_logwork.adjusted_at = timezone.now()
382:     locked_logwork.adjustment_reason = clean_reason
383:     locked_logwork.save(...)
# Đánh dấu trạng thái VOIDED đồng thời ở cả bộ field Reviewed và Adjusted.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Operation | Mandatory Inputs | Status Transition | System Side Effects |
|-----------|------------------|-------------------|---------------------|
| `approve_logwork` | Optional `note` | PENDING/REJECTED ──► APPROVED | Rebuild daily total, Log Audit |
| `reject_logwork` | Required `reason` | PENDING/APPROVED ──► REJECTED | Rebuild daily total, Log Audit |
| `correct_logwork` | Required `adjustment_reason` | Retains current status | Validate 24h cap, Rebuild daily total, Log Audit |
| `void_logwork` | Required `reason` | Any valid status ──► VOIDED | Deduct hours from daily total, Log Audit |
