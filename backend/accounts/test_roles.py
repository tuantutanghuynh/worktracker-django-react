import pytest


# Kiểm thử API Role tại /api/auth/roles/ (chỉ đọc — dùng để đổ dropdown
# chọn role lúc tạo/sửa user; hệ thống chỉ có đúng 3 role hard-code)
@pytest.mark.django_db
class TestRoleAPI:

    # GET danh sách roles → expect 200 và có ít nhất 1 role
    def test_list_roles(self, auth_client, admin_role):
        response = auth_client.get('/api/auth/roles/')
        assert response.status_code == 200
        assert len(response.data) >= 1

    # GET chi tiết 1 role → expect 200 và trả đúng code
    def test_retrieve_role(self, auth_client, admin_role):
        response = auth_client.get(f'/api/auth/roles/{admin_role.id}/')
        assert response.status_code == 200
        assert response.data['code'] == 'ADMIN'

    # POST tạo role → expect 405 (ReadOnlyModelViewSet)
    def test_create_role_not_allowed(self, auth_client):
        response = auth_client.post('/api/auth/roles/', {'code': 'SUPERVISOR', 'name': 'Supervisor'})
        assert response.status_code == 405

    # PATCH sửa role → expect 405 (ReadOnlyModelViewSet)
    def test_update_role_not_allowed(self, auth_client, admin_role):
        response = auth_client.patch(f'/api/auth/roles/{admin_role.id}/', {'name': 'Renamed'})
        assert response.status_code == 405
        admin_role.refresh_from_db()
        assert admin_role.name == 'Admin'

    # DELETE role → expect 405 (ReadOnlyModelViewSet)
    def test_delete_role_not_allowed(self, auth_client, admin_role):
        response = auth_client.delete(f'/api/auth/roles/{admin_role.id}/')
        assert response.status_code == 405

    # Endpoint permissions đã bị gỡ bỏ hoàn toàn → expect 404
    def test_permissions_endpoint_removed(self, auth_client):
        response = auth_client.get('/api/auth/permissions/')
        assert response.status_code == 404

    # Endpoint assign-permissions đã bị gỡ bỏ hoàn toàn → expect 404
    def test_assign_permissions_removed(self, auth_client, admin_role):
        before = admin_role.role_permissions.count()
        response = auth_client.post(
            f'/api/auth/roles/{admin_role.id}/assign-permissions/',
            {'permission_ids': []},
            format='json',
        )
        assert response.status_code == 404
        assert admin_role.role_permissions.count() == before
