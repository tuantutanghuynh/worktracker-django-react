import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient
from model_bakery import baker
from system.security.permissions_manager import MANAGER_ROLE_CODE


def get_results(response_data):
    if isinstance(response_data, list):
        return response_data
    return response_data.get("results", response_data)


# ============================================================
# Test 1: Danh sách nhân viên
# ============================================================
@pytest.mark.django_db
class TestManagerEmployeeList:
    """
    Kiểm thử API danh sách nhân viên của Manager.
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        perm = baker.make("accounts.Permission", code="team:view")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

        self.manager = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        # Tạo profile cho employee (bắt buộc vì view dùng select_related profile)
        baker.make("accounts.EmployeeProfile", user=self.employee, full_name="Nguyễn Văn A")

        self.url = "/api/manager/accounts/employees/"

    def test_manager_can_list_employees(self):
        """Manager gọi API danh sách nhân viên -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK

    def test_employee_cannot_access_employee_list_api(self):
        """Employee gọi API danh sách nhân viên (của Manager) -> 403 Forbidden."""
        self.client.force_authenticate(user=self.employee)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ============================================================
# Test 2: Đổi phòng ban nhân viên
# ============================================================
@pytest.mark.django_db
class TestManagerDepartmentUpdate:
    """
    Kiểm thử API đổi phòng ban nhân viên của Manager.
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        perm_view = baker.make("accounts.Permission", code="team:view")
        perm_assign = baker.make("accounts.Permission", code="team:assign_department")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm_view)
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm_assign)

        self.manager = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        # Tạo profile cho employee
        self.profile = baker.make(
            "accounts.EmployeeProfile",
            user=self.employee,
            full_name="Trần Thị B",
            department=None,
        )

        # Tạo 2 phòng ban
        self.dept_new = baker.make("accounts.Department", name="Phòng Kỹ thuật")

        self.url = f"/api/manager/accounts/employees/{self.employee.id}/department/"

    def test_update_employee_department_success(self):
        """Manager đổi phòng ban của Employee -> 200 OK, department_id được cập nhật."""
        self.client.force_authenticate(user=self.manager)
        payload = {"department_id": self.dept_new.id}
        response = self.client.patch(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["department_id"] == self.dept_new.id

        # Xác nhận DB đã thay đổi
        self.profile.refresh_from_db()
        assert self.profile.department_id == self.dept_new.id

    def test_manager_without_permission_cannot_assign_department(self):
        """Manager không có quyền team:assign_department -> 403 Forbidden."""
        # Tạo một Manager không có quyền assign
        role_manager_no_perm = baker.make("accounts.Role", code="MANAGER_NO_PERM")
        # Chỉ cấp team:view, không cấp team:assign_department
        perm_view = baker.make("accounts.Permission", code="team:view_v2")
        baker.make("accounts.RolePermission", role=role_manager_no_perm, permission=perm_view)

        manager_no_perm = baker.make(
            "accounts.CustomUser", role=role_manager_no_perm, is_active=True
        )
        self.client.force_authenticate(user=manager_no_perm)
        payload = {"department_id": self.dept_new.id}
        response = self.client.patch(self.url, payload, format="json")

        # Không có IsManagerRole nên bị 403
        assert response.status_code == status.HTTP_403_FORBIDDEN
