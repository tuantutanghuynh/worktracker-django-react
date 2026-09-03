"""
Module: timesheets.manager.filters_manager
Description: Custom query filters and parameter parsers for manager-scoped work logs and period locks.
"""

from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from timesheets.models import LogWork, TimeLock


def parse_int_param(value, field_name):
    """Safely parse integer parameter or raise ValidationError with field context."""
    if value is None or value == "":
        return None

    if not str(value).isdigit():
        raise ValidationError(
            {
                field_name: f"{field_name} must be an integer."
            }
        )

    return int(value)


def parse_bool_param(value, field_name):
    """Safely parse boolean query parameter from string representation."""
    if value is None:
        return None

    clean_value = str(value).strip().lower()

    if clean_value in ["true", "1"]:
        return True

    if clean_value in ["false", "0"]:
        return False

    raise ValidationError(
        {
            field_name: "Use true/false or 1/0."
        }
    )


class ManagerLogWorkFilter:
    """Applies scoping, status, project, task, user, and date filters to work log querysets."""

    VALID_ORDER_FIELDS = {
        "work_date",
        "hours_spent",
        "created_at",
        "updated_at",
        "review_status",
    }

    @classmethod
    def apply(cls, queryset, params):
        """Apply all configured filter methods and ordering to work log queryset."""
        queryset = cls.filter_review_status(queryset, params)
        queryset = cls.filter_job(queryset, params)
        queryset = cls.filter_task(queryset, params)
        queryset = cls.filter_user(queryset, params)
        queryset = cls.filter_work_date_range(queryset, params)
        queryset = cls.filter_search(queryset, params)
        queryset = cls.apply_ordering(queryset, params)

        return queryset

    @classmethod
    def filter_review_status(cls, queryset, params):
        """Filter queryset by single review status or comma-separated list of statuses."""
        review_status = params.get("review_status") or params.get("status")
        review_status_in = params.get("review_status__in") or params.get("status__in")

        valid_statuses = {
            value
            for value, label in LogWork.ReviewStatus.choices
        }

        if review_status:
            if review_status not in valid_statuses:
                raise ValidationError(
                    {
                        "review_status": "Invalid review status."
                    }
                )

            queryset = queryset.filter(review_status=review_status)

        if review_status_in:
            status_list = [
                item.strip()
                for item in review_status_in.split(",")
                if item.strip()
            ]

            invalid_statuses = [
                item
                for item in status_list
                if item not in valid_statuses
            ]

            if invalid_statuses:
                raise ValidationError(
                    {
                        "review_status__in": f"Invalid statuses: {invalid_statuses}"
                    }
                )

            queryset = queryset.filter(review_status__in=status_list)

        return queryset

    @classmethod
    def filter_job(cls, queryset, params):
        """Filter work logs by associated job ID."""
        job_id = parse_int_param(
            params.get("job_id"),
            "job_id",
        )

        if job_id is None:
            return queryset

        return queryset.filter(task__job_id=job_id)

    @classmethod
    def filter_task(cls, queryset, params):
        """Filter work logs by associated task ID."""
        task_id = parse_int_param(
            params.get("task_id"),
            "task_id",
        )

        if task_id is None:
            return queryset

        return queryset.filter(task_id=task_id)

    @classmethod
    def filter_user(cls, queryset, params):
        """Filter work logs by submitting user ID."""
        user_id = parse_int_param(
            params.get("user_id"),
            "user_id",
        )

        if user_id is None:
            return queryset

        return queryset.filter(user_id=user_id)

    @classmethod
    def filter_work_date_range(cls, queryset, params):
        """Filter work logs between optional start and end date bounds."""
        work_date_from = params.get("work_date_from")
        work_date_to = params.get("work_date_to")

        if work_date_from:
            parsed_from = parse_date(work_date_from)

            if parsed_from is None:
                raise ValidationError(
                    {
                        "work_date_from": "Invalid date format. Use YYYY-MM-DD."
                    }
                )

            queryset = queryset.filter(work_date__gte=parsed_from)

        if work_date_to:
            parsed_to = parse_date(work_date_to)

            if parsed_to is None:
                raise ValidationError(
                    {
                        "work_date_to": "Invalid date format. Use YYYY-MM-DD."
                    }
                )

            queryset = queryset.filter(work_date__lte=parsed_to)

        return queryset

    @classmethod
    def filter_search(cls, queryset, params):
        """Search work logs by keyword across description, task title, email, and author name."""
        search = params.get("search")

        if not search:
            return queryset

        search = search.strip()

        if not search:
            return queryset

        return queryset.filter(
            Q(description__icontains=search)
            | Q(task__title__icontains=search)
            | Q(user__email__icontains=search)
            | Q(user__profile__full_name__icontains=search)
        )

    @classmethod
    def apply_ordering(cls, queryset, params):
        """Apply requested sort field or fallback to default date descending."""
        ordering = params.get("ordering")

        if not ordering:
            return queryset.order_by(
                "-work_date",
                "-created_at",
            )

        raw_field = ordering.strip()
        field_name = raw_field.lstrip("-")

        if field_name not in cls.VALID_ORDER_FIELDS:
            raise ValidationError(
                {
                    "ordering": f"Invalid ordering field: {field_name}"
                }
            )

        return queryset.order_by(raw_field)


