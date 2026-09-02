from rest_framework import serializers
from ..models import Role, CustomUser, Department, EmployeeProfile


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'is_active']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    # Email của Manager phụ trách — trả kèm để User List hiện được tên người
    # quản lý mà không phải gọi thêm một request tra cứu cho từng dòng.
    manager_email = serializers.EmailField(source='manager.email', read_only=True, default=None)
    # Khoá tài khoản Manager KHÔNG gỡ tuyến báo cáo — khoá là thao tác đảo
    # ngược được, gỡ đi thì mở khoá lại không khôi phục nổi. Đổi lại phải cho
    # Admin thấy được trạng thái này: nhân viên vẫn trỏ tới một Manager không
    # đăng nhập được, tức là trên thực tế đang không ai quản lý.
    manager_is_active = serializers.BooleanField(source='manager.is_active', read_only=True, default=None)

    class Meta:
        model = EmployeeProfile
        fields = [
            'full_name', 'phone_number', 'department', 'avatar_url', 'joined_date',
            'manager', 'manager_email', 'manager_is_active',
        ]


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
    # Cũng không phải field của CustomUser — EmployeeProfile.manager mới là nơi
    # lưu. Gán ngay lúc tạo là quan trọng: nhân viên không có Manager sẽ không
    # Manager nào nhìn thấy và không ai giao việc được, tức là tài khoản vừa
    # tạo xong đã không dùng được.
    manager = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role__code='MANAGER', is_active=True),
        required=False, allow_null=True, write_only=True
    )

    class Meta:
        model = CustomUser
        fields = ['email', 'password', 'role', 'is_active', 'department', 'manager']

    def validate(self, attrs):
        manager = attrs.get('manager')
        role = attrs.get('role')
        # Chỉ EMPLOYEE mới có tuyến báo cáo. Chặn ở đây thay vì bỏ qua im lặng
        # để Admin biết ngay là mình chọn nhầm.
        if manager and role and getattr(role, 'code', None) != 'EMPLOYEE':
            raise serializers.ValidationError(
                {'manager': 'Only EMPLOYEE accounts can have an assigned Manager.'}
            )
        return attrs

    def create(self, validated_data):
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
    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'manager', 'created_at']
