import pytest
from projects.models import Client, Job

# Kiểm thử API quản lý Job tại /api/admin/jobs/
@pytest.mark.django_db
class TestJobAPI:

    # Khởi tạo Client và job_data dùng chung cho tất cả test trong class
    # {**self.job_data, 'client': ...} — copy dict cũ rồi ghi đè field, cách viết ngắn hơn tạo dict mới
    @pytest.fixture(autouse=True)
    def setup(self, db, admin_user):
        self.client_obj = Client.objects.create(
            client_name='Test Client', tax_code='TAX001', is_active=True
        )
        self.job_data = {
            'client': self.client_obj.id,
            'manager': admin_user.id,
            'job_name': 'Test Job',
            'priority': 'MEDIUM',
            'start_date': '2026-01-01',
            'deadline': '2026-12-31',
        }

    # PATCH status PLANNING → ACTIVE → expect 200, state machine cho phép chuyển
    # refresh_from_db() — load lại object từ DB; nếu không gọi thì job.status vẫn là giá trị cũ trong memory
    def test_valid_transition_planning_to_active(self, auth_client, admin_user):
        job = Job.objects.create(**{
            'client': self.client_obj,
            'manager': admin_user,
            'job_name': 'Job 1',
            'priority': 'MEDIUM',
            'start_date': '2026-01-01',
            'deadline': '2026-12-31',
            'status': 'PLANNING',
        })
        response = auth_client.patch(f'/api/admin/jobs/{job.id}/', {'status': 'ACTIVE'})
        assert response.status_code == 200
        job.refresh_from_db()
        assert job.status == 'ACTIVE'

    # PATCH status PLANNING → COMPLETED → expect 400, state machine chặn nhảy cóc
    def test_invalid_transition_planning_to_completed(self, auth_client, admin_user):
        job = Job.objects.create(**{
            'client': self.client_obj,
            'manager': admin_user,
            'job_name': 'Job 2',
            'priority': 'LOW',
            'start_date': '2026-01-01',
            'deadline': '2026-12-31',
            'status': 'PLANNING',
        })
        response = auth_client.patch(f'/api/admin/jobs/{job.id}/', {'status': 'COMPLETED'})
        assert response.status_code == 400

    # DELETE job → expect 204 và status chuyển CANCELLED, record vẫn còn trong DB
    def test_soft_delete_job(self, auth_client, admin_user):
        job = Job.objects.create(**{
            'client': self.client_obj,
            'manager': admin_user,
            'job_name': 'Job Delete',
            'priority': 'LOW',
            'start_date': '2026-01-01',
            'deadline': '2026-12-31',
        })
        response = auth_client.delete(f'/api/admin/jobs/{job.id}/')
        assert response.status_code == 204
        job.refresh_from_db()
        assert job.status == 'CANCELLED'
        assert Job.objects.filter(id=job.id).exists()

    # POST acquire-lock khi chưa có ai lock → expect 200, lock thành công
    # settings.CACHES dùng LocMemCache thay DummyCache để cache thực sự lưu được giá trị
    def test_acquire_lock_success(self, auth_client, admin_user, settings):
        settings.CACHES = {
            'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}
        }
        from projects.models import Client
        client = Client.objects.create(client_name='C1', tax_code='T001')
        job = Job.objects.create(
            job_name='Job Lock Test', client=client,
            manager=admin_user,
            status='PLANNING', priority='MEDIUM',
            start_date='2025-01-01', deadline='2025-12-31',
        )
        response = auth_client.post(f'/api/admin/jobs/{job.id}/acquire-lock/')
        assert response.status_code == 200

    # POST acquire-lock khi user khác đang giữ lock → expect 423 Locked
    def test_acquire_lock_blocked_by_other_user(self, api_client, admin_user, admin_role, settings):
        settings.CACHES = {
            'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}
        }
        from projects.models import Client
        from accounts.models import CustomUser
        client = Client.objects.create(client_name='C2', tax_code='T002')
        job = Job.objects.create(
            job_name='Job Lock Block', client=client,
            manager=admin_user,
            status='PLANNING', priority='MEDIUM',
            start_date='2025-01-01', deadline='2025-12-31',
        )
        # User A lock trước
        api_client.force_authenticate(user=admin_user)
        api_client.post(f'/api/admin/jobs/{job.id}/acquire-lock/')

        # User B thử lock → phải bị chặn
        user_b = CustomUser.objects.create_user(
            email='b@test.com', password='Test@1234',
            role=admin_role, is_active=True,
        )
        api_client.force_authenticate(user=user_b)
        response = api_client.post(f'/api/admin/jobs/{job.id}/acquire-lock/')
        assert response.status_code == 423
