# 02 — FR-58: Void log work thay vì Delete

## Nghiệp vụ

Employee không còn được xoá `log_work`. Thay vào đó: `PATCH
/api/timesheets/log-works/<id>/void/` set `review_status = VOIDED`, giữ
lại record để audit. Chỉ được void khi đang `PENDING` — log work đã
`APPROVED` thì không, phải liên hệ Manager (dùng luồng void riêng của
Manager, `logwork_review_manager_service.py`, không phải endpoint này).

## Tái dùng hạ tầng của Đức Long thay vì viết lại

Trước khi viết, đọc `timesheets/services/logwork_review_manager_service.py`
(Manager void) để không viết trùng logic. Tìm thấy 2 helper dùng lại được
nguyên vẹn:

- `rebuild_daily_user_timesheet(user_id, work_date)` — tính lại
  `DailyUserTimesheet.total_hours`, tự loại bản ghi `VOIDED` (quy ước đã
  ghi rõ trong comment model: *"VOIDED không được tính vào tổng giờ"*).
  Không tự cộng/trừ tay — gọi hàm này sau khi đổi `review_status` là đủ,
  tránh sai số nếu logic tính tổng thay đổi sau này ở 1 chỗ khác.
- `log_action()` + `snapshot()` (`system/services/audit_manager_service.py`)
  — xem chi tiết ở file 03.

## Permission mới — migration `0006_logwork_void_permission.py`

Theo đúng pattern đã có ở `accounts/migrations/0003_add_employee_view_permission.py`
(RunPython add/remove, seed 1 permission cho 1 role):

```python
def add_permission(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    employee_role = Role.objects.get(code="EMPLOYEE")
    perm = Permission.objects.create(code="logwork:void", name="logwork:void")
    RolePermission.objects.create(role=employee_role, permission=perm)
```

## View — `backend/timesheets/views_employee.py`

```python
class EmployeeVoidLogWorkView(APIView):
    permission_classes = [HasPermission]
    required_permission = "logwork:void"

    def patch(self, request, log_work_id):
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError({"reason": "This field is required."})

        with transaction.atomic():
            log_work = get_object_or_404(
                LogWork.objects.select_for_update(),
                id=log_work_id,
                user_id=request.user.id,
            )

            if log_work.review_status != LogWork.ReviewStatus.PENDING:
                raise ValidationError("Only a PENDING log work can be voided.")

            log_work.review_status = LogWork.ReviewStatus.VOIDED
            log_work.adjusted_by = request.user
            log_work.adjusted_at = timezone.now()
            log_work.adjustment_reason = reason
            log_work.save(update_fields=[
                "review_status", "adjusted_by", "adjusted_at",
                "adjustment_reason", "updated_at",
            ])

            rebuild_daily_user_timesheet(user_id=log_work.user_id, work_date=log_work.work_date)
            # ... log_action(), xem file 03

        return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_200_OK)
```

### 3 quyết định thiết kế đáng nhớ

1. **Data Isolation qua `get_object_or_404(..., user_id=request.user.id)`**
   thay vì lấy log work rồi check `if log_work.user_id != request.user.id`
   — cách này trả 404 cho log work của người khác thay vì 403, không lộ
   thông tin "record này có tồn tại nhưng không phải của bạn".
2. **`select_for_update()` dù chỉ 1 user tự void của chính mình** — vẫn giữ
   pessimistic locking để nhất quán với toàn bộ codebase (Manager cũng có
   thể đang review cùng lúc), dù race condition ở đây khó xảy ra hơn.
3. **`reason` bắt buộc** — theo đúng comment trong model
   (`adjustment_reason`): *"Required ở tầng service khi adjust/void để đảm
   bảo audit traceability"* — áp dụng quy tắc này cho cả Employee, không chỉ
   Manager.

## Bug gặp khi tự gõ code (đáng nhớ, không phải của Claude)

Khi tự gõ `views_employee.py`, ghi đè nhầm mất class `EmployeeLogWorkView`
cũ đã có sẵn (không phải thêm nối tiếp, mà thay toàn bộ nội dung file) —
gây `ImportError: cannot import name 'EmployeeLogWorkView'` khi
`urls_employee.py` cố import cả 2 class. Bài học: khi được yêu cầu "thêm
class mới vào file", luôn thêm nối vào cuối, không paste đè cả file trừ khi
chắc chắn đã có đủ nội dung cũ trong đoạn paste.

## Verify

```text
✅ manage.py check — sạch
✅ makemigrations --check — sạch (migration 0006 không đổi model, chỉ seed data)
✅ manage.py migrate accounts — áp dụng 0006 thành công
✅ Query xác nhận: Permission "logwork:void" -> role EMPLOYEE
✅ curl PATCH /api/timesheets/log-works/1/void/ (không auth) → 401 (route resolve đúng, không phải 404/500)
```

Chưa test full flow có auth thật (tạo → void → xác nhận `DailyUserTimesheet`
giảm đúng giờ) — nợ lại cùng lúc với FR-57 khi có dữ liệu test đầy đủ.
