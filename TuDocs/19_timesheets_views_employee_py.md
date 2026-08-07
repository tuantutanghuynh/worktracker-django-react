# Executive Code Annotation: `backend/timesheets/views_employee.py`

**Package / Module:** `backend.timesheets.views_employee` · Employee API Views Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Xử Lý Request Employee (API Routing & Controller Diagram)

```
                       ┌─────────────────────────────────────────┐
                       │          Employee API Request           │
                       └────────────────────┬────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
      POST /api/employee/log-works/                PATCH /api/employee/log-works/{id}/void/
      (EmployeeLogWorkView)                        (EmployeeVoidLogWorkView)
             │                                               │
             ▼                                               ▼
    [HasPermission]                                 [HasPermission]
    required: "timesheet:create"                    required: "logwork:void"
             │                                               │
             ▼                                               ▼
    EmployeeLogWorkSerializer                     Validate reason non-empty
    .is_valid() & .save()                                    │
             │                                               ▼
             ▼                                    select_for_update() LogWork
    [201 Created Response]                        (user_id=request.user.id)
                                                             │
                                                             ▼
                                                  Check status == PENDING ?
                                                  (No ──► 400 ValidationError)
                                                             │ (Yes)
                                                             ▼
                                                  Set review_status = VOIDED
                                                             │
                                                             ▼
                                                  rebuild_daily_user_timesheet()
                                                             │
                                                             ▼
                                                  log_action() Audit Trail
                                                             │
                                                             ▼
                                                  [200 OK Response]
```

> **Vì sao Nhân viên chỉ có quyền Hủy (Void) log work khi trạng thái đang là `PENDING`?**
> Một khi LogWork đã được Manager kiểm tra và Duyệt (`APPROVED`) hoặc Từ chối (`REJECTED`), nó đã đi vào quy trình kế toán/báo cáo. Nhân viên không được phép tự ý thay đổi hay hủy bỏ nữa mà phải thông qua Manager xử lý quy trình chỉnh sửa (`correct`) hoặc hủy (`void`) từ phía Manager.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from django.db import transaction
# Nạp quản lý transaction atomic.

2: from django.shortcuts import get_object_or_404
# Nạp helper get_object_or_404 của Django.

3: from django.utils import timezone
# Nạp công cụ xử lý múi giờ chuẩn timezone.

4: from rest_framework.exceptions import ValidationError
# Nạp ngoại lệ ValidationError (HTTP 400).

5: from rest_framework.views import APIView
6: from rest_framework.response import Response
7: from rest_framework import status
# Nạp các lớp APIView, Response và status mã HTTP của DRF.

9: from accounts.permissions import HasPermission
# Nạp Custom Permission Check theo mã quyền RBAC.

10: from .serializers_employee import EmployeeLogWorkSerializer
# Nạp Serializer tạo logwork dành cho Employee.

11: from system.services.audit_manager_service import snapshot, log_action
# Nạp các hàm kiểm toán snapshot và log_action.

12: from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet
# Nạp service tính lại tổng giờ làm việc trong ngày.

13: from .models import LogWork
# Nạp model LogWork.

19: class EmployeeLogWorkView(APIView):
# API View cho phép Nhân viên tạo mới LogWork.

20:     permission_classes = [HasPermission]
21:     required_permission = "timesheet:create"
# Yêu cầu quyền RBAC "timesheet:create".

23:     def post(self, request):
# Endpoint POST tiếp nhận dữ liệu log work.

24:         serializer = EmployeeLogWorkSerializer(data=request.data, context={"request": request})
25:         serializer.is_valid(raise_exception=True)
26:         log_work = serializer.save()
# Thực thi validation và lưu dữ liệu.

28:         return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_201_CREATED)
# Trả về kết quả HTTP 201 Created.

34: class EmployeeVoidLogWorkView(APIView):
# API View cho phép Nhân viên chủ động Void bản ghi LogWork chưa duyệt của chính mình.

35:     permission_classes = [HasPermission]
36:     required_permission = "logwork:void"
# Yêu cầu quyền RBAC "logwork:void".

38:     def patch(self, request, log_work_id):
# Endpoint PATCH nhận log_work_id cần hủy.

39:         reason = request.data.get("reason", "").strip()
40:         if not reason:
41:             raise ValidationError({"reason": "This field is required."})
# Đảm bảo lý do hủy (reason) phải có dữ liệu.

43:         with transaction.atomic():
# Mở Atomic Transaction.

44:             log_work = get_object_or_404(
45:                 LogWork.objects.select_for_update(),
46:                 id=log_work_id,
47:                 user_id=request.user.id,
48:             )
# Tìm LogWork chính chủ (`user_id=request.user.id`) và thực hiện khóa dòng `select_for_update()`. Ném 404 nếu không tìm thấy.

50:             if log_work.review_status != LogWork.ReviewStatus.PENDING:
51:                 raise ValidationError("Only a PENDING log work can be voided.")
# Kiểm tra nếu trạng thái khác PENDING thì chặn ngay lập tức.

53:             old_values = snapshot(
54:                 log_work,
55:                 fields=["review_status", "adjusted_by", "adjusted_at", "adjustment_reason"],
56:             )
# Chụp ảnh dữ liệu cũ phục vụ Audit Log.

58:             log_work.review_status = LogWork.ReviewStatus.VOIDED
59:             log_work.adjusted_by = request.user
60:             log_work.adjusted_at = timezone.now()
61:             log_work.adjustment_reason = reason
62:             log_work.save(update_fields=[
63:                 "review_status", "adjusted_by", "adjusted_at",
64:                 "adjustment_reason", "updated_at",
65:             ])
# Cập nhật trạng thái thành VOIDED và lưu thông tin người điều chỉnh.

67:             rebuild_daily_user_timesheet(user_id=log_work.user_id, work_date=log_work.work_date)
# Gọi service tính toán lại tổng giờ làm trong ngày (loại bỏ bản ghi VOIDED).

69:             log_action(
70:                 user=request.user,
71:                 action="VOID_LOG_WORK",
72:                 table_name="log_works",
73:                 record_id=log_work.id,
74:                 old_values=old_values,
75:                 new_values=snapshot(
76:                     log_work,
77:                     fields=["review_status", "adjusted_by", "adjusted_at", "adjustment_reason"],
78:                 ),
79:                 request=request,
80:             )
# Ghi Audit Log hành động VOID_LOG_WORK.

82:         return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_200_OK)
# Trả về Response 200 OK.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| View Name | HTTP Method | Required Permission | Core Action & Business Rules |
|-----------|-------------|---------------------|------------------------------|
| `EmployeeLogWorkView` | `POST` | `timesheet:create` | Ghi nhận giờ làm việc mới, kích hoạt 2 lớp bảo vệ TimeLock & 24h Cap |
| `EmployeeVoidLogWorkView` | `PATCH` | `logwork:void` | Hủy bản ghi chính chủ khi còn ở trạng thái `PENDING`, đồng bộ lại `DailyUserTimesheet` |
