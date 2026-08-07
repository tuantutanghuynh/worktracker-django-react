# 08 — P7.3 Employee Personal KPI: định nghĩa 3 chỉ số, ranh giới với "Manager"

Việc cuối cùng trong roadmap Tuần 1-4 (`project-roadmap/03-phase-tuan-tu-auth-employee.md`).
Roadmap chỉ nêu tên 3 chỉ số ("số Task quá hạn, tổng giờ log trong tuần, tỷ
lệ hoàn thành"), không định nghĩa công thức chính xác — phải tự quyết,
có 1 điểm quan trọng cần dừng lại hỏi trước khi code.

## Định nghĩa 3 chỉ số (mỗi chỉ số 1 phạm vi thời gian khác nhau)

1. **Số Task quá hạn** — snapshot "ngay bây giờ", tái dùng đúng công thức
   Đức Long đã viết ở `tasks/serializers_manager.py::get_is_overdue()`
   (`deadline < hôm nay` và `status` không phải `COMPLETED`/`CANCELLED`) —
   không tự nghĩ ra định nghĩa mới, tránh 2 chỗ trong hệ thống tính khác
   nhau cùng 1 khái niệm.
2. **Tổng giờ log tuần này** — cố định Thứ 2 → Chủ Nhật của tuần chứa hôm
   nay (không phải "7 ngày gần nhất" rolling) — người học chọn phương án
   này khi được hỏi. Loại bỏ log `VOIDED` khỏi tổng, giống
   `daily_total_manager_service.py` đã làm.
3. **Tỷ lệ hoàn thành** — ban đầu định hardcode "all-time", nhưng người học
   đề xuất nên linh hoạt để đánh giá theo tháng/quý/năm thay vì cố định.
   Giải pháp: query param `start_date`/`end_date` **không bắt buộc**, không
   truyền = tính all-time. Lọc theo `Task.deadline` (hạn chót), không phải
   ngày tạo — đánh giá hiệu suất theo "có kịp hạn không" hợp lý hơn "được
   giao lúc nào". Mẫu số loại `CANCELLED` (task bị hủy không phải lỗi của
   Employee, không nên tính vào mẫu số làm giảm tỷ lệ).

## Điểm dừng lại quan trọng: ranh giới với "Manager đánh giá nhân viên"

Khi bàn về tỷ lệ hoàn thành linh hoạt, người học đề xuất thêm ý: cho phép
**Manager** dùng khoảng thời gian này để đánh giá **nhân viên khác** (không
phải chính mình). Đây thực chất là **2 tính năng khác nhau**, không phải 1:

- **P7.3 (đúng roadmap)**: Employee tự xem KPI **chính mình** —
  `IsAuthenticated`, data isolation qua `request.user`, không cần RBAC.
- **"Manager xem KPI người khác"**: cần permission RBAC riêng (`HasPermission`
  + scope theo `department__manager=request.user`, giống
  `ManagerTeamEmployeeListView`) — và theo đúng ranh giới vai trò team đã
  thống nhất, tính năng "Manager xem báo cáo/đánh giá" nhiều khả năng thuộc
  app `reports` — **phần của Đức Long**, không phải của Tuấn Tú.

Đề xuất giữ nguyên phạm vi P7.3 (chỉ Employee tự xem), nhưng áp dụng đúng ý
hay "không hardcode thời gian" vào query param `start_date`/`end_date` —
vừa linh hoạt, vừa không lấn sang việc của Long, vừa không cần thêm RBAC.
Người học đồng ý, xác nhận **không muốn động vào phần Manager** trong lần
này. Nếu sau này cần bản Manager-facing, nên trao đổi với Long, có thể tái
dùng lại logic tính toán ở đây dưới dạng hàm dùng chung.

## Code

```python
# accounts/serializers_employee.py (thêm)
class PersonalKPIQuerySerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
```

```python
# accounts/views_employee.py (thêm) — import thêm Task, LogWork xuyên app
class PersonalKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = PersonalKPIQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        start_date = query.validated_data.get("start_date")
        end_date = query.validated_data.get("end_date")

        user = request.user
        today = timezone.localdate()

        overdue_tasks_count = Task.objects.filter(
            assignee=user, deadline__lt=today,
        ).exclude(
            status__in=[Task.Status.COMPLETED, Task.Status.CANCELLED],
        ).count()

        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        hours_this_week = LogWork.objects.filter(
            user=user, work_date__range=(week_start, week_end),
        ).exclude(
            review_status=LogWork.ReviewStatus.VOIDED,
        ).aggregate(total=Sum("hours_spent"))["total"] or Decimal("0.00")

        completion_tasks = Task.objects.filter(assignee=user).exclude(
            status=Task.Status.CANCELLED
        )
        if start_date:
            completion_tasks = completion_tasks.filter(deadline__gte=start_date)
        if end_date:
            completion_tasks = completion_tasks.filter(deadline__lte=end_date)

        total_count = completion_tasks.count()
        completed_count = completion_tasks.filter(status=Task.Status.COMPLETED).count()
        completion_rate = (completed_count / total_count) if total_count else None

        return Response({
            "overdue_tasks_count": overdue_tasks_count,
            "hours_logged_this_week": hours_this_week,
            "week_start": week_start,
            "week_end": week_end,
            "completion_rate": {
                "start_date": start_date, "end_date": end_date,
                "completed": completed_count, "total": total_count,
                "rate": completion_rate,
            },
        }, status=status.HTTP_200_OK)
```

Điểm cú pháp/thiết kế đáng nhớ:
- `today.weekday()` — 0 = Thứ 2, `today - timedelta(days=today.weekday())`
  luôn ra đúng Thứ 2 của tuần chứa `today`, bất kể hôm nay là ngày nào.
- `.aggregate(...)["total"] or Decimal("0.00")` — `Sum` trả `None` (không
  phải `0`) khi không có dòng nào khớp filter — cần fallback thủ công.
- `completion_rate` trả **`None`** khi `total_count == 0`, không trả `0` —
  "chưa có dữ liệu để tính" khác nghĩa với "0% hoàn thành", tránh hiểu lầm
  khi Frontend hiển thị.
- Import `Task`/`LogWork` xuyên app (`tasks.models`, `timesheets.models`)
  vào `accounts/views_employee.py` — bình thường trong project này, cùng
  cách `system/views_admin.py` đã làm với nhiều app khác.

Route: `GET /api/auth/me/kpi/`.

## Verify — test đối chiếu dữ liệu thật trong DB, không chỉ tin response

Trước khi tin response, tra thẳng DB qua `manage.py shell` để xác nhận số
liệu khớp: 1 Task deadline `18/07` (quá hạn so với hôm nay `29/07`, status
`TODO`) và 5 `LogWork` đều thuộc tuần `18-21/07` (tuần **trước**, không phải
tuần hiện tại `27/07-02/08`).

| # | Test | Kỳ vọng | Kết quả |
|---|------|---------|:---:|
| 1 | Không truyền date range | `overdue=1`, `hours_this_week=0.0` (đúng vì log thuộc tuần trước), `rate=0.0` | ✅ |
| 2 | Date range 01-31/07 (bao trùm deadline task) | `total=1`, `rate=0.0` | ✅ |
| 3 | Date range 01-31/01 (không bao trùm) | `total=0`, `rate=null` — đúng thiết kế phân biệt "chưa có dữ liệu" | ✅ |
| 4 | `start_date` sai định dạng | `400` "Use one of these formats instead: YYYY-MM-DD." | ✅ |

Commit: `7378f79` — "Add Employee Personal KPI: overdue task count, weekly
hours, and completion rate over an optional date range."

## Đây là việc cuối cùng của backend Tuần 1-4

Toàn bộ backend theo `project-roadmap/03-phase-tuan-tu-auth-employee.md`
Tuần 1-4 đã hoàn thành, test thật, và commit đầy đủ. Việc lớn còn lại
chuyển hẳn sang **Frontend Employee** (Layout, My Tasks, Log Work form,
Personal Dashboard, Notification Center) — hiện vẫn trống hoàn toàn, chỉ có
sẵn phần Auth (Login/Forgot/Reset/Change Password, route guards).
