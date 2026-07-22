from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework.exceptions import ValidationError

from tasks.models import Task


class ManagerTaskFilter:
    """
    Filter Task cho Manager.

    Lưu ý:
    - Queryset truyền vào phải là queryset đã scope:
          scoped_tasks(request.user)
    - Không dùng class này với Task.objects.all() cho Manager.
    """

    VALID_ORDER_FIELDS = {
        "deadline",
        "priority",
        "created_at",
        "updated_at",
        "order_index",
        "title",
        "status",
    }

    @classmethod
    def apply(cls, queryset, params):
        queryset = cls.filter_status(queryset, params)
        queryset = cls.filter_priority(queryset, params)
        queryset = cls.filter_job(queryset, params)
        queryset = cls.filter_assignee(queryset, params)
        queryset = cls.filter_deadline_range(queryset, params)
        queryset = cls.filter_is_overdue(queryset, params)
        queryset = cls.filter_search(queryset, params)
        queryset = cls.apply_ordering(queryset, params)

        return queryset

    @classmethod
    def filter_status(cls, queryset, params):
        status = params.get("status")
        status_in = params.get("status__in")

        valid_statuses = {
            value
            for value, label in Task.Status.choices
        }

        if status:
            if status not in valid_statuses:
                raise ValidationError(
                    {
                        "status": "Invalid task status."
                    }
                )

            queryset = queryset.filter(status=status)

        if status_in:
            status_list = [
                item.strip()
                for item in status_in.split(",")
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
                        "status__in": f"Invalid statuses: {invalid_statuses}"
                    }
                )

            queryset = queryset.filter(status__in=status_list)

        return queryset

    @classmethod
    def filter_priority(cls, queryset, params):
        priority = params.get("priority")
        priority_in = params.get("priority__in")

        valid_priorities = {
            value
            for value, label in Task.Priority.choices
        }

        if priority:
            if priority not in valid_priorities:
                raise ValidationError(
                    {
                        "priority": "Invalid task priority."
                    }
                )

            queryset = queryset.filter(priority=priority)

        if priority_in:
            priority_list = [
                item.strip()
                for item in priority_in.split(",")
                if item.strip()
            ]

            invalid_priorities = [
                item
                for item in priority_list
                if item not in valid_priorities
            ]

            if invalid_priorities:
                raise ValidationError(
                    {
                        "priority__in": f"Invalid priorities: {invalid_priorities}"
                    }
                )

            queryset = queryset.filter(priority__in=priority_list)

        return queryset

    @classmethod
    def filter_job(cls, queryset, params):
        job_id = params.get("job_id")

        if not job_id:
            return queryset

        if not str(job_id).isdigit():
            raise ValidationError(
                {
                    "job_id": "job_id must be an integer."
                }
            )

        return queryset.filter(job_id=int(job_id))

    @classmethod
    def filter_assignee(cls, queryset, params):
        assignee_id = params.get("assignee_id")

        if not assignee_id:
            return queryset

        if not str(assignee_id).isdigit():
            raise ValidationError(
                {
                    "assignee_id": "assignee_id must be an integer."
                }
            )

        return queryset.filter(assignee_id=int(assignee_id))

    @classmethod
    def filter_deadline_range(cls, queryset, params):
        deadline_from = params.get("deadline_from")
        deadline_to = params.get("deadline_to")

        if deadline_from:
            parsed_from = parse_date(deadline_from)

            if parsed_from is None:
                raise ValidationError(
                    {
                        "deadline_from": "Invalid date format. Use YYYY-MM-DD."
                    }
                )

            queryset = queryset.filter(deadline__gte=parsed_from)

        if deadline_to:
            parsed_to = parse_date(deadline_to)

            if parsed_to is None:
                raise ValidationError(
                    {
                        "deadline_to": "Invalid date format. Use YYYY-MM-DD."
                    }
                )

            queryset = queryset.filter(deadline__lte=parsed_to)

        return queryset

    @classmethod
    def filter_is_overdue(cls, queryset, params):
        is_overdue = params.get("is_overdue")

        if is_overdue is None:
            return queryset

        value = str(is_overdue).lower().strip()

        if value not in ["true", "false", "1", "0"]:
            raise ValidationError(
                {
                    "is_overdue": "Use true/false or 1/0."
                }
            )

        today = timezone.localdate()

        if value in ["true", "1"]:
            return queryset.filter(
                deadline__lt=today,
            ).exclude(
                status__in=[
                    Task.Status.COMPLETED,
                    Task.Status.CANCELLED,
                ]
            )

        return queryset.filter(
            Q(deadline__gte=today)
            | Q(
                status__in=[
                    Task.Status.COMPLETED,
                    Task.Status.CANCELLED,
                ]
            )
        )

    @classmethod
    def filter_search(cls, queryset, params):
        search = params.get("search")

        if not search:
            return queryset

        search = search.strip()

        if not search:
            return queryset

        return queryset.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
        )

    @classmethod
    def apply_ordering(cls, queryset, params):
        ordering = params.get("ordering")

        if not ordering:
            return queryset.order_by("status", "order_index", "deadline")

        raw_field = ordering.strip()
        field_name = raw_field.lstrip("-")

        if field_name not in cls.VALID_ORDER_FIELDS:
            raise ValidationError(
                {
                    "ordering": f"Invalid ordering field: {field_name}"
                }
            )

        return queryset.order_by(raw_field)