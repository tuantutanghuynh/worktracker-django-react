"""
Module: projects.manager.filters_manager
Description: Custom filter parser and ordering handler for manager-scoped project job queries.
"""

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from projects.models import Job


class ManagerJobFilter:
    """Filter processor for manager job list queries supporting status, priority, and date range filters."""

    VALID_ORDER_FIELDS = {
        "deadline",
        "created_at",
        "updated_at",
        "job_name",
        "job_code",
        "priority",
        "status",
    }

    @classmethod
    def apply(cls, queryset, params):
        """Apply all configured filter methods and ordering to the scoped queryset."""
        queryset = cls.filter_status(queryset, params)
        queryset = cls.filter_priority(queryset, params)
        queryset = cls.filter_client(queryset, params)
        queryset = cls.filter_client_is_active(queryset, params)
        queryset = cls.filter_deadline_range(queryset, params)
        queryset = cls.filter_search(queryset, params)
        queryset = cls.filter_is_overdue(queryset, params)
        queryset = cls.apply_ordering(queryset, params)

        return queryset

    @classmethod
    def filter_status(cls, queryset, params):
        """Filter queryset by single status code or comma-separated list of statuses."""
        status = params.get("status")
        status_in = params.get("status__in")

        valid_statuses = {
            value
            for value, label in Job.Status.choices
        }

        if status:
            if status not in valid_statuses:
                raise ValidationError(
                    {
                        "status": "Invalid job status."
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
        """Filter queryset by job priority level."""
        priority = params.get("priority")
        if not priority:
            return queryset

        valid_priorities = {value for value, label in Job.Priority.choices}
        if priority not in valid_priorities:
            raise ValidationError(
                {
                    "priority": f"Invalid priority. Must be one of: {sorted(valid_priorities)}"
                }
            )

        return queryset.filter(priority=priority)

    @classmethod
    def filter_client(cls, queryset, params):
        """Filter queryset by client entity primary key."""
        client_id = params.get("client_id")

        if not client_id:
            return queryset

        if not str(client_id).isdigit():
            raise ValidationError(
                {
                    "client_id": "client_id must be an integer."
                }
            )

        return queryset.filter(client_id=int(client_id))

    @classmethod
    def filter_client_is_active(cls, queryset, params):
        """Filter queryset by client active status boolean."""
        client_is_active = params.get("client_is_active")
        if client_is_active is not None:
            val = str(client_is_active).lower().strip() in ["true", "1", "yes"]
            queryset = queryset.filter(client__is_active=val)
        return queryset

    @classmethod
    def filter_deadline_range(cls, queryset, params):
        """Filter queryset within specified deadline start and end dates."""
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
    def filter_search(cls, queryset, params):
        """Perform case-insensitive search across job code, name, description, and client fields."""
        search = (params.get("search") or "").strip()

        if not search:
            return queryset

        return queryset.filter(
            Q(job_name__icontains=search)
            | Q(job_code__icontains=search)
            | Q(description__icontains=search)
            | Q(client__client_name__icontains=search)
            | Q(client__industry__icontains=search)
        )

    @classmethod
    def filter_is_overdue(cls, queryset, params):
        """Filter queryset for overdue jobs based on current local date."""
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
                    Job.Status.COMPLETED,
                    Job.Status.CANCELLED,
                ]
            )

        return queryset.filter(
            Q(deadline__gte=today)
            | Q(
                status__in=[
                    Job.Status.COMPLETED,
                    Job.Status.CANCELLED,
                ]
            )
        )

    @classmethod
    def apply_ordering(cls, queryset, params):
        """Apply validated field ordering to queryset with default descending creation date."""
        ordering = params.get("ordering")

        if not ordering:
            return queryset.order_by("-created_at")

        raw_field = ordering.strip()
        field_name = raw_field.lstrip("-")

        if field_name not in cls.VALID_ORDER_FIELDS:
            raise ValidationError(
                {
                    "ordering": f"Invalid ordering field: {field_name}"
                }
            )

        return queryset.order_by(raw_field)