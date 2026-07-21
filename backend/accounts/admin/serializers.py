from rest_framework import serializers
from ..models import Role, Permission, CustomUser, Department, EmployeeProfile


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'is_active']


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeProfile
        fields = ['full_name', 'phone_number', 'department', 'avatar_url', 'joined_date']


class UserSerializer(serializers.ModelSerializer):
    profile = EmployeeProfileSerializer(read_only=True)
    role_detail = RoleSerializer(source='role', read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'role', 'role_detail', 'is_active', 'profile']
        extra_kwargs = {'role': {'write_only': True}}


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['email', 'password', 'role', 'is_active']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        return user


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'manager', 'created_at']
