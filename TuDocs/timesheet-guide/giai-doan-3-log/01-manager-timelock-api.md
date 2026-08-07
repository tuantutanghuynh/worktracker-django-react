# 01 — `ManagerTimeLockView`: API chốt sổ kỳ báo cáo

## Vì sao chỉ làm chiều khóa, chưa làm Unlock

`08-roadmap-and-talking-points.md` liệt "API Unlock (mở khóa lại kỳ báo
cáo)?" vào mục "Cần chốt với team trước khi code" — chưa có câu trả lời
thống nhất. Làm chiều khóa trước (rõ ràng, không tranh cãi), Unlock để dành
khi có quyết định cụ thể — tránh code 1 tính năng rồi phải sửa lại nếu
nghiệp vụ quyết định khác (ví dụ: Unlock có cần ghi log ai mở khóa, có giới
hạn chỉ Admin mới được mở hay Manager cũng được...).

## Code cuối cùng — `backend/timesheets/serializers_manager.py`

```python
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from .models import TimeLock


class ManagerTimeLockSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeLock
        fields = ["id", "lock_month", "lock_year", "is_locked", "locked_by", "locked_at"]
        read_only_fields = ["id", "is_locked", "locked_by", "locked_at"]
        validators = [
            UniqueTogetherValidator(
                queryset=TimeLock.objects.all(),
                fields=["lock_month", "lock_year"],
                message="This period is already locked.",
            )
        ]

    def validate_lock_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError("lock_month must be between 1 and 12.")
        return value

    def create(self, validated_data):
        validated_data["locked_by"] = self.context["request"].user
        return super().create(validated_data)
```

## Bug thật đã gặp: message sai vì `ModelSerializer` tự sinh validator ẩn

Bản đầu tiên tự viết `validate()` để check trùng lặp bằng tay:

```python
def validate(self, attrs):
    already_locked = TimeLock.objects.filter(
        lock_month=attrs["lock_month"], lock_year=attrs["lock_year"]
    ).exists()
    if already_locked:
        raise serializers.ValidationError(
            f"Period {attrs['lock_month']}/{attrs['lock_year']} is already locked."
        )
    return attrs
```

Test thật (khóa lại 1 kỳ đã khóa) trả về đúng status `400`, nhưng **sai
message**:

```text
{"non_field_errors":["The fields lock_month, lock_year must make a unique set."]}
```

Không phải message tự viết ở trên. Message này bị chặn sớm hơn `validate()`
tự viết.

### Nguyên nhân

`TimeLock.Meta` (trong `models.py`) có:

```python
constraints = [
    models.UniqueConstraint(fields=['lock_month', 'lock_year'], name='unique_lock_month_year')
]
```

`ModelSerializer` (khác `Serializer` thuần) **tự động quét** `Meta.constraints`
của model lúc khởi tạo class, và tự sinh thêm 1 `UniqueTogetherValidator`
ẩn cho constraint này. DRF chạy toàn bộ validator (kể cả validator tự sinh)
**trước** khi gọi tới `validate()` do người viết tự định nghĩa — nên
`validate()` tự viết không bao giờ chạy tới trong trường hợp trùng lặp, bị
validator ẩn chặn từ trước.

### Vì sao đây là hành vi hữu ích, không phải bug của DRF

`ModelSerializer` được thiết kế để **tự suy ra càng nhiều validation càng
tốt** từ chính định nghĩa model — giảm code trùng lặp. Vấn đề không phải
DRF sai, mà là code tự viết đang **lặp lại** đúng validation DRF đã tự làm,
chỉ khác ở message hiển thị.

### Cách sửa — không viết lại logic đã có, chỉ tùy chỉnh message

Khai báo tường minh `UniqueTogetherValidator` trong `Meta.validators` với
`message` riêng — DRF sẽ **dùng validator tường minh này thay vì tự sinh
1 cái ẩn khác** (khai báo tường minh luôn ghi đè hành vi tự động). Xóa hẳn
`validate()` tự viết — không cần nữa, đã dư thừa.

Test lại sau khi sửa:

```text
{"non_field_errors":["This period is already locked."]}
```

✅ Đúng message thiết kế.

## Code cuối cùng — `backend/timesheets/views_manager.py` (phần thêm)

```python
# --- Tuấn Tú's section: TimeLock (owns time_locks table) ---
# Locks a reporting period (lock_month/lock_year). Called from Đức Long's
# Timesheet Review page — unlock is out of scope for now (not yet agreed
# with the team, see timesheet-guide/08).
class ManagerTimeLockView(APIView):
    permission_classes = [HasPermission]
    required_permission = "timesheet:lock"

    def post(self, request):
        serializer = ManagerTimeLockSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        time_lock = serializer.save()

        return Response(ManagerTimeLockSerializer(time_lock).data, status=status.HTTP_201_CREATED)
```

Comment `# --- Tuấn Tú's section ---` thêm có chủ đích: `views_manager.py`
là file dùng chung với Đức Long (anh ấy sẽ thêm `ReviewLogWorkView` vào
cùng file sau này) — đánh dấu ranh giới rõ ràng giúp merge Chủ Nhật ít rủi
ro hơn, dù về mặt kỹ thuật Python không bắt buộc phải comment như vậy.

## Code cuối cùng — `backend/timesheets/urls_manager.py`

```python
from django.urls import path

from .views_manager import ManagerTimeLockView

# Manager-facing timesheet routes.
# Duc Long adds review endpoints here.
urlpatterns = [
    path("time-locks/", ManagerTimeLockView.as_view(), name="manager_time_lock_create"),
]
```
