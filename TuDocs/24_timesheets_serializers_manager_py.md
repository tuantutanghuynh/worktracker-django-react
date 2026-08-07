# Executive Code Annotation: `backend/timesheets/serializers_manager.py`

**Package / Module:** `backend.timesheets.serializers_manager` · Manager Serializers Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây me như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Cấu Trúc Các Serializer Dành Cho Manager (Manager Serializer Class Hierarchy)

```
                            ┌────────────────────────────────────────┐
                            │      Base DRF Serializers Class        │
                            └───────────────────┬────────────────────┘
                                                │
          ┌─────────────────────────────────────┼─────────────────────────────────────┐
          ▼                                     ▼                                     ▼
[Mini Nested Serializers]              [LogWork Serializers]                [TimeLock Serializers]
  - ManagerUserMiniSerializer            - ManagerLogWorkListSerializer       - ManagerTimeLockListSerializer
  - ManagerJobMiniSerializer             - ManagerLogWorkDetailSerializer     - ManagerTimeLockDetailSerializer
  - ManagerTaskMiniSerializer            - ManagerLogWorkApproveSerializer    - ManagerTimeLockCreateSerializer
                                         - ManagerLogWorkRejectSerializer     - ManagerTimeLockUnlockSerializer
                                         - ManagerLogWorkCorrectSerializer    - TimeLockSerializer (Compat)
                                         - ManagerLogWorkVoidSerializer
```

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from decimal import Decimal
3: from rest_framework import serializers
5: from projects.models import Job
6: from tasks.models import Task
7: from timesheets.models import LogWork, TimeLock, DailyUserTimesheet

10: class ManagerUserMiniSerializer(serializers.Serializer):
# Serializer rút gọn hiển thị thông tin User (ID, Email, Full Name) trong các response nested.

15:     def get_full_name(self, obj):
16:         profile = getattr(obj, "profile", None)
17:         if profile and profile.full_name:
18:             return profile.full_name
19:         return obj.email
# Ưu tiên lấy full_name từ Profile, nếu không có fallback về Email.

24: class ManagerJobMiniSerializer(serializers.ModelSerializer):
# Serializer rút gọn cho Job.

35: class ManagerTaskMiniSerializer(serializers.ModelSerializer):
36:     job = ManagerJobMiniSerializer(read_only=True)
# Serializer rút gọn cho Task, lồng thông tin Job.

49: class ManagerLogWorkListSerializer(serializers.ModelSerializer):
50:     task = ManagerTaskMiniSerializer(read_only=True)
51:     user = ManagerUserMiniSerializer(read_only=True)
52:     reviewed_by = ManagerUserMiniSerializer(read_only=True)
# Serializer phục vụ hiển thị danh sách LogWork trong danh mục review của Manager.

72: class ManagerLogWorkDetailSerializer(ManagerLogWorkListSerializer):
73:     adjusted_by = ManagerUserMiniSerializer(read_only=True)
75:     class Meta(ManagerLogWorkListSerializer.Meta):
76:         fields = ManagerLogWorkListSerializer.Meta.fields + [
77:             "adjusted_by",
78:             "adjusted_at",
79:             "adjustment_reason",
80:         ]
# Serializer chi tiết LogWork kế thừa từ ListSerializer, bổ sung thêm các trường Audit điều chỉnh (adjusted_by, adjusted_at, adjustment_reason).

83: class ManagerLogWorkApproveSerializer(serializers.Serializer):
84:     note = serializers.CharField(required=False, allow_blank=True, allow_null=True, trim_whitespace=True)
# Validate dữ liệu đầu vào khi Manager Approve logwork (note không bắt buộc).

92: class ManagerLogWorkRejectSerializer(serializers.Serializer):
93:     reason = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
# Validate dữ liệu đầu vào khi Manager Reject logwork (bắt buộc có reason).

110: class ManagerLogWorkCorrectSerializer(serializers.Serializer):
111:     hours_spent = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0.01"), required=False)
117:     description = serializers.CharField(required=False, allow_blank=True, allow_null=True, trim_whitespace=True)
123:     adjustment_reason = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
# Validate dữ liệu đầu vào khi Manager Correct logwork.

139:     def validate(self, attrs):
140:         if "hours_spent" not in attrs and "description" not in attrs:
141:             raise serializers.ValidationError("At least one corrected field must be provided.")
145:         return attrs
# Bắt buộc phải cung cấp ít nhất 1 trong 2 trường hours_spent hoặc description để chỉnh sửa.

148: class ManagerLogWorkVoidSerializer(serializers.Serializer):
149:     reason = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
# Validate dữ liệu khi Manager Void logwork (bắt buộc nhập reason).

166: class ManagerTimeLockListSerializer(serializers.ModelSerializer):
167:     job = ManagerJobMiniSerializer(read_only=True)
168:     locked_by = ManagerUserMiniSerializer(read_only=True)
169:     unlocked_by = ManagerUserMiniSerializer(read_only=True)
# Serializer hiển thị danh sách TimeLock cấp Job cho Manager.

194: class ManagerTimeLockCreateSerializer(serializers.Serializer):
195:     job_id = serializers.IntegerField()
196:     lock_month = serializers.IntegerField(min_value=1, max_value=12)
197:     lock_year = serializers.IntegerField(min_value=2000)
198:     reason = serializers.CharField(required=False, allow_blank=True, allow_null=True, trim_whitespace=True)
# Validate payload tạo mới cờ khóa TimeLock cấp Job.

206: class ManagerTimeLockUnlockSerializer(serializers.Serializer):
207:     reason = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
# Validate payload mở khóa TimeLock (bắt buộc có reason).

224: class ManagerDailyUserTimesheetSerializer(serializers.ModelSerializer):
# Serializer cho bảng tổng hợp DailyUserTimesheet.

243: class TimeLockSerializer(serializers.ModelSerializer):
# Backward-compatibility Serializer giữ nguyên cho các module cũ nếu có import.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Serializer Class | Target Action / Usage | Key Validation Rules |
|------------------|-----------------------|----------------------|
| `ManagerLogWorkListSerializer` | Display list of work logs | Nested serialization with Mini serializers for Task, User, ReviewedBy |
| `ManagerLogWorkApproveSerializer` | Action `approve` | Optional `note` |
| `ManagerLogWorkRejectSerializer` | Action `reject` | Required non-empty `reason` |
| `ManagerLogWorkCorrectSerializer` | Action `correct` | Required `adjustment_reason`, must provide `hours_spent` or `description` |
| `ManagerLogWorkVoidSerializer` | Action `void` | Required non-empty `reason` |
| `ManagerTimeLockCreateSerializer` | Create JOB TimeLock | Validates `job_id`, `lock_month` [1..12], `lock_year` >= 2000 |
| `ManagerTimeLockUnlockSerializer` | Unlock JOB TimeLock | Required non-empty `reason` |
