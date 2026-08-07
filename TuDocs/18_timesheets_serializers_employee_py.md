# Executive Code Annotation: `backend/timesheets/serializers_employee.py`

**Package / Module:** `backend.timesheets.serializers_employee` · Employee Serializers Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Luồng Xác Thực Đa Lớp (Employee LogWork Validation Pipeline)

```
[Employee API Request] ──► hours_spent > 0 ? ──(No)──► [400 ValidationError]
                                │ (Yes)
                                ▼
                       Task assigned to caller? ──(No)──► [400 ValidationError]
                                │ (Yes)
                                ▼
                       transaction.atomic() Starts
                                │
                        ┌───────┴─────────────────────────┐
                        │ Defensive Layer 1: TimeLock     │
                        │ Checks GLOBAL & JOB locks       │
                        └───────┬─────────────────────────┘
                                │ (If locked) ──► [403 PermissionDenied]
                                ▼
                        ┌─────────────────────────────────┐
                        │ Defensive Layer 2: 24h Cap      │
                        │ select_for_update() on Daily    │
                        │ total_hours + new > 24 ?        │
                        └───────┬─────────────────────────┘
                                │ (If > 24) ──► [400 ValidationError]
                                ▼
                        Save LogWork record
                                │
                        Log Action to Audit Trail
                                │
                        Commit Transaction
                                │
                                ▼
                        [201 Created Response]
```

> **Vì sao kiểm tra TimeLock lại ném ngoại lệ `PermissionDenied` (403) còn vượt quá 24h lại ném `ValidationError` (400)?**
> - **403 PermissionDenied (TimeLock):** Đây là rào cản hành chính do Quản trị viên/Manager thiết lập. Nhân viên không thể sửa dữ liệu đầu vào để vượt qua rào cản này mà phải liên hệ cấp trên mở khóa.
> - **400 ValidationError (24h Cap):** Đây là lỗi sai sót dữ liệu đầu vào. Nhân viên có thể điều chỉnh lại số giờ nhập hợp lý và gửi lại request ngay lập tức.
>
> **Vì sao cần dùng `select_for_update()` ở dòng 81 (Pessimistic Locking)?**
> Khi nhân viên mở nhiều tab trình duyệt hoặc gửi đồng thời 2 request log work trong cùng 1 giây, nếu không dùng khóa bi quan `select_for_update()`, cả 2 request đều đọc được `total_hours = 20h` và cùng cộng thêm `4h` (thành 24h), dẫn đến tình trạng ghi đè cạnh tranh (Race Condition) và tổng số giờ thực tế vọt lên `28h` vi phạm quy định.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from decimal import Decimal
# Nạp lớp Decimal để xử lý toán học số thực độ chính xác cao cho giờ làm việc.

3: from django.db import transaction
# Nạp quản lý giao dịch CSDL (Atomic Transaction).

4: from rest_framework import serializers
# Nạp thư viện serializers của DRF.

5: from rest_framework.exceptions import PermissionDenied
# Nạp ngoại lệ PermissionDenied (HTTP 403 Forbidden).

7: from system.services.audit_manager_service import log_action, snapshot
# Nạp hàm ghi nhật ký kiểm toán hệ thống log_action và hàm chụp ảnh trạng thái snapshot.

9: from .models import LogWork, DailyUserTimesheet, TimeLock
# Nạp các models nghiệp vụ liên quan đến Timesheet.

21: class EmployeeLogWorkSerializer(serializers.ModelSerializer):
# Class Serializer xử lý việc validate và tạo mới bản ghi LogWork cho Employee.

22:     class Meta:
23:         model = LogWork
24:         fields = ["id", "task", "work_date", "hours_spent", "description"]
25:         read_only_fields = ["id"]
# Cấu hình Meta chỉ định model LogWork và các trường dữ liệu giao tiếp với client.

28:     def validate_hours_spent(self, value):
# Kiểm tra định dạng trường hours_spent.

29:         if value <= 0:
30:             raise serializers.ValidationError("hours_spent must be greater than 0.")
31:         return value
# Chặn việc nhập số giờ âm hoặc bằng 0.

34:     def validate_task(self, task):
# Kiểm tra tính phân lập dữ liệu (Data Isolation) cho trường task.

35:         request = self.context["request"]
36:         if task.assignee_id != request.user.id:
37:             raise serializers.ValidationError("You can only log work on tasks assigned to you.")
38:         return task
# Đảm bảo nhân viên chỉ được phép log work cho những Task mà mình được phân công (assignee).

