import pytest
from django.db import transaction
from rest_framework.test import APIClient
from accounts.models import CustomUser, Role, Permission, RolePermission

# APIClient là HTTP client giả lập của Django REST Framework — dùng để gọi API trong test mà không cần server thật chạy.

#tắt redis khi test
@pytest.fixture(autouse=True) #autouse=True — fixture này tự chạy cho MỌI test, không cần gọi tay. Thay Redis bằng DummyCache để test không cần Redis đang chạy.
def use_dummy_cache(settings):
    settings.CACHES = {
        'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'},
        # 'blacklist' alias cần có vì accounts/authentication.py đọc caches["blacklist"]
        # khi xác thực JWT thật (mọi request không dùng force_authenticate).
        'blacklist': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'},
    }
    settings.CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer"
        }
    }
    
#tạo APIClient
@pytest.fixture
def api_client():
    return APIClient()

#tạo role Admin đầy đủ permissions
@pytest.fixture
def admin_role(db):
    with transaction.atomic():
        role = Role.objects.create(code='ADMIN', name='Admin')
        permission_codes = [
            'client:create', 'client:update', 'client:delete', 'client:view', 'client:export',
            'job:create', 'job:update', 'job:delete', 'job:view', 'job:export',
            'user:create', 'user:update', 'user:view', 'user:lock',
            'department:view', 'department:create', 'department:update', 'department:delete',
            'timesheet:view', 'timesheet:export',
            'role:manage', 'audit:view', 'audit:export', 'report:export',
        ]
        for code in permission_codes:
            perm, _ = Permission.objects.get_or_create(code=code, defaults={'name': code})
            RolePermission.objects.create(role=role, permission=perm)
    return role

#tạo user admin - tự hash pw + truyền role để có đủ quyền
@pytest.fixture
def admin_user(db, admin_role):
    return CustomUser.objects.create_user(
        email='admin@test.com',
        password='Test@1234',
        role=admin_role,
        is_active=True,
        must_change_password=False,
    )

#Tạo client đã đăng nhập- force_authenticate bỏ qua JWT hoàn toàn — gắn user trực tiếp vào request. Dùng để test logic API, không phải test quy trình đăng nhập.
@pytest.fixture
def auth_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client

