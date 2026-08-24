from decimal import Decimal

from django.db.models import Sum
from rest_framework.exceptions import APIException

from timesheets.models import DailyUserTimesheet, LogWork


MAX_DAILY_HOURS = Decimal("8.00")


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
    - VOIDED và REJECTED không tính vào tổng giờ (giải phóng quota để nhân viên log lại task khác).
    - PENDING / APPROVED được tính vào tổng giờ.
    """
    queryset = LogWork.objects.filter(
        user_id=user_id,
        work_date=work_date,
    ).exclude(
        review_status__in=[
            LogWork.ReviewStatus.VOIDED,
            LogWork.ReviewStatus.REJECTED,
        ],
    )

    if exclude_logwork_id:
        queryset = queryset.exclude(id=exclude_logwork_id)

    total = queryset.aggregate(
        total_hours=Sum("hours_spent")
    )["total_hours"]

    return normalize_hours(total)


def assert_daily_total_not_exceed_8(
    *,
    user_id,
    work_date,
    new_hours,
    exclude_logwork_id=None,
):
    """
    Dùng khi tạo/sửa LogWork. Đảm bảo tổng giờ trong ngày <= 8.0h.
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
            f"Daily total hours cannot exceed standard 8.0 hours limit. Current total: {current_total}h, new hours: {new_hours}h, final total: {final_total}h."
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