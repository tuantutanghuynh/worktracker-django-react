from rest_framework import serializers
from ..models import Role, CustomUser, Department, EmployeeProfile


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'is_active']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = EmployeeProfile
        fields = ['full_name', 'phone_number', 'department', 'department_name', 'avatar_url', 'joined_date']


class UserSerializer(serializers.ModelSerializer):
    profile = EmployeeProfileSerializer(read_only=True)
    role_detail = RoleSerializer(source='role', read_only=True)
    workload = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'role', 'role_detail', 'is_active', 'profile', 'workload']
        extra_kwargs = {'role': {'write_only': True}}

    def get_workload(self, obj):
        role_code = getattr(getattr(obj, 'role', None), 'code', None)
        if role_code != 'EMPLOYEE':
            return None
        from timesheets.services.manager_employee_utilization_service import calculate_smart_workload_pressure
        return calculate_smart_workload_pressure(obj)


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
