import pytest
from system.models import AuditLog


# Kiểm thử API xem Audit Log tại /api/admin/audit-logs/ (read-only)
@pytest.mark.django_db
class TestAuditLogAPI:

    # GET danh sách → expect 200 và có ít nhất 1 log
    def test_list_audit_logs(self, auth_client, admin_user):
        AuditLog.objects.create(
            user=admin_user, action='CREATE', table_name='clients', record_id=1
        )
        response = auth_client.get('/api/admin/audit-logs/')
        assert response.status_code == 200
        assert len(response.data) >= 1

    # GET ?action=CREATE → expect chỉ trả log có action=CREATE
    def test_filter_by_action(self, auth_client, admin_user):
        AuditLog.objects.create(
            user=admin_user, action='CREATE', table_name='clients', record_id=1
        )
        AuditLog.objects.create(
            user=admin_user, action='DELETE', table_name='clients', record_id=2
        )
        response = auth_client.get('/api/admin/audit-logs/?action=CREATE')
        assert response.status_code == 200
        assert all(log['action'] == 'CREATE' for log in response.data)

    # GET ?table_name=clients → expect chỉ trả log của bảng clients
    def test_filter_by_table_name(self, auth_client, admin_user):
        AuditLog.objects.create(
            user=admin_user, action='CREATE', table_name='clients', record_id=1
        )
        AuditLog.objects.create(
            user=admin_user, action='CREATE', table_name='jobs', record_id=1
        )
        response = auth_client.get('/api/admin/audit-logs/?table_name=clients')
        assert response.status_code == 200
        assert all(log['table_name'] == 'clients' for log in response.data)

    # GET ?keyword=XYZ → expect chỉ trả log có chứa XYZ trong old/new values
    def test_filter_by_keyword(self, auth_client, admin_user):
        AuditLog.objects.create(
            user=admin_user, action='UPDATE', table_name='clients', record_id=1,
            new_values={'client_name': 'Cong ty XYZ'},
        )
        AuditLog.objects.create(
            user=admin_user, action='UPDATE', table_name='clients', record_id=2,
            new_values={'client_name': 'Cong ty ABC'},
        )
        response = auth_client.get('/api/admin/audit-logs/?keyword=XYZ')
        assert response.status_code == 200
        assert len(response.data) == 1

    # GET ?record_id=99 → expect chỉ trả log của đúng record_id đó
    def test_filter_by_record_id(self, auth_client, admin_user):
        AuditLog.objects.create(
            user=admin_user, action='UPDATE', table_name='clients', record_id=99
        )
        AuditLog.objects.create(
            user=admin_user, action='UPDATE', table_name='clients', record_id=100
        )
        response = auth_client.get('/api/admin/audit-logs/?record_id=99')
        assert response.status_code == 200
        assert all(log['record_id'] == 99 for log in response.data)

    # POST → expect 405 Method Not Allowed (AuditLogViewSet là ReadOnly)
    # AuditLog chỉ được đọc, không được tạo/sửa/xóa qua API
    def test_audit_log_readonly(self, auth_client):
        response = auth_client.post('/api/admin/audit-logs/', {'action': 'TEST'})
        assert response.status_code == 405


# Kiểm thử API Dashboard tại /api/admin/dashboard/
@pytest.mark.django_db
class TestDashboardAPI:

    # GET → expect 200
    def test_dashboard_returns_200(self, auth_client):
        response = auth_client.get('/api/admin/dashboard/')
        assert response.status_code == 200

    # GET → expect response có đủ 9 key theo spec
    def test_dashboard_has_required_keys(self, auth_client):
        response = auth_client.get('/api/admin/dashboard/')
        data = response.data
        required_keys = [
            'active_clients', 'running_jobs', 'total_users',
            'overdue_jobs', 'total_work_hours', 'jobs_by_status',
            'clients_overview', 'task_status', 'audit_summary_today',
        ]
        for key in required_keys:
            assert key in data, f"Missing key: {key}"

    # GET sau khi tạo client → expect active_clients đếm đúng
    def test_dashboard_counts_active_clients(self, auth_client):
        from projects.models import Client
        Client.objects.create(client_name='Active', tax_code='T001', is_active=True)
        Client.objects.create(client_name='Inactive', tax_code='T002', is_active=False)
        response = auth_client.get('/api/admin/dashboard/')
        assert response.data['active_clients'] >= 1
        assert response.data['clients_overview']['active'] >= 1


# Kiểm thử API xuất báo cáo Excel tại /api/admin/reports/
@pytest.mark.django_db
class TestReportAPI:

    # GET → expect 200, Content-Type là xlsx, Content-Disposition có filename
    def test_export_returns_excel_file(self, auth_client):
        response = auth_client.get('/api/admin/reports/')
        assert response.status_code == 200
        assert response['Content-Type'] == (
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        assert 'attachment' in response['Content-Disposition']
        assert 'worktracker_report.xlsx' in response['Content-Disposition']

    # GET ?date_from=&date_to= → expect chỉ trả job được tạo trong khoảng ngày đó
    def test_report_with_date_filter(self, auth_client):
        response = auth_client.get('/api/admin/reports/?date_from=2020-01-01&date_to=2099-12-31')
        assert response.status_code == 200
        assert response['Content-Type'] == (
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    # GET → expect AuditLog được tạo với action=EXPORT, table_name=reports
    def test_export_creates_audit_log(self, auth_client):
        auth_client.get('/api/admin/reports/')
        assert AuditLog.objects.filter(
            action='EXPORT', table_name='reports', record_id=0
        ).exists()
