from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import serializers
from ..models import Client, Job
from tasks.models import Task


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'


class JobSerializer(serializers.ModelSerializer):
    initial_team_member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    project_team = serializers.SerializerMethodField(read_only=True)
    team_size = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Job
        fields = '__all__'

    def get_team_size(self, obj):
        from chat.models import ChatParticipant
        task_assignee_ids = set(obj.tasks.values_list('assignee_id', flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job=obj, room__room_type='JOB')
            .exclude(user=obj.manager)
            .values_list('user_id', flat=True)
            .distinct()
        )
        return len(task_assignee_ids | team_participant_ids)

    def get_project_team(self, obj):
        from chat.models import ChatParticipant
        User = get_user_model()
        task_assignee_ids = set(obj.tasks.values_list('assignee_id', flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job=obj, room__room_type='JOB')
            .exclude(user=obj.manager)
            .values_list('user_id', flat=True)
            .distinct()
        )
        all_member_ids = task_assignee_ids | team_participant_ids
        users = User.objects.filter(id__in=all_member_ids, is_active=True).select_related('profile', 'profile__department')
        return [
            {
                'id': u.id,
                'email': u.email,
                'full_name': getattr(getattr(u, 'profile', None), 'full_name', '') or u.email,
                'department_name': getattr(getattr(getattr(u, 'profile', None), 'department', None), 'name', 'General'),
            }
            for u in users
        ]

    def validate_client(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign job to an inactive client.")
        return value

    def validate_manager(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign an inactive user as project manager.")
        role_code = getattr(getattr(value, 'role', None), 'code', None)
        if role_code not in ['MANAGER', 'ADMIN']:
            raise serializers.ValidationError("Project manager must have an active MANAGER or ADMIN role.")
        return value
    
    ALLOWED_TRANSITIONS = {
        'PLANNING': ['ACTIVE', 'CANCELLED'],
        'ACTIVE': ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
        'ON_HOLD': ['ACTIVE', 'CANCELLED'],
        'COMPLETED': ['ACTIVE'],
        'CANCELLED': ['ACTIVE']
    }      
    
    def validate_status(self, value):
        if self.instance:
            current = self.instance.status
            allowed = self.ALLOWED_TRANSITIONS.get(current, [])
            if value != current and value not in allowed:
                raise serializers.ValidationError(
                f"Cannot transition from '{current}' to '{value}'."
            )
        return value
        
    def validate(self, data):
        start_date = data.get('start_date', self.instance.start_date if self.instance else None)
        deadline = data.get('deadline', self.instance.deadline if self.instance else None)
        today = timezone.localdate()

        # When creating a new job, deadline cannot be in the past
        if not self.instance and deadline and deadline < today:
            raise serializers.ValidationError({'deadline': f'Deadline cannot be in the past (must be on or after {today}).'})

        if start_date and deadline and deadline < start_date:
            raise serializers.ValidationError({'deadline': 'Deadline must be on or after start date.'})
        return data

    def create(self, validated_data):
        initial_team_ids = validated_data.pop('initial_team_member_ids', [])
        job = super().create(validated_data)

        # Khởi tạo Kênh Chat Dự án và gán Project Team (KHÔNG tạo task rác)
        from chat.models import ChatRoom, ChatParticipant
        room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
        room, _ = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.JOB,
            job=job,
            defaults={"name": room_name},
        )
        if job.manager:
            ChatParticipant.objects.get_or_create(room=room, user=job.manager)

        if initial_team_ids:
            User = get_user_model()
            employees = User.objects.filter(id__in=initial_team_ids, is_active=True, role__code='EMPLOYEE')
            for emp in employees:
                ChatParticipant.objects.get_or_create(room=room, user=emp)

        return job

    def update(self, instance, validated_data):
        initial_team_ids = validated_data.pop('initial_team_member_ids', None)
        job = super().update(instance, validated_data)

        # Cập nhật Project Team qua ChatParticipant của Job (KHÔNG tạo task rác)
        from chat.models import ChatRoom, ChatParticipant
        room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
        room, _ = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.JOB,
            job=job,
            defaults={"name": room_name},
        )
        if job.manager:
            ChatParticipant.objects.get_or_create(room=room, user=job.manager)

        if initial_team_ids is not None:
            User = get_user_model()
            employees = User.objects.filter(id__in=initial_team_ids, is_active=True, role__code='EMPLOYEE')
            for emp in employees:
                ChatParticipant.objects.get_or_create(room=room, user=emp)

        return job

