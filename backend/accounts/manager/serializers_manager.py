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
    Serializer đọc thông tin nhân viên kèm profile và chỉ số Workload / Utilization Rate.
    Dùng cho API danh sách nhân viên theo scope.
    """
    full_name = serializers.CharField(source="profile.full_name", read_only=True)
    phone_number = serializers.CharField(source="profile.phone_number", read_only=True)
    department = ManagerDepartmentMiniSerializer(source="profile.department", read_only=True)
    avatar_url = serializers.CharField(source="profile.avatar_url", read_only=True)
    joined_date = serializers.DateField(source="profile.joined_date", read_only=True)

    # ➕ Các trường tính toán động (Computed Fields) từ Service & Annotation
    active_tasks_count = serializers.IntegerField(read_only=True, default=0)
    logged_hours = serializers.SerializerMethodField()
    capacity_hours = serializers.SerializerMethodField()
    utilization_rate = serializers.SerializerMethodField()
    workload_status = serializers.SerializerMethodField()

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
            "joined_date",
            "active_tasks_count",
            "logged_hours",
            "capacity_hours",
            "utilization_rate",
            "workload_status",
        ]

    def _get_workload_info(self, obj):
        """Hàm trợ giúp lấy dict chứa chỉ số workload của user từ context"""
        workload_map = self.context.get("workload_map", {})
        return workload_map.get(obj.id, {})

    def get_logged_hours(self, obj):
        return self._get_workload_info(obj).get("logged_hours", 0.0)

    def get_capacity_hours(self, obj):
        return self._get_workload_info(obj).get("capacity_hours", 0.0)

    def get_utilization_rate(self, obj):
        return self._get_workload_info(obj).get("utilization_rate", 0.0)

    def get_workload_status(self, obj):
        return self._get_workload_info(obj).get("workload_status", "Normal")