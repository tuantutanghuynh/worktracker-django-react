# tasks/serializers.py
from rest_framework import serializers
from tasks.models import Task

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '__all__'
        # BR-12: Trường creator và completed_at sẽ do hệ thống tự động điền
        read_only_fields = ('creator', 'completed_at', 'created_at', 'updated_at')

    def validate(self, attrs):
        job = attrs.get('job')
        deadline = attrs.get('deadline')

        # BR-13, FR-33: Hạn chót của Task không được vượt quá hạn chót của Job cha
        if job and deadline:
            if deadline > job.deadline:
                raise serializers.ValidationError({
                    "deadline": f"Hạn chót công việc ({deadline}) không được vượt quá hạn chót của dự án ({job.deadline})."
                })
        return attrs

class RejectTaskSerializer(serializers.Serializer):
    """
    BR-16: Dùng riêng cho hành động từ chối task, ép buộc phải nhập lý do.
    """
    rejection_reason = serializers.CharField(
        required=True, 
        error_messages={"required": "Bắt buộc phải nhập lý do từ chối nghiệm thu."}
    )