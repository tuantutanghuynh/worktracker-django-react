"""
Module: accounts.admin.serializers
Description: Admin serializers for managing roles, user accounts, departments, and profile assignments.
"""

from rest_framework import serializers
from ..models import Role, CustomUser, Department, EmployeeProfile


class RoleSerializer(serializers.ModelSerializer):
    """Serializer representing system roles and active status."""

    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'is_active']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    """Serializer representing employee profile details with manager relationships."""

    manager_email = serializers.EmailField(source='manager.email', read_only=True, default=None)
    manager_is_active = serializers.BooleanField(source='manager.is_active', read_only=True, default=None)

    class Meta:
        model = EmployeeProfile
        fields = [
            'full_name', 'phone_number', 'department', 'avatar_url', 'joined_date',
            'manager', 'manager_email', 'manager_is_active',
        ]


def normalize_email(value, instance=None):
    """Normalize email to lowercase and ensure uniqueness across active and inactive accounts."""
    email = (value or "").strip().lower()
    if not email:
        raise serializers.ValidationError("Email is required.")

    duplicates = CustomUser.objects.filter(email__iexact=email)
    if instance is not None:
        duplicates = duplicates.exclude(pk=instance.pk)
    existing = duplicates.first()
    if existing is not None:
        status_suffix = "" if existing.is_active else " (deactivated)"
        raise serializers.ValidationError(
            f"An account with the email '{existing.email}'{status_suffix} already exists. "
            f"Email addresses are case-insensitive, so '{value}' is the same account."
        )
    return email


class UserSerializer(serializers.ModelSerializer):
    """Serializer for displaying and updating existing user account details."""

    profile = EmployeeProfileSerializer(read_only=True)
    role_detail = RoleSerializer(source='role', read_only=True)
    email = serializers.EmailField(max_length=155, validators=[])

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'role', 'role_detail', 'is_active', 'profile']
        extra_kwargs = {'role': {'write_only': True}}

    def validate_email(self, value):
        """Validate normalized email uniqueness excluding the current user instance."""
        return normalize_email(value, instance=self.instance)


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for provisioning new user accounts with department and manager associations."""

    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(max_length=155, validators=[])
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True, write_only=True
    )
    manager = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role__code='MANAGER', is_active=True),
        required=False, allow_null=True, write_only=True
    )

    class Meta:
        model = CustomUser
        fields = ['email', 'password', 'role', 'is_active', 'department', 'manager']

    def validate_email(self, value):
        """Validate normalized email uniqueness for new account provisioning."""
        return normalize_email(value)

    def validate(self, attrs):
        """Ensure manager assignments are only permitted for employee role accounts."""
        manager = attrs.get('manager')
        role = attrs.get('role')
        if manager and role and getattr(role, 'code', None) != 'EMPLOYEE':
            raise serializers.ValidationError(
                {'manager': 'Only EMPLOYEE accounts can have an assigned Manager.'}
            )
        return attrs

    def create(self, validated_data):
        """Create new user entity and initialize associated EmployeeProfile record."""
        password = validated_data.pop('password')
        department = validated_data.pop('department', None)
        manager = validated_data.pop('manager', None)
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        EmployeeProfile.objects.create(
            user=user, full_name=user.email, department=department, manager=manager
        )
        return user


class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer for managing organizational department entities."""

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'manager', 'created_at']
