import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient
from model_bakery import baker
from system.security.permissions_manager import MANAGER_ROLE_CODE


# ============================================================
# Helper: tạo role + user + cấp quyền nhanh
# ============================================================
def make_manager(role, *permission_codes):
    """Tạo Manager user và cấp các quyền cho role."""
    user = baker.make("accounts.CustomUser", role=role, is_active=True)
    for code in permission_codes:
        perm = baker.make("accounts.Permission", code=code)
        baker.make("accounts.RolePermission", role=role, permission=perm)
    return user


# ============================================================
# Test 1: Phân quyền truy cập API Manager
# ============================================================
@pytest.mark.django_db
class TestManagerAuthorization:
    """
    Kiểm thử xem hệ thống có chặn đúng người không.
    Chỉ Manager mới được phép truy cập API của Manager.
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        self.manager_user = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.employee_user = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        self.url = "/api/manager/system/notifications/"

        perm = baker.make("accounts.Permission", code="notification:view")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

    def test_employee_cannot_access_manager_api(self):
        """Employee truy cập API Manager -> 403 Forbidden"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_manager_can_access_manager_api(self):
        """Manager truy cập API Manager -> 200 OK"""
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK

    def test_unauthenticated_user_cannot_access(self):
        """Người chưa đăng nhập truy cập API -> 401 Unauthorized"""
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================
# Test 2: Notification — Manager chỉ xem thông báo của mình
# ============================================================
@pytest.mark.django_db
class TestManagerNotification:
    """
    Kiểm thử API Notification của Manager.
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        perm = baker.make("accounts.Permission", code="notification:view")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

        self.manager_A = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )

        # Tạo 2 thông báo: 1 của Manager A, 1 của Manager B
        self.notif_A = baker.make("system.Notification", user=self.manager_A, is_read=False)
        self.notif_B = baker.make("system.Notification", user=self.manager_B, is_read=False)

        self.list_url = "/api/manager/system/notifications/"
        self.mark_all_url = "/api/manager/system/notifications/mark-all-read/"

    def test_manager_only_sees_own_notifications(self):
        """Manager A chỉ thấy thông báo của mình, không thấy của Manager B."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.get(self.list_url)

        assert response.status_code == status.HTTP_200_OK

        results = response.data if isinstance(response.data, list) else response.data.get("results", [])
        notif_ids = [item["id"] for item in results]

        assert self.notif_A.id in notif_ids
        assert self.notif_B.id not in notif_ids

    def test_mark_single_notification_as_read(self):
        """Manager đánh dấu 1 thông báo đã đọc -> 200 OK."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/system/notifications/{self.notif_A.id}/mark-read/"
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK

        # Reload từ DB để chắc chắn đã thay đổi
        self.notif_A.refresh_from_db()
        assert self.notif_A.is_read is True

    def test_mark_all_notifications_as_read(self):
        """Manager đánh dấu tất cả thông báo đã đọc -> 200 OK."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.post(self.mark_all_url)
        assert response.status_code == status.HTTP_200_OK

        # Thông báo của Manager A phải được đánh dấu đã đọc
        self.notif_A.refresh_from_db()
        assert self.notif_A.is_read is True

        # Thông báo của Manager B KHÔNG được chạm vào
        self.notif_B.refresh_from_db()
        assert self.notif_B.is_read is False


# ============================================================
# Test 3: AuditLog — Manager đọc được lịch sử hoạt động
# ============================================================
@pytest.mark.django_db
class TestManagerAuditLog:
    """
    Kiểm thử API AuditLog của Manager.
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        perm = baker.make("accounts.Permission", code="report:view")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

        self.manager = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )

        # Tạo 1 AuditLog gắn với Manager này
        baker.make("system.AuditLog", user=self.manager)

        self.url = "/api/manager/system/audit-logs/"

    def test_manager_can_view_audit_logs(self):
        """Manager gọi API audit-logs -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK