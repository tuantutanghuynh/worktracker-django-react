# 02 — Gắn Time Lock check vào `EmployeeLogWorkSerializer`

## Vì sao check đứng ĐẦU `create()`, trước cả 24h-cap (Giai đoạn 2)

Đúng thứ tự đã thiết kế ở `timesheet-guide/03-log-work-flow.md`: nếu kỳ báo
cáo đã khóa, không cần chạy tới `get_or_create()`/`select_for_update()` của
Lớp phòng thủ 2 — dừng sớm, tránh làm việc thừa (mở khóa 1 dòng
`daily_user_timesheets` rồi lại phải bỏ đi ngay sau đó không có ý nghĩa gì).

## Vì sao dùng `.filter(...).first()`, không dùng `.get()`

Nếu kỳ báo cáo **chưa từng bị khóa**, sẽ không có dòng `TimeLock` nào cho
`(lock_month, lock_year)` đó — `.get()` ném `DoesNotExist` nếu không thấy,
dễ crash nếu quên bắt exception. `.filter().first()` trả `None` an toàn,
xử lý bằng `if lock and lock.is_locked` — "không tìm thấy dòng" = "chưa
từng khóa" = cho phép log work bình thường.

## Vì sao `PermissionDenied` (403), không phải `serializers.ValidationError` (400)

Cùng nguyên tắc phân loại lỗi đã áp dụng xuyên suốt dự án (`auth-guide` file
03, `LoginSerializer`): mã lỗi phải phản ánh đúng **loại** vấn đề, không
chỉ đúng/sai chung chung.

- **403** (`PermissionDenied`): dữ liệu nhập hoàn toàn hợp lệ về số liệu —
  bị cấm vì lý do **hành chính** (kỳ đã chốt sổ). Nhân viên không tự sửa
  form để qua được, phải liên hệ Manager.
- **400** (`serializers.ValidationError`): lỗi do chính dữ liệu nhập sai
  (vượt 24h) — nhân viên tự sửa số giờ rồi submit lại được.

DRF's `serializers.ValidationError` luôn tự map ra 400, không có cách nào
"ép" nó trả 403 — muốn 403 bắt buộc phải `raise` đúng
`rest_framework.exceptions.PermissionDenied` (cùng class đã dùng ở
`accounts/permissions.py` cho gate `must_change_password`).

## Code cuối cùng — `backend/timesheets/serializers_employee.py`

```python
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .models import LogWork, DailyUserTimesheet, TimeLock


class EmployeeLogWorkSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogWork
        fields = ["id", "task", "work_date", "hours_spent", "description"]
        read_only_fields = ["id"]

    def validate_hours_spent(self, value):
        if value <= 0:
            raise serializers.ValidationError("hours_spent must be greater than 0.")
        return value

    def validate_task(self, task):
        request = self.context["request"]
        if task.assignee_id != request.user.id:
            raise serializers.ValidationError("You can only log work on tasks assigned to you.")
        return task

    def create(self, validated_data):
        user = self.context["request"].user
        work_date = validated_data["work_date"]
        hours_spent = validated_data["hours_spent"]

        with transaction.atomic():
            # Defensive layer 1 — Time Lock check
            lock = TimeLock.objects.filter(
                lock_month=work_date.month, lock_year=work_date.year
            ).first()
            if lock and lock.is_locked:
                raise PermissionDenied(
                    f"Period {work_date.month}/{work_date.year} is locked. "
                    "Contact your manager to unlock it."
                )

            # Defensive layer 2 — 24h Cap + Race Condition
            DailyUserTimesheet.objects.get_or_create(
                user=user, work_date=work_date, defaults={"total_hours": Decimal("0")}
            )
            timesheet = DailyUserTimesheet.objects.select_for_update().get(
                user=user, work_date=work_date
            )

            new_total = timesheet.total_hours + hours_spent
            if new_total > 24:
                raise serializers.ValidationError(
                    {"hours_spent": f"Total hours for {work_date} would exceed 24h "
                                    f"(currently {timesheet.total_hours}h, tried to add {hours_spent}h)."}
                )

            timesheet.total_hours = new_total
            timesheet.save()

            validated_data["user"] = user
            return super().create(validated_data)
```

So với Giai đoạn 2, chỉ thêm: import `PermissionDenied` + `TimeLock`, và
khối "Defensive layer 1" (7 dòng) ngay đầu `with transaction.atomic():`.
Toàn bộ phần Giai đoạn 2 giữ nguyên không đổi.