46:     def create(self, validated_data):
# Ghi đè phương thức create để cài đặt 2 lớp phòng thủ nghiệp vụ nghiêm ngặt.

47:         user = self.context["request"].user
48:         work_date = validated_data["work_date"]
49:         hours_spent = validated_data["hours_spent"]

51:         with transaction.atomic():
# Bắt đầu giao dịch Atomic: Tất cả thao tác kiểm tra, cập nhật DailyTimesheet và tạo LogWork phải thành công 100% hoặc Rollback toàn bộ.

53:             global_lock = TimeLock.objects.filter(
54:                 lock_month=work_date.month,
55:                 lock_year=work_date.year,
56:                 lock_scope=TimeLock.LockScope.GLOBAL,
57:                 job__isnull=True,
58:             ).first()
# Tìm kiếm cờ khóa GLOBAL cho tháng/năm của ngày làm việc.

59:             if global_lock and global_lock.is_locked:
60:                 raise PermissionDenied(
61:                     f"Period {work_date.month}/{work_date.year} is locked (GLOBAL lock). "
62:                     "Contact your admin to unlock it."
63:                 )
# Nếu toàn hệ thống bị Admin khóa, ném lỗi 403 PermissionDenied.

65:             job_lock = TimeLock.objects.filter(
66:                 lock_month=work_date.month,
67:                 lock_year=work_date.year,
68:                 lock_scope=TimeLock.LockScope.JOB,
69:                 job=validated_data["task"].job_id,
70:             ).first()
# Tìm kiếm cờ khóa JOB riêng cho dự án chứa Task này.

71:             if job_lock and job_lock.is_locked:
72:                 raise PermissionDenied(
73:                     f"Period {work_date.month}/{work_date.year} is locked for this job (JOB lock). "
74:                     "Contact your manager to unlock it."
75:                 )
# Nếu dự án bị Manager khóa, ném lỗi 403 PermissionDenied.

78:             DailyUserTimesheet.objects.get_or_create(
79:                 user=user, work_date=work_date, defaults={"total_hours": Decimal("0")}
80:             )
# Tạo hoặc lấy bản ghi tổng hợp ngày cho user.

81:             timesheet = DailyUserTimesheet.objects.select_for_update().get(
82:                 user=user, work_date=work_date
83:             )
# Thực hiện khóa dòng (Row-level Lock) với SELECT ... FOR UPDATE chống Race Condition.

85:             new_total = timesheet.total_hours + hours_spent
86:             if new_total > 24:
87:                 raise serializers.ValidationError(
88:                     {
89:                         "hours_spent": (
90:                             f"Total hours for {work_date} would exceed 24h "
91:                             f"(currently {timesheet.total_hours}h, tried to add {hours_spent}h)."
92:                         )
93:                     }
94:                 )
# Nếu tổng số giờ làm trong ngày cộng thêm số giờ mới vượt quá 24h, ném lỗi 400 ValidationError.

96:             timesheet.total_hours = new_total
97:             timesheet.save()
# Cập nhật số giờ làm tích lũy vào DailyUserTimesheet.

99:             validated_data["user"] = user
100:            validated_data["user"] = user
101:            log_work = super().create(validated_data)
# Lưu bản ghi LogWork vào CSDL.

103:            log_action(
104:                user=user,
105:                action="CREATE_LOG_WORK",
106:                table_name="log_works",
107:                record_id=log_work.id,
108:                new_values=snapshot(
109:                    log_work,
110:                    fields=["task", "work_date", "hours_spent", "description", "review_status"],
111:                ),
112:                request=self.context["request"],
113:            )
# Ghi nhận thao tác tạo log work vào hệ thống Audit Trail.

115:            return log_work
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Thành Phần Serializer | Phương Thức / Logic | Mục Đích Nghiệp Vụ & Phòng Thủ |
|-----------------------|---------------------|--------------------------------|
| `validate_hours_spent` | Field Validation | Chặn nhập số giờ <= 0 |
| `validate_task` | Data Isolation | Đảm bảo nhân viên chỉ log work cho Task phân công chính chủ |
| `create()` (Layer 1) | Time Lock Check | Kiểm tra cờ khóa GLOBAL & JOB trước khi nạp dữ liệu (Ném 403) |
| `create()` (Layer 2) | 24h Cap & Pessimistic Lock | Dùng `select_for_update()` ngăn ghi trùng và giới hạn 24h/ngày (Ném 400) |
| `create()` (Audit) | Audit Integration | Chụp ảnh dữ liệu và lưu vết thao tác tạo log work |
