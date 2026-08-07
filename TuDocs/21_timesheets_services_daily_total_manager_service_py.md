# Executive Code Annotation: `backend/timesheets/services/daily_total_manager_service.py`

**Package / Module:** `backend.timesheets.services.daily_total_manager_service` · Daily Total Calculation Domain Service

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Quy Trình Tính Toán Tổng Giờ Làm Việc (Daily Hours Accumulation Pipeline)

```
[Target: User + WorkDate]
          │
          ▼
Query LogWork (filter user, work_date)
          │
          ├─► Exclude review_status = 'VOIDED' (Bản ghi VOIDED không tính vào tổng giờ)
          ├─► Exclude current logwork ID (nếu đang ở chế độ Correct/Edit)
          │
          ▼
Aggregate Sum("hours_spent")
          │
          ▼
Normalize Hours to Decimal("0.00")
          │
          ├──────────────────────────────────────────┐
          ▼                                          ▼
assert_daily_total_not_exceed_24()         rebuild_daily_user_timesheet()
  - Current + New > 24.00 ?                  - update_or_create() vào bảng
  - Yes ──► Raise DailyTotalError (400)         DailyUserTimesheet
  - No  ──► Pass                             - Giữ dữ liệu đồng bộ
```

> **Vì sao các bản ghi `PENDING`, `APPROVED`, `REJECTED` vẫn được tính vào tổng giờ, còn `VOIDED` thì không?**
> Nhân viên khi khai báo giờ làm (kể cả chưa được duyệt hay bị từ chối) vẫn đại diện cho quỹ thời gian thể chất họ đăng ký. Để chặn việc nhân viên lợi dụng trạng thái REJECTED để log khống quá 24h/ngày, hệ thống tính tất cả các log ngoại trừ `VOIDED` (bản ghi đã chính thức bị hủy bỏ khỏi sổ sách).

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from decimal import Decimal
# Nạp lớp Decimal để xử lý tính toán chính xác.

3: from django.db.models import Sum
# Nạp hàm gom nhóm Sum của Django ORM.

4: from rest_framework.exceptions import APIException
# Nạp lớp cơ sở APIException để tạo Exception tùy biến.

6: from timesheets.models import DailyUserTimesheet, LogWork
# Nạp các model liên quan.

9: MAX_DAILY_HOURS = Decimal("24.00")
# Hằng số định nghĩa giới hạn số giờ làm việc tối đa trong 1 ngày (24.00h).

12: class DailyTotalError(APIException):
13:     status_code = 400
14:     default_detail = "Daily total hours rule violation."
15:     default_code = "daily_total_error"
# Ngoại lệ custom trả về mã HTTP 400 Bad Request khi vi phạm quy tắc tổng giờ ngày.

18: def normalize_hours(value):
19:     if value is None:
20:         return Decimal("0.00")
21:     return Decimal(str(value))
# Hàm chuẩn hóa giá trị về kiểu Decimal("0.00"). Nếu là None thì trả về 0.00.

25: def calculate_user_day_total(user_id, work_date, exclude_logwork_id=None):
# Hàm tính tổng số giờ làm việc thực tế của user trong 1 ngày cụ thể.

34:     queryset = LogWork.objects.filter(
35:         user_id=user_id,
36:         work_date=work_date,
37:     ).exclude(
38:         review_status=LogWork.ReviewStatus.VOIDED,
39:     )
# Lọc toàn bộ logwork của user trong ngày, loại trừ các bản ghi có trạng thái VOIDED.

41:     if exclude_logwork_id:
42:         queryset = queryset.exclude(id=exclude_logwork_id)
# Nếu truyền exclude_logwork_id (khi đang correct logwork), loại trừ ID đó ra khỏi tổng tính toán cũ.

44:     total = queryset.aggregate(
45:         total_hours=Sum("hours_spent")
46:     )["total_hours"]
# Thực hiện gom nhóm tính tổng Sum("hours_spent") ở mức CSDL.

48:     return normalize_hours(total)
# Chuẩn hóa kết quả trả về.

51: def assert_daily_total_not_exceed_24(
52:     *,
53:     user_id,
54:     work_date,
55:     new_hours,
56:     exclude_logwork_id=None,
57: ):
# Hàm chốt chặn (Assertion) kiểm tra tổng giờ không vượt 24h. Dùng cho cả Employee create lẫn Manager correct.

66:     current_total = calculate_user_day_total(
67:         user_id=user_id,
68:         work_date=work_date,
69:         exclude_logwork_id=exclude_logwork_id,
70:     )
# Tính tổng số giờ hiện tại.

72:     new_hours = normalize_hours(new_hours)
73:     final_total = current_total + new_hours
# Cộng dồn số giờ mới định cập nhật.

75:     if final_total > MAX_DAILY_HOURS:
76:         raise DailyTotalError(
77:             f"Daily total hours cannot exceed 24 hours. Current total: {current_total}, new hours: {new_hours}, final total: {final_total}."
78:         )
# Ném ngoại lệ DailyTotalError nếu final_total > 24.00.

80:     return final_total

83: def rebuild_daily_user_timesheet(user_id, work_date):
# Hàm đồng bộ dữ liệu sang bảng tổng hợp DailyUserTimesheet sau khi có bất kỳ thao tác thay đổi logwork nào.

89:     total_hours = calculate_user_day_total(
90:         user_id=user_id,
91:         work_date=work_date,
92:     )
# Tính toán tổng giờ chuẩn xác từ các dòng log_works.

94:     daily_record, created = DailyUserTimesheet.objects.update_or_create(
95:         user_id=user_id,
96:         work_date=work_date,
97:         defaults={
98:             "total_hours": total_hours,
99:         },
100:    )
# Cập nhật hoặc tạo mới record trong bảng DailyUserTimesheet.

102:    return daily_record
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Function / Component | Core Purpose | Important Logic & Boundary |
|----------------------|--------------|----------------------------|
| `normalize_hours()` | Chuẩn hóa dữ liệu | Chuyển đổi an toàn `None` hoặc kiểu dữ liệu thô sang `Decimal("0.00")` |
| `calculate_user_day_total()` | Tính tổng số giờ | Lọc theo user + date, tự động loại trừ `VOIDED` logwork |
| `assert_daily_total_not_exceed_24()` | Chốt chặn bảo vệ | Ném `DailyTotalError` (400) nếu tổng giờ > 24.00h |
| `rebuild_daily_user_timesheet()` | Đồng bộ bảng đệm | Dùng `update_or_create()` giữ dữ liệu bảng tổng hợp luôn chuẩn xác |
