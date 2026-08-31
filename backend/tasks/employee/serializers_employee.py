from rest_framework import serializers
from tasks.models import Task, TaskAttachment, TaskComment
from timesheets.models import LogWork

class EmployeeTaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='user.profile.full_name', read_only=True)

    class Meta:
        model = TaskAttachment
        fields = ['id', 'file_name', 'file_url', 'file_size', 'uploaded_at', 'uploaded_by_name']
        read_only_fields = ['id', 'uploaded_at', 'uploaded_by_name']


class EmployeeTaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='user.profile.full_name', read_only=True)
    author_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'content', 'comment_type', 'created_at', 'author_name', 'author_email']
        read_only_fields = ['id', 'comment_type', 'created_at', 'author_name', 'author_email']


class EmployeeTaskListSerializer(serializers.ModelSerializer):
    """Dùng cho Bảng Kanban & Danh sách My Tasks của Nhân viên"""
    job_code = serializers.CharField(source='job.job_code', read_only=True)
    job_name = serializers.CharField(source='job.job_name', read_only=True)
    manager_name = serializers.CharField(source='job.manager.profile.full_name', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'deadline', 'order_index', 'job_id', 'job_code', 'job_name',
            'manager_name', 'created_at', 'updated_at', 'completed_at'
        ]

        
class EmployeeTaskLogWorkSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogWork
        fields = ['id', 'work_date', 'hours_spent', 'description', 'review_status', 'adjustment_reason']
        read_only_fields = fields

class EmployeeTaskDetailSerializer(serializers.ModelSerializer):
    """Dùng khi nhấp xem chi tiết 1 Task"""
    job_code = serializers.CharField(source='job.job_code', read_only=True)
    job_name = serializers.CharField(source='job.job_name', read_only=True)
    manager_name = serializers.CharField(source='job.manager.profile.full_name', read_only=True)
    manager_email = serializers.CharField(source='job.manager.email', read_only=True)
    attachments = EmployeeTaskAttachmentSerializer(many=True, read_only=True)
    comments = EmployeeTaskCommentSerializer(many=True, read_only=True)
    work_logs = EmployeeTaskLogWorkSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'deadline', 'completed_at', 'order_index', 'job_id',
            'job_code', 'job_name', 'manager_name', 'manager_email',
            'attachments', 'comments', 'work_logs', 'created_at', 'updated_at'
        ]



class EmployeeTaskStatusUpdateSerializer(serializers.Serializer):
    """Xử lý cập nhật trạng thái khi kéo thả thẻ trên Kanban hoặc thu hồi task"""
    status = serializers.ChoiceField(choices=['TODO', 'IN_PROGRESS', 'REVIEWING'])
    order_index = serializers.CharField(required=False, allow_blank=True)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_status(self, value):
        if value == 'COMPLETED':
            raise serializers.ValidationError(
                "Employees cannot directly mark tasks as COMPLETED. Please submit the task as REVIEWING for Manager QA inspection."
            )
        return value
    

