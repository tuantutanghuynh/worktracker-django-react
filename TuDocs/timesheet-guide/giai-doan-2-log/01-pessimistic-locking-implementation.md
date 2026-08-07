# 01 — `create()`: Pessimistic Locking + Daily 24h Cap

## Code cuối cùng — `backend/timesheets/serializers_employee.py`

```python
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import LogWork, DailyUserTimesheet


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

## Vì sao `get_or_create()` trước, `select_for_update()` sau — không gộp làm 1

`get_or_create()` tự an toàn với race condition ở bước "tạo lần đầu": nếu 2
request cùng lúc thấy dòng `(user, work_date)` chưa tồn tại và cùng cố
`INSERT`, `UniqueConstraint(user, work_date)` đã khai báo ở model sẽ chặn 1
trong 2 bằng `IntegrityError` — Django's `get_or_create()` tự bắt lỗi này và
tự động `get()` lại, trả về đúng dòng vừa được request kia tạo. Sau bước
này, dòng **chắc chắn đã tồn tại** — lúc đó mới `select_for_update()` để
khóa nó phục vụ đoạn đọc-tính-ghi tiếp theo. Nếu gộp chung (ví dụ tự viết
tay `try: get() except DoesNotExist: create()`), sẽ phải tự xử lý lại đúng
race condition mà `get_or_create()` đã làm sẵn — không cần thiết.

## Bug thật đã gặp lúc gõ code: `Decimal("0")`, không phải `0` hay `0.0`

Lần đầu gõ `defaults={"total_hours": 0}` (số nguyên Python thường), chạy
`manage.py check` không báo lỗi gì — vì đây không phải lỗi cú pháp. Lỗi chỉ
lộ ra lúc chạy thật: `total_hours` của `DailyUserTimesheet` là `DecimalField`,
khi Django đọc dòng vừa tạo, giá trị trả về là kiểu `Decimal`, cộng với
`hours_spent` (cũng là `Decimal`, do `DecimalField` khác trên `LogWork`) thì
ổn — nhưng nếu ai đó test riêng phần khởi tạo default bằng cách so sánh trực
tiếp `0 == Decimal("0")`, Python coi 2 giá trị này *bằng nhau* nên dễ chủ
quan nghĩ dùng `0` cũng được. Vấn đề thật sự nằm ở phép **cộng ngầm giữa
`float` và `Decimal`** (không phải giữa `int` và `Decimal` — 2 cái đó cộng
được bình thường): nếu sau này có chỗ nào lỡ đọc `hours_spent` qua
`float(request.data["hours_spent"])` thay vì để DRF tự parse đúng kiểu, phép
cộng `Decimal + float` sẽ ném:

```text
TypeError: unsupported operand type(s) for +: 'decimal.Decimal' and 'float'
```

### Vì sao đây là lớp lỗi đặc thù của Python, không xảy ra ở Java

Java: `BigDecimal` (tương đương `Decimal` của Python) **không có toán tử
`+` quá tải** — bắt buộc gọi `.add()`, nên lập trình viên Java không bao giờ
vô tình cộng `BigDecimal` với `double` mà không nhận ra (compiler chặn ngay
từ lúc biên dịch, không có `.add(double)` khớp chữ ký). Python cho phép
dùng `+` trực tiếp và **tự làm rõ kiểu tương thích tại runtime** —
`Decimal + Decimal` hợp lệ, `Decimal + int` hợp lệ (Python tự hiểu `int` là
trường hợp đặc biệt của số chính xác), nhưng `Decimal + float` bị từ chối có
chủ đích, vì `float` có sai số làm tròn nhị phân (binary floating-point) —
trộn với `Decimal` (chính xác thập phân tuyệt đối, dùng cho tiền/giờ công)
sẽ âm thầm mất chính xác nếu Python tự động ép kiểu. Đây là lý do
`Decimal("0")` (khởi tạo từ string) được chọn thay vì `Decimal(0.0)` (khởi
tạo từ float) — dù cả 2 đều ra `Decimal`, khởi tạo từ float **đã** có thể
mang theo sai số nhị phân trước khi kịp vào `Decimal`.

### Cách phòng

Luôn khởi tạo `Decimal` từ `int` hoặc `str`, không bao giờ từ `float`:

```python
Decimal("0")      # đúng
Decimal(0)         # cũng đúng (int → Decimal chính xác tuyệt đối)
Decimal(0.0)       # SAI về nguyên tắc, dù chạy không lỗi ngay lúc này
```
