"""
Module: projects.admin.serializers
Description: Admin serializers for managing client organizations and master project jobs.
"""

import re

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import serializers
from ..models import Client, Job
from tasks.models import Task


# Vietnamese tax code: 10 digits for the head office, optionally followed by
# a 3-digit branch suffix. Every real client in the system already matches
# this; without the check "abcxyz" and "123" were both accepted.
TAX_CODE_PATTERN = re.compile(r"^\d{10}(-\d{3})?$")

# Phone numbers arrive in many shapes (+84 902 000 002, 0902-000-002,
# (028) 3822 1234). Rather than pin one layout, allow the punctuation people
# actually type and require a plausible number of digits underneath.
PHONE_ALLOWED_CHARS = re.compile(r"^[0-9+()\-.\s]+$")
PHONE_MIN_DIGITS = 8
PHONE_MAX_DIGITS = 15


def validate_phone_format(value, field_label="Phone number"):
    """Reject phone values that are not plausibly a phone number."""
    phone = (value or "").strip()
    if not phone:
        return phone

    if not PHONE_ALLOWED_CHARS.match(phone):
        raise serializers.ValidationError(
            f"{field_label} may only contain digits and the characters + ( ) - . and spaces."
        )

    digits = re.sub(r"\D", "", phone)
    if not (PHONE_MIN_DIGITS <= len(digits) <= PHONE_MAX_DIGITS):
        raise serializers.ValidationError(
            f"{field_label} must contain between {PHONE_MIN_DIGITS} and "
            f"{PHONE_MAX_DIGITS} digits (found {len(digits)})."
        )
    return phone


class ClientSerializer(serializers.ModelSerializer):
    """Serializer managing client organization profiles and unique tax code validation."""

    tax_code = serializers.CharField(max_length=50, validators=[])

    class Meta:
        model = Client
        fields = '__all__'

    def _exclude_self(self, queryset):
        """Exclude current instance from uniqueness check during update operations."""
        if self.instance is not None:
            return queryset.exclude(pk=self.instance.pk)
        return queryset

    def validate_client_name(self, value):
        """Validate case-insensitive client name uniqueness across active and deactivated records."""
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Client name is required.")

        duplicate = (
            self._exclude_self(Client.objects.filter(client_name__iexact=name))
            .order_by("-is_active", "id")
            .first()
        )
        if duplicate is not None:
            if not duplicate.is_active:
                raise serializers.ValidationError(
                    f"A deactivated client named '{duplicate.client_name}' already exists "
                    f"(tax code {duplicate.tax_code}). Reactivate that client instead of "
                    f"creating a duplicate."
                )
            raise serializers.ValidationError(
                f"A client named '{duplicate.client_name}' already exists "
                f"(tax code {duplicate.tax_code}). Client names must be unique."
            )
        return name

    def validate_contact_phone(self, value):
        """Reject contact phone values that are not plausibly a phone number."""
        return validate_phone_format(value, "Contact phone")

    def validate_tax_code(self, value):
        """Validate case-insensitive tax code uniqueness across active and deactivated records."""
        code = (value or "").strip()
        if code and not TAX_CODE_PATTERN.match(code):
            raise serializers.ValidationError(
                "Tax code must be 10 digits, optionally followed by a 3-digit "
                "branch suffix (e.g. 0123456789 or 0123456789-001)."
            )
        if not code:
            raise serializers.ValidationError("Tax code is required.")

        duplicate = (
            self._exclude_self(Client.objects.filter(tax_code__iexact=code))
            .order_by("-is_active", "id")
            .first()
        )
        if duplicate is not None:
            status_suffix = "" if duplicate.is_active else " (deactivated)"
            raise serializers.ValidationError(
                f"Tax code '{code}' is already used by '{duplicate.client_name}'{status_suffix}. "
                f"A tax code identifies one single company - check the code again, or "
                f"update the existing client instead."
            )
        return code


class JobSerializer(serializers.ModelSerializer):
    """Serializer managing administrative project jobs, assigned managers, and chat channels."""

    project_team = serializers.SerializerMethodField(read_only=True)
    team_size = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Job
        fields = '__all__'

    def get_team_size(self, obj):
        """Calculate total count of unique team assignees and chat participants."""
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
        """Return serialized list of team members engaged in job tasks or channels."""
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
        """Ensure assigned client account is active."""
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign job to an inactive client.")
        return value

    def validate_manager(self, value):
        """Ensure assigned project manager is active and holds appropriate role."""
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
        """Validate permissible job status state transitions."""
        if self.instance:
            current = self.instance.status
            allowed = self.ALLOWED_TRANSITIONS.get(current, [])
            if value != current and value not in allowed:
                raise serializers.ValidationError(
                    f"Cannot transition from '{current}' to '{value}'."
                )
        return value
        
    def validate(self, data):
        """Validate date chronology between project start date and deadline."""
        start_date = data.get('start_date', self.instance.start_date if self.instance else None)
        deadline = data.get('deadline', self.instance.deadline if self.instance else None)
        today = timezone.localdate()

        if not self.instance and deadline and deadline < today:
            raise serializers.ValidationError({'deadline': f'Deadline cannot be in the past (must be on or after {today}).'})

        if start_date and deadline and deadline < start_date:
            raise serializers.ValidationError({'deadline': 'Deadline must be on or after start date.'})
        return data

    def create(self, validated_data):
        """Create job instance and initialize corresponding project chat room."""
        job = super().create(validated_data)

        from chat.models import ChatRoom, ChatParticipant
        room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
        room, _ = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.JOB,
            job=job,
            defaults={"name": room_name},
        )
        if job.manager:
            ChatParticipant.objects.get_or_create(room=room, user=job.manager)

        return job

    def update(self, instance, validated_data):
        """Update job instance and ensure corresponding project chat room exists."""
        job = super().update(instance, validated_data)

        from chat.models import ChatRoom, ChatParticipant
        room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
        room, _ = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.JOB,
            job=job,
            defaults={"name": room_name},
        )
        if job.manager:
            ChatParticipant.objects.get_or_create(room=room, user=job.manager)

        return job
