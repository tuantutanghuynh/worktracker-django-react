"""
Module: timesheets.services.daily_total_manager_service
Description: Service functions for calculating, validating, and updating employee daily cumulative work hours.
"""

from decimal import Decimal
from django.db.models import Sum
from rest_framework.exceptions import APIException

from timesheets.models import DailyUserTimesheet, LogWork

MAX_DAILY_HOURS = Decimal("8.00")


class DailyTotalError(APIException):
    """Exception raised when daily logged hours exceed allowed standard thresholds."""
    status_code = 400
    default_detail = "Daily total hours rule violation."
    default_code = "daily_total_error"


def normalize_hours(value):
    """Convert numerical or string value into a standard Decimal instance."""
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value))


def calculate_user_day_total(user_id, work_date, exclude_logwork_id=None):
    """Calculate cumulative logged hours for a user on a given date excluding voided and rejected entries."""
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
    """Validate that adding new hours will not cause daily total to exceed standard 8-hour limit."""
    current_total = calculate_user_day_total(
        user_id=user_id,
        work_date=work_date,
        exclude_logwork_id=exclude_logwork_id,
    )

    new_hours = normalize_hours(new_hours)
    final_total = current_total + new_hours

    if final_total > MAX_DAILY_HOURS:
        raise DailyTotalError(
            f"Daily total hours cannot exceed standard {MAX_DAILY_HOURS} hours limit. "
            f"Current total: {current_total}h, new hours: {new_hours}h, final total: {final_total}h."
        )

    return final_total


assert_daily_total_not_exceed_24 = assert_daily_total_not_exceed_8


def rebuild_daily_user_timesheet(user_id, work_date):
    """Recalculate and update the daily user timesheet summary record for a specific date."""
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