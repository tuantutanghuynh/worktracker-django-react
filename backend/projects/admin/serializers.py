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
        return obj.tasks.values('assignee_id').distinct().count()

    def get_project_team(self, obj):
        tasks = obj.tasks.select_related('assignee', 'assignee__profile', 'assignee__profile__department')
        seen_ids = set()
        members = []
        for task in tasks:
            user = task.assignee
            if user and user.id not in seen_ids:
                seen_ids.add(user.id)
                dept_name = user.profile.department.name if hasattr(user, 'profile') and user.profile and user.profile.department else "General"
                full_name = user.profile.full_name if hasattr(user, 'profile') and user.profile and user.profile.full_name else user.email
                members.append({
                    'id': user.id,
                    'email': user.email,
                    'full_name': full_name,
                    'department_name': dept_name
                })
        return members

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

        if initial_team_ids:
            User = get_user_model()
            employees = User.objects.filter(id__in=initial_team_ids, is_active=True, role__code='EMPLOYEE')
            for emp in employees:
                Task.objects.create(
                    job=job,
                    assignee=emp,
                    creator=job.manager,
                    title=f"Project Onboarding: {job.job_name}",
                    description=f"Initial assignment by Admin for project {job.job_name}.",
                    priority=Task.Priority.MEDIUM,
                    status=Task.Status.TODO,
                    deadline=job.deadline,
                    order_index="0|000000:"
                )

        return job

    def update(self, instance, validated_data):
        initial_team_ids = validated_data.pop('initial_team_member_ids', None)
        job = super().update(instance, validated_data)

        if initial_team_ids is not None:
            User = get_user_model()
            existing_assignee_ids = set(job.tasks.values_list('assignee_id', flat=True).distinct())
            new_member_ids = [uid for uid in initial_team_ids if uid not in existing_assignee_ids]
            if new_member_ids:
                employees = User.objects.filter(id__in=new_member_ids, is_active=True, role__code='EMPLOYEE')
                for emp in employees:
                    Task.objects.create(
                        job=job,
                        assignee=emp,
                        creator=job.manager,
                        title=f"Project Onboarding: {job.job_name}",
                        description=f"Added to project team by Admin for {job.job_name}.",
                        priority=Task.Priority.MEDIUM,
                        status=Task.Status.TODO,
                        deadline=job.deadline,
                        order_index="0|000000:"
                    )

        return job

