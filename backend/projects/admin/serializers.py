from django.utils import timezone
from rest_framework import serializers
from ..models import Client, Job


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = '__all__'

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

