# 02 — `EmployeeLogWorkSerializer`: Validate & tạo `log_work`

## Vì sao dùng `ModelSerializer`, không dùng `Serializer` thuần như `LoginSerializer`

`LoginSerializer` (ở `accounts/serializers_auth.py`) dùng `serializers.Serializer`
thuần vì nó **không tạo/sửa record nào** — chỉ validate rồi sinh token.
`EmployeeLogWorkSerializer` thì khác: mục đích chính là **tạo 1 record
`LogWork` mới**, ánh xạ gần như 1-1 với các field của model — đúng tình
huống nên dùng `ModelSerializer` để không phải tự khai báo lại từng field
(`task = serializers.PrimaryKeyRelatedField(...)`, `work_date = serializers.DateField()`...)
một cách thủ công.

## Vì sao check Data Isolation ngay trong `validate_task`, không để tới View

Field-level validation (`validate_<field_name>`) là quy ước của DRF: đặt
tên đúng thì tự động được gọi khi `is_valid()` chạy, không cần đăng ký gì
thêm. Đặt check `task.assignee_id == request.user.id` ở đây, không phải ở
View, vì đây là **quy tắc hợp lệ của chính field `task`** trong ngữ cảnh
request hiện tại — không phải luồng HTTP chung chung. Nếu để ở View, logic
nghiệp vụ sẽ rải rác 2 nơi, khó test độc lập serializer mà không cần dựng
cả request thật.

## Code cuối cùng — `backend/timesheets/serializers_employee.py`

```python
from rest_framework import serializers

from .models import LogWork


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
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
```

## Vì sao dùng `task.assignee_id`, không dùng `task.assignee`

`task.assignee_id` đọc thẳng giá trị FK đã có sẵn trên object `task` (không
cần thêm 1 query để load object `CustomUser` đầy đủ). `task.assignee` sẽ
kích hoạt Django tự động chạy thêm 1 câu `SELECT` để lấy toàn bộ record User
liên quan, dù ở đây chỉ cần so sánh `id`. Thói quen "chỉ load field thật sự
cần" — giống lý do dùng `SELECT id FROM ...` thay vì `SELECT *` khi chỉ cần
so sánh khóa.

## Vì sao override `create()` để tự gắn `user`, không cho client tự truyền lên

`fields` trong `Meta` **không khai báo `user`** — nghĩa là client gửi
`user` trong request body cũng bị `ModelSerializer` bỏ qua, không lỗi,
không tác dụng. Việc gắn `user = request.user` được làm tường minh trong
`create()`, lấy thẳng từ token đã xác thực (`request.user`), không tin bất
kỳ giá trị nào client tự gửi lên — chống trường hợp 1 Employee cố tình gửi
`user_id` của người khác để log work giả mạo hộ họ.

## Bug thật đã gặp lúc gõ code: quên `context={"request": request}`

Nếu khởi tạo serializer ở View mà quên truyền `context`, dòng
`self.context["request"]` trong `validate_task` sẽ ném `KeyError` ngay khi
`is_valid()` chạy tới field `task`. Đây là lỗi hay gặp nhất khi mới học DRF
— serializer không tự có quyền truy cập `request` như trong Java Controller
(nơi `request` luôn là tham số truyền thẳng vào method), mà phải được đưa
vào bằng tay qua `context`.

### Cách phòng: luôn khởi tạo serializer đúng cú pháp ở View

```python
serializer = EmployeeLogWorkSerializer(data=request.data, context={"request": request})
```

Chi tiết ở file `03`.
