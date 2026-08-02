import pytest
from accounts.models import Role, Permission, RolePermission


# Kiểm thử API quản lý Role tại /api/auth/roles/
@pytest.mark.django_db
class TestRoleAPI:

    # GET danh sách roles → expect 200 và có ít nhất 1 role
    def test_list_roles(self, auth_client, admin_role):
        response = auth_client.get('/api/auth/roles/')
        assert response.status_code == 200
        assert len(response.data) >= 1

    # POST tạo role mới → expect 201 và role xuất hiện trong DB
    def test_create_role(self, auth_client):
        response = auth_client.post('/api/auth/roles/', {'code': 'MANAGER', 'name': 'Manager'})
        assert response.status_code == 201
        assert Role.objects.filter(code='MANAGER').exists()

    # PATCH cập nhật tên role → expect 200 và tên thay đổi trong DB
    def test_update_role(self, auth_client, admin_role):
        response = auth_client.patch(f'/api/auth/roles/{admin_role.id}/', {'name': 'Admin Updated'})
        assert response.status_code == 200
        admin_role.refresh_from_db()
        assert admin_role.name == 'Admin Updated'

    # POST với code đã tồn tại → expect 400 (unique constraint)
    def test_duplicate_role_code_rejected(self, auth_client, admin_role):
        # admin_role đã có code='ADMIN', tạo lại phải bị reject
        response = auth_client.post('/api/auth/roles/', {'code': 'ADMIN', 'name': 'Dup'})
        assert response.status_code == 400

    # POST assign-permissions → expect 200 và role chỉ còn đúng 2 permission được set
    # bulk_create thay thế toàn bộ — xóa hết permission cũ rồi tạo lại từ đầu
    def test_assign_permissions(self, auth_client, admin_role):
        p1 = Permission.objects.get(code='client:create')
        p2 = Permission.objects.get(code='job:create')
        response = auth_client.post(
            f'/api/auth/roles/{admin_role.id}/assign-permissions/',
            {'permission_ids': [p1.id, p2.id]},
            format='json',
        )
        assert response.status_code == 200
        assert admin_role.role_permissions.count() == 2

    # POST assign-permissions → expect AuditLog được tạo với action=ASSIGN_ROLE
    def test_assign_permissions_creates_audit_log(self, auth_client, admin_role):
        from system.models import AuditLog
        p1 = Permission.objects.get(code='client:create')
        auth_client.post(
            f'/api/auth/roles/{admin_role.id}/assign-permissions/',
            {'permission_ids': [p1.id]},
            format='json',
        )
        assert AuditLog.objects.filter(
            action='ASSIGN_ROLE', table_name='role_permissions', record_id=admin_role.id
        ).exists()


# Kiểm thử API danh sách Permission tại /api/auth/permissions/ (read-only)
@pytest.mark.django_db
class TestPermissionAPI:

    # GET danh sách → expect 200 và có đủ 14 permissions từ admin_role fixture
    def test_list_permissions(self, auth_client, admin_role):
        # admin_role fixture đã tạo 14 permissions trong DB
        response = auth_client.get('/api/auth/permissions/')
        assert response.status_code == 200
        assert len(response.data) >= 14

    # POST → expect 405 Method Not Allowed (PermissionViewSet là ReadOnly)
    def test_permission_readonly(self, auth_client):
        # PermissionViewSet là ReadOnly — POST phải bị reject 405
        response = auth_client.post('/api/auth/permissions/', {'code': 'test:code', 'name': 'Test'})
        assert response.status_code == 405
