from rest_framework import serializers

from accounts.models import CustomUser, Department, EmployeeProfile


# ============================================================
# Serializer hỗ trợ hiển thị danh sách nhân viên trong scope Manager
# ============================================================
class ManagerDepartmentMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]


class ManagerEmployeeListSerializer(serializers.ModelSerializer):
    """
    Serializer đọc thông tin nhân viên kèm profile.
    Dùng cho API danh sách nhân viên theo scope.
    """
    full_name = serializers.CharField(source="profile.full_name", read_only=True)
    phone_number = serializers.CharField(source="profile.phone_number", read_only=True)
    department = ManagerDepartmentMiniSerializer(source="profile.department", read_only=True)
    avatar_url = serializers.CharField(source="profile.avatar_url", read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "is_active",
            "full_name",
            "phone_number",
            "department",
            "avatar_url",
        ]


# ============================================================
# Serializer để đổi phòng ban (P3.6)
# Chỉ nhận department_id — không được sửa accounts/models.py
# ============================================================
class ManagerDepartmentAssignSerializer(serializers.Serializer):
    """
    Nhận department_id để gán/đổi phòng ban cho nhân viên.
    Truyền null để bỏ phòng ban.
    """
    department_id = serializers.IntegerField(
        allow_null=True,
        help_text="ID của phòng ban muốn gán. Null để bỏ phòng ban.",
    )

    def validate_department_id(self, value):
        if value is None:
            return None

        if not Department.objects.filter(pk=value).exists():
            raise serializers.ValidationError(
                f"Department với ID={value} không tồn tại."
            )

        return value
