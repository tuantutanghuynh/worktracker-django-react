"""
Module: reports.manager.serializers_manager
Description: Query parameter serializers for manager dashboard analytics and report exports.
"""

from rest_framework import serializers

from tasks.models import Task
from timesheets.models import LogWork


class ManagerDashboardQuerySerializer(serializers.Serializer):
    """Serializer validating month and year parameters for manager dashboard analytics."""

    month = serializers.IntegerField(
        min_value=1,
        max_value=12,
    )
    year = serializers.IntegerField(
        min_value=2000,
    )


class ManagerTaskSummaryReportQuerySerializer(serializers.Serializer):
    """Serializer validating filter criteria for task summary report queries."""

    job_id = serializers.IntegerField(
        required=False,
    )
    assignee_id = serializers.IntegerField(
        required=False,
    )
    status = serializers.ChoiceField(
        choices=Task.Status.choices,
        required=False,
    )
    priority = serializers.ChoiceField(
        choices=Task.Priority.choices,
        required=False,
    )
    deadline_from = serializers.DateField(
        required=False,
    )
    deadline_to = serializers.DateField(
        required=False,
    )

    def validate(self, attrs):
        """Ensure deadline start date is on or before deadline end date."""
        deadline_from = attrs.get("deadline_from")
        deadline_to = attrs.get("deadline_to")

        if deadline_from and deadline_to and deadline_from > deadline_to:
            raise serializers.ValidationError(
                {
                    "deadline_to": "deadline_to must be greater than or equal to deadline_from."
                }
            )

        return attrs


class ManagerTimesheetDetailReportQuerySerializer(serializers.Serializer):
    """Serializer validating filter criteria for detailed timesheet report queries."""

    work_date_from = serializers.DateField(
        required=False,
    )
    work_date_to = serializers.DateField(
        required=False,
    )
    employee_id = serializers.IntegerField(
        required=False,
    )
    department_id = serializers.IntegerField(
        required=False,
    )
    job_id = serializers.IntegerField(
        required=False,
    )
    task_id = serializers.IntegerField(
        required=False,
    )
    task_status = serializers.ChoiceField(
        choices=Task.Status.choices,
        required=False,
    )
    review_status = serializers.ChoiceField(
        choices=LogWork.ReviewStatus.choices,
        required=False,
    )
    locked_period_status = serializers.ChoiceField(
        choices=[
            ("LOCKED", "Locked"),
            ("UNLOCKED", "Unlocked"),
        ],
        required=False,
    )
    include_voided = serializers.BooleanField(
        required=False,
        default=False,
    )

    def validate(self, attrs):
        """Ensure work date start is on or before work date end."""
        work_date_from = attrs.get("work_date_from")
        work_date_to = attrs.get("work_date_to")

        if work_date_from and work_date_to and work_date_from > work_date_to:
            raise serializers.ValidationError(
                {
                    "work_date_to": "work_date_to must be greater than or equal to work_date_from."
                }
            )

        return attrs


class ManagerReportExportQuerySerializer(serializers.Serializer):
    """Serializer validating parameters and filters for report file export requests."""

    report_type = serializers.ChoiceField(
        choices=[
            ("TASK_SUMMARY", "Task Summary"),
            ("TIMESHEET_DETAIL", "Timesheet Detail"),
        ],
    )
    file_format = serializers.ChoiceField(
        choices=[
            ("XLSX", "Excel"),
            ("PDF", "PDF"),
        ],
    )

    job_id = serializers.IntegerField(
        required=False,
    )
    task_id = serializers.IntegerField(
        required=False,
    )
    employee_id = serializers.IntegerField(
        required=False,
    )
    department_id = serializers.IntegerField(
        required=False,
    )

    status = serializers.ChoiceField(
        choices=Task.Status.choices,
        required=False,
    )
    priority = serializers.ChoiceField(
        choices=Task.Priority.choices,
        required=False,
    )
    assignee_id = serializers.IntegerField(
        required=False,
    )
    deadline_from = serializers.DateField(
        required=False,
    )
    deadline_to = serializers.DateField(
        required=False,
    )

    work_date_from = serializers.DateField(
        required=False,
    )
    work_date_to = serializers.DateField(
        required=False,
    )
    task_status = serializers.ChoiceField(
        choices=Task.Status.choices,
        required=False,
    )
    review_status = serializers.ChoiceField(
        choices=LogWork.ReviewStatus.choices,
        required=False,
    )
    locked_period_status = serializers.ChoiceField(
        choices=[
            ("LOCKED", "Locked"),
            ("UNLOCKED", "Unlocked"),
        ],
        required=False,
    )
    include_voided = serializers.BooleanField(
        required=False,
        default=False,
    )

    def validate(self, attrs):
        """Validate chronology across deadline and work date ranges."""
        deadline_from = attrs.get("deadline_from")
        deadline_to = attrs.get("deadline_to")

        if deadline_from and deadline_to and deadline_from > deadline_to:
            raise serializers.ValidationError(
                {
                    "deadline_to": "deadline_to must be greater than or equal to deadline_from."
                }
            )

        work_date_from = attrs.get("work_date_from")
        work_date_to = attrs.get("work_date_to")

        if work_date_from and work_date_to and work_date_from > work_date_to:
            raise serializers.ValidationError(
                {
                    "work_date_to": "work_date_to must be greater than or equal to work_date_from."
                }
            )

        return attrs