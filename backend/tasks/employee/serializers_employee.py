"""
Module: tasks.employee.serializers_employee
Description: Serializers for employee task lists, detail views, work logs, status updates, comments, and attachments.
"""

from rest_framework import serializers
from tasks.models import Task, TaskAttachment, TaskComment
from timesheets.models import LogWork


class EmployeeTaskAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for task attachment records uploaded or viewed by employees."""

    uploaded_by_name = serializers.CharField(source='user.profile.full_name', read_only=True)

    class Meta:
        model = TaskAttachment
        fields = ['id', 'file_name', 'file_url', 'file_size', 'uploaded_at', 'uploaded_by_name']
        read_only_fields = ['id', 'uploaded_at', 'uploaded_by_name']


class EmployeeTaskCommentSerializer(serializers.ModelSerializer):
    """Serializer for discussion comments on employee-assigned tasks."""

    author_name = serializers.CharField(source='user.profile.full_name', read_only=True)
    author_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'content', 'comment_type', 'created_at', 'author_name', 'author_email']
        read_only_fields = ['id', 'comment_type', 'created_at', 'author_name', 'author_email']


class EmployeeTaskListSerializer(serializers.ModelSerializer):
    """Serializer for employee Kanban board cards and personal task lists."""

    job_code = serializers.CharField(source='job.job_code', read_only=True)
    job_name = serializers.CharField(source='job.job_name', read_only=True)
    job_status = serializers.CharField(source='job.status', read_only=True)
    job_client_is_active = serializers.BooleanField(source='job.client.is_active', read_only=True, default=True)
    job_client_name = serializers.CharField(source='job.client.client_name', read_only=True, default=None)
    manager_name = serializers.CharField(source='job.manager.profile.full_name', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'start_date', 'deadline', 'order_index', 'job_id', 'job_code', 'job_name',
            'job_status', 'job_client_is_active', 'job_client_name',
            'manager_name', 'created_at', 'updated_at', 'completed_at'
        ]


class EmployeeTaskLogWorkSerializer(serializers.ModelSerializer):
    """Serializer displaying associated work logs on employee task."""

    class Meta:
        model = LogWork
        fields = ['id', 'work_date', 'hours_spent', 'description', 'review_status', 'adjustment_reason']
        read_only_fields = fields


class EmployeeTaskDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for employee single-task modal view including attachments, comments, and work logs."""

    job_code = serializers.CharField(source='job.job_code', read_only=True)
    job_name = serializers.CharField(source='job.job_name', read_only=True)
    job_status = serializers.CharField(source='job.status', read_only=True)
    job_client_is_active = serializers.BooleanField(source='job.client.is_active', read_only=True, default=True)
    job_client_name = serializers.CharField(source='job.client.client_name', read_only=True, default=None)
    manager_name = serializers.CharField(source='job.manager.profile.full_name', read_only=True)
    manager_email = serializers.CharField(source='job.manager.email', read_only=True)
    attachments = EmployeeTaskAttachmentSerializer(many=True, read_only=True)
    comments = EmployeeTaskCommentSerializer(many=True, read_only=True)
    work_logs = EmployeeTaskLogWorkSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'start_date', 'deadline', 'completed_at', 'order_index', 'job_id',
            'job_code', 'job_name', 'job_status', 'job_client_is_active', 'job_client_name',
            'manager_name', 'manager_email',
            'attachments', 'comments', 'work_logs', 'created_at', 'updated_at'
        ]


class EmployeeTaskStatusUpdateSerializer(serializers.Serializer):
    """Serializer validating status transition requests submitted by employee."""

    status = serializers.ChoiceField(choices=['TODO', 'IN_PROGRESS', 'REVIEWING'])
    order_index = serializers.CharField(required=False, allow_blank=True)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_status(self, value):
        """Disallow direct completion marking by employees without manager review."""
        if value == 'COMPLETED':
            raise serializers.ValidationError(
                "Employees cannot directly mark tasks as COMPLETED. Please submit the task as REVIEWING for Manager QA inspection."
            )
        return value
