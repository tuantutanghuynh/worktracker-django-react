"""
Module: accounts.employee.serializers_employee
Description: Employee serializers for profile view/update, avatar uploads, and KPI queries.
"""

from rest_framework import serializers

from accounts.models import EmployeeProfile


class EmployeeProfileSerializer(serializers.ModelSerializer):
    """Serializer representing an employee's personal profile information."""

    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.CharField(source="user.role.name", read_only=True)
    department = serializers.SlugRelatedField(slug_field="name", read_only=True)
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = ["email", "role", "full_name", "phone_number", "department", "manager_name", "avatar_url", "joined_date", "updated_at"]
        read_only_fields = ["email", "role", "department", "manager_name", "avatar_url", "joined_date", "updated_at"]

    def get_manager_name(self, obj):
        """Retrieve full name of the department manager."""
        manager = obj.department.manager if obj.department else None
        if not manager:
            return None
        profile = getattr(manager, "profile", None)
        return profile.full_name if profile else None


class AvatarUploadSerializer(serializers.Serializer):
    """Serializer validating avatar image upload file size and format."""

    avatar = serializers.ImageField()

    def validate_avatar(self, value):
        """Validate that avatar image file does not exceed maximum allowable size (2MB)."""
        max_size = 2 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("Avatar file must be 2MB or smaller.")
        return value


class PersonalKPIQuerySerializer(serializers.Serializer):
    """Serializer validating date range query parameters for personal KPI metrics."""

    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
