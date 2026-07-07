from django.core.management.base import BaseCommand
from accounts.models import Role, Permission, RolePermission

class Command(BaseCommand):
    help = 'Seed roles, permissions, and role-permission mappings'

    def handle(self, *args, **options):

        # --- BƯỚC 1: Tạo 3 vai trò ---
        role_data = [
            {'code': 'ADMIN',    'name': 'Administrator'},
            {'code': 'MANAGER',  'name': 'Manager'},
            {'code': 'EMPLOYEE', 'name': 'Employee'},
        ]
        for item in role_data:
            Role.objects.get_or_create(code=item['code'], defaults={'name': item['name']})
            # get_or_create(code=..., defaults=...): tìm theo code, nếu chưa có thì tạo mới với name
        self.stdout.write('Roles seeded.')

        # --- BƯỚC 2: Tạo các permission code ---
        permission_codes = [
            'client:create', 'client:update',
            'job:create', 'job:update',
            'user:create', 'user:update', 'user:lock',
            'department:create', 'department:update',
            'audit:view', 'report:export',
        ]
        for code in permission_codes:
            Permission.objects.get_or_create(code=code, defaults={'name': code})
            # dùng code làm name tạm — đủ để RBAC hoạt động
        self.stdout.write('Permissions seeded.')

        # --- BƯỚC 3: Gán toàn bộ permission cho ADMIN ---
        admin_role = Role.objects.get(code='ADMIN')
        # dùng code='ADMIN' thay vì role_name (field không tồn tại)
        for perm in Permission.objects.all():
            RolePermission.objects.get_or_create(role=admin_role, permission=perm)
        self.stdout.write('RolePermissions seeded.')

        self.stdout.write(self.style.SUCCESS('Seed completed successfully.'))
