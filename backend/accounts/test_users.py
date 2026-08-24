import pytest
from accounts.models import CustomUser, Department

# Kiểm thử API quản lý User tại /api/auth/users/
# admin_user fixture tạo sẵn user admin@test.com trong DB trước mỗi test
@pytest.mark.django_db
class TestUserAPI:

    # GET danh sách → expect 200 và có ít nhất 1 user (admin_user từ fixture)
    # /api/auth/users/ có pagination (AdminPageNumberPagination) nên response.data
    # là {count, next, previous, results}, không phải list — phải đọc ['results'].
    def test_list_users(self, auth_client, admin_user):
        response = auth_client.get('/api/auth/users/')
        assert response.status_code == 200
        assert len(response.data['results']) >= 1

    # POST tạo user mới → expect 201 và user xuất hiện trong DB
    def test_create_user(self, auth_client, admin_role):
        data = {
            'email': 'newuser@test.com',
            'password': 'Test@1234',
            'role': admin_role.id,
        }
        response = auth_client.post('/api/auth/users/', data)
        assert response.status_code == 201
        assert CustomUser.objects.filter(email='newuser@test.com').exists()

    # GET ?email=admin@test → expect 1 user khớp (filter dùng icontains, không cần gõ đủ email)
    def test_filter_by_email(self, auth_client, admin_user):
        response = auth_client.get('/api/auth/users/?email=admin@test')
        assert response.status_code == 200
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['email'] == 'admin@test.com'

    # PATCH lock → expect 200 và is_active chuyển False
    def test_lock_user(self, auth_client, admin_user, admin_role):
        target = CustomUser.objects.create_user(
            email='target@test.com', password='Test@1234',
            role=admin_role, is_active=True
        )
        response = auth_client.patch(f'/api/auth/users/{target.id}/lock/')
        assert response.status_code == 200
        target.refresh_from_db()
        assert target.is_active is False

    # PATCH unlock → expect 200 và is_active chuyển True
    def test_unlock_user(self, auth_client, admin_role):
        target = CustomUser.objects.create_user(
            email='locked@test.com', password='Test@1234',
            role=admin_role, is_active=False
        )
        response = auth_client.patch(f'/api/auth/users/{target.id}/unlock/')
        assert response.status_code == 200
        target.refresh_from_db()
        assert target.is_active is True

    # PATCH assign-department → expect 200 và profile.department_id cập nhật đúng
    def test_assign_department(self, auth_client, admin_user, admin_role):
        dept = Department.objects.create(name='Engineering')
        target = CustomUser.objects.create_user(
            email='emp@test.com', password='Test@1234',
            role=admin_role, is_active=True
        )
        response = auth_client.patch(
            f'/api/auth/users/{target.id}/assign-department/',
            {'department': dept.id}
        )
        assert response.status_code == 200
        target.refresh_from_db()
        assert target.profile.department_id == dept.id

    # DELETE → expect 204 và is_active chuyển False, record vẫn còn trong DB
    def test_soft_delete_user(self, auth_client, admin_role):
        target = CustomUser.objects.create_user(
            email='del@test.com', password='Test@1234',
            role=admin_role, is_active=True
        )
        response = auth_client.delete(f'/api/auth/users/{target.id}/')
        assert response.status_code == 204
        target.refresh_from_db()
        assert target.is_active is False