class ManagerTimeLockFilter:
    """Applies job, period, lock status, and sorting filters to manager-scoped time locks."""

    VALID_ORDER_FIELDS = {
        "lock_month",
        "lock_year",
        "locked_at",
        "unlocked_at",
        "updated_at",
        "is_locked",
    }

    @classmethod
    def apply(cls, queryset, params):
        """Apply all configured filter methods and ordering to time-lock queryset."""
        queryset = cls.filter_job(queryset, params)
        queryset = cls.filter_month_year(queryset, params)
        queryset = cls.filter_is_locked(queryset, params)
        queryset = cls.filter_lock_scope(queryset, params)
        queryset = cls.apply_ordering(queryset, params)

        return queryset

    @classmethod
    def filter_job(cls, queryset, params):
        """Filter period locks by associated job ID."""
        job_id = parse_int_param(
            params.get("job_id"),
            "job_id",
        )

        if job_id is None:
            return queryset

        return queryset.filter(job_id=job_id)

    @classmethod
    def filter_month_year(cls, queryset, params):
        """Filter period locks by month and year integers."""
        lock_month = parse_int_param(
            params.get("lock_month"),
            "lock_month",
        )
        lock_year = parse_int_param(
            params.get("lock_year"),
            "lock_year",
        )

        if lock_month is not None:
            if not 1 <= lock_month <= 12:
                raise ValidationError(
                    {
                        "lock_month": "lock_month must be between 1 and 12."
                    }
                )

            queryset = queryset.filter(lock_month=lock_month)

        if lock_year is not None:
            queryset = queryset.filter(lock_year=lock_year)

        return queryset

    @classmethod
    def filter_is_locked(cls, queryset, params):
        """Filter period locks by active boolean lock state."""
        is_locked = parse_bool_param(
            params.get("is_locked"),
            "is_locked",
        )

        if is_locked is None:
            return queryset

        return queryset.filter(is_locked=is_locked)

    @classmethod
    def filter_lock_scope(cls, queryset, params):
        """Filter period locks by lock scope choice."""
        lock_scope = params.get("lock_scope")

        if not lock_scope:
            return queryset

        valid_scopes = {
            value
            for value, label in TimeLock.LockScope.choices
        }

        if lock_scope not in valid_scopes:
            raise ValidationError(
                {
                    "lock_scope": "Invalid lock scope."
                }
            )

        return queryset.filter(lock_scope=lock_scope)

    @classmethod
    def apply_ordering(cls, queryset, params):
        """Apply requested sort field or fallback to descending year and month."""
        ordering = params.get("ordering")

        if not ordering:
            return queryset.order_by(
                "-lock_year",
                "-lock_month",
                "job_id",
            )

        raw_field = ordering.strip()
        field_name = raw_field.lstrip("-")

        if field_name not in cls.VALID_ORDER_FIELDS:
            raise ValidationError(
                {
                    "ordering": f"Invalid ordering field: {field_name}"
                }
            )

        return queryset.order_by(raw_field)