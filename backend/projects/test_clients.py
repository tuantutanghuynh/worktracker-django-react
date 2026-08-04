import pytest
from projects.models import Client

# Kiểm thử API quản lý Client tại /api/admin/clients/
# @pytest.mark.django_db — cho phép cả class đọc/ghi DB; sau mỗi test DB tự rollback
@pytest.mark.django_db
class TestClientAPI:

    # POST tạo client mới → expect 201 và client xuất hiện trong DB
    def test_create_client(self, auth_client):
        data = {
            'client_name': 'Cong ty ABC',
            'tax_code': '0123456789',
            'contact_email': 'abc@company.com',
        }
        response = auth_client.post('/api/admin/clients/', data)
        assert response.status_code == 201
        assert Client.objects.filter(tax_code='0123456789').exists()

    # GET danh sách → expect 200 và đếm đúng số lượng client
    def test_list_clients(self, auth_client):
        Client.objects.create(client_name='A', tax_code='111', is_active=True)
        Client.objects.create(client_name='B', tax_code='222', is_active=True)
        response = auth_client.get('/api/admin/clients/')
        assert response.status_code == 200
        assert len(response.data) == 2

    # DELETE → expect 204 và is_active chuyển False, record vẫn còn trong DB
    # refresh_from_db() — load lại object từ DB để lấy giá trị mới nhất sau khi API cập nhật
    def test_soft_delete_client(self, auth_client):
        client = Client.objects.create(client_name='To Delete', tax_code='999', is_active=True)
        response = auth_client.delete(f'/api/admin/clients/{client.id}/')
        assert response.status_code == 204
        client.refresh_from_db()
        assert client.is_active is False

    # GET ?name=cong → expect chỉ trả client có tên chứa "cong" (dùng icontains)
    def test_filter_by_name(self, auth_client):
        Client.objects.create(client_name='Cong ty ABC', tax_code='F001', is_active=True)
        Client.objects.create(client_name='Doanh nghiep XYZ', tax_code='F002', is_active=True)
        response = auth_client.get('/api/admin/clients/?name=cong')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert 'Cong ty ABC' in response.data[0]['client_name']

    # PATCH restore → expect 200 và is_active chuyển lại True
    def test_restore_client(self, auth_client):
        client = Client.objects.create(client_name='Restored', tax_code='R001', is_active=False)
        response = auth_client.patch(f'/api/admin/clients/{client.id}/restore/')
        assert response.status_code == 200
        client.refresh_from_db()
        assert client.is_active is True

    # PATCH restore client đang active → expect 400 (không cần restore)
    def test_restore_already_active_client(self, auth_client):
        client = Client.objects.create(client_name='Already Active', tax_code='R002', is_active=True)
        response = auth_client.patch(f'/api/admin/clients/{client.id}/restore/')
        assert response.status_code == 400

    # GET không có token → expect 401 Unauthorized
    def test_unauthenticated_returns_401(self, api_client):
        response = api_client.get('/api/admin/clients/')
        assert response.status_code == 401
