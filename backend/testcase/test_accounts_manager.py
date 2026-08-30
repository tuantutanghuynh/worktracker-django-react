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
# Test 2: Đổi phòng ban / đổi Manager là việc của Admin
# ============================================================
#
# Bộ test cũ ở đây kiểm tra endpoint
#   PATCH /api/manager/accounts/employees/{id}/department/
# nhưng endpoint đó chưa bao giờ tồn tại — urls_manager.py chỉ có 2 route
# đọc. Test được viết trước, code không theo, nên 2 test luôn fail với 404.
#
# Quyết định nghiệp vụ: KHÔNG xây endpoint đó. Cơ cấu tổ chức (phòng ban,
# tuyến báo cáo) thuộc quyền Admin, không phải quản lý dự án — giống Jira
# hay Asana, nơi PM phân việc chứ không đổi được phòng ban của người khác.
#
# Đường đi đúng đã có sẵn và đã được phủ test:
#   PATCH /api/auth/users/{id}/assign-department/  (accounts/test_users.py)
#   PATCH /api/auth/users/{id}/assign-manager/     (accounts/test_manager_scope.py)
#
# Test dưới đây chốt lại chính quyết định trên: Manager gọi vào endpoint
# Admin thì phải bị từ chối.
@pytest.mark.django_db
class TestManagerKhongDoiDuocCoCauToChuc:

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        perm_view = baker.make("accounts.Permission", code="team:view")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm_view)

        self.manager = baker.make(
            "accounts.CustomUser",
            role=self.role_manager,
            is_active=True,
            must_change_password=False,
        )
        self.employee = baker.make(
            "accounts.CustomUser",
            role=self.role_employee,
            is_active=True,
            must_change_password=False,
        )
        self.dept_new = baker.make("accounts.Department", name="Phòng Kỹ thuật")

    def test_manager_khong_doi_duoc_phong_ban(self):
        """IsAdminRole chặn Manager ở endpoint đổi phòng ban."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.patch(
            f"/api/auth/users/{self.employee.id}/assign-department/",
            {"department": self.dept_new.id},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_manager_khong_doi_duoc_tuyen_bao_cao(self):
        """
        Quan trọng hơn cả đổi phòng ban: nếu Manager tự gán được nhân viên
        cho mình thì toàn bộ cơ chế giới hạn phạm vi trở nên vô nghĩa.
        """
        self.client.force_authenticate(user=self.manager)
        response = self.client.patch(
            f"/api/auth/users/{self.employee.id}/assign-manager/",
            {"manager": self.manager.id},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
