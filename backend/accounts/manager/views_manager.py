from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser, EmployeeProfile
from accounts.manager.serializers_manager import (
    ManagerDepartmentAssignSerializer,
    ManagerEmployeeListSerializer,
)
from system.security.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
from system.services.audit_manager_service import snapshot, log_action


class ManagerTeamEmployeeListView(ListAPIView):
    """
    GET /api/manager/accounts/employees/

    Trả về danh sách nhân viên có role EMPLOYEE.
    Manager dùng để tìm người để giao task.

    Query Params:
        - department_id (optional): Lọc theo phòng ban.
        - search (optional): Tìm theo email hoặc họ tên.
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "team:view"

    serializer_class = ManagerEmployeeListSerializer

    def get_queryset(self):
        qs = (
            CustomUser.objects.filter(
                role__code="EMPLOYEE",
                is_active=True,
            )
            .select_related("profile", "profile__department", "role")
            .order_by("profile__full_name")
        )

        department_id = self.request.query_params.get("department_id")
        if department_id:
            qs = qs.filter(profile__department_id=department_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                email__icontains=search
            ) | qs.filter(
                profile__full_name__icontains=search
            )

        return qs


class ManagerEmployeeDepartmentUpdateView(APIView):
    """
    PATCH /api/manager/accounts/employees/{user_id}/department/

    Đổi phòng ban (department) cho một nhân viên.
    Không sửa accounts/models.py — chỉ cập nhật employee_profiles.department_id.

    Body:
        {
            "department_id": 3   // null để xóa khỏi phòng ban
        }

    Ghi Audit Log sau mỗi lần đổi phòng ban.
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "team:assign_department"

    def patch(self, request, user_id):
        # Tìm nhân viên — chỉ cho phép sửa EMPLOYEE, không sửa MANAGER/ADMIN
        try:
            profile = (
                EmployeeProfile.objects.select_related("user", "department")
                .get(user_id=user_id, user__role__code="EMPLOYEE")
            )
        except EmployeeProfile.DoesNotExist:
            raise NotFound(f"Không tìm thấy nhân viên với ID={user_id}.")

        serializer = ManagerDepartmentAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_department_id = serializer.validated_data["department_id"]

        # Lưu snapshot trước khi sửa
        old_values = {
            "department_id": profile.department_id,
            "department_name": profile.department.name if profile.department else None,
        }

        profile.department_id = new_department_id
        profile.save(update_fields=["department_id", "updated_at"])

        new_values = {
            "department_id": new_department_id,
        }

        log_action(
            user=request.user,
            action="ASSIGN_DEPARTMENT",
            table_name="employee_profiles",
            record_id=user_id,
            old_values=old_values,
            new_values=new_values,
            request=request,
        )

        return Response(
            {
                "user_id": user_id,
                "department_id": new_department_id,
                "message": "Cập nhật phòng ban thành công.",
            },
            status=status.HTTP_200_OK,
        )
