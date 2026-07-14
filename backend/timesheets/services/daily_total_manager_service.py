from decimal import Decimal

from django.db.models import Sum
from rest_framework.exceptions import APIException

from timesheets.models import DailyUserTimesheet, LogWork


MAX_DAILY_HOURS = Decimal("24.00")


class DailyTotalError(APIException):
    status_code = 400
    default_detail = "Daily total hours rule violation."
    default_code = "daily_total_error"


def normalize_hours(value):
    if value is None:
        return Decimal("0.00")

    return Decimal(str(value))


def calculate_user_day_total(user_id, work_date, exclude_logwork_id=None):
    """
    Tính tổng giờ làm của 1 user trong 1 ngày.

    Quy ước:
    - VOIDED không tính vào tổng giờ.
    - PENDING / APPROVED / REJECTED vẫn tính, vì đó vẫn là log đã nhập,
      trừ khi Manager void log đó.
    """
    queryset = LogWork.objects.filter(
        user_id=user_id,
        work_date=work_date,
    ).exclude(
        review_status=LogWork.ReviewStatus.VOIDED,
    )

    if exclude_logwork_id:
        queryset = queryset.exclude(id=exclude_logwork_id)

    total = queryset.aggregate(
        total_hours=Sum("hours_spent")
    )["total_hours"]

    return normalize_hours(total)


def assert_daily_total_not_exceed_24(
    *,
    user_id,
    work_date,
    new_hours,
    exclude_logwork_id=None,
):
    """
    Dùng khi tạo/sửa LogWork.

    Ví dụ:
    - User đã có 20h trong ngày.
    - Manager sửa 1 log thành 5h.
    - Tổng mới = 25h => chặn.
    """
    current_total = calculate_user_day_total(
        user_id=user_id,
        work_date=work_date,
        exclude_logwork_id=exclude_logwork_id,
    )

    new_hours = normalize_hours(new_hours)
    final_total = current_total + new_hours

    if final_total > MAX_DAILY_HOURS:
        raise DailyTotalError(
            f"Daily total hours cannot exceed 24 hours. Current total: {current_total}, new hours: {new_hours}, final total: {final_total}."
        )

    return final_total


def rebuild_daily_user_timesheet(user_id, work_date):
    """
    Đồng bộ lại bảng DailyUserTimesheet sau khi approve/reject/correct/void.

    DailyUserTimesheet là bảng tổng hợp theo ngày.
    """
    total_hours = calculate_user_day_total(
        user_id=user_id,
        work_date=work_date,
    )

    daily_record, created = DailyUserTimesheet.objects.update_or_create(
        user_id=user_id,
        work_date=work_date,
        defaults={
            "total_hours": total_hours,
        },
    )

    return daily_record