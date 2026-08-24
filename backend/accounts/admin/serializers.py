from rest_framework import serializers
from ..models import Role, Permission, CustomUser, Department, EmployeeProfile


class RoleSerializer(serializers.ModelSerializer):
    # Currently-assigned permission ids — lets the Roles & Permissions page
    # pre-check the right boxes on GET without a second request.
    permission_ids = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'is_active', 'permission_ids']

    def get_permission_ids(self, obj):
        return list(obj.role_permissions.values_list('permission_id', flat=True))


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
    # Not a CustomUser field — EmployeeProfile.department is what actually
    # holds this, so it's declared explicitly and popped off before the
    # CustomUser is built.
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True, write_only=True
    )

    class Meta:
        model = CustomUser
        fields = ['email', 'password', 'role', 'is_active', 'department']

    def create(self, validated_data):
        password = validated_data.pop('password')
        department = validated_data.pop('department', None)
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        EmployeeProfile.objects.create(user=user, full_name=user.email, department=department)
        return user


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'manager', 'created_at']
