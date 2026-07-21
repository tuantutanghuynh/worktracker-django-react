from django.core.management.base import BaseCommand
from accounts.models import Role, Permission, RolePermission


class Command(BaseCommand):
    help = 'Seed roles, permissions, and role-permission mappings'

    def handle(self, *args, **options):

        # --- BƯỚC 1: Tạo 3 vai trò ---
        role_data = [
            {'code': 'ADMIN',    'name': 'Administrator', 'description': 'Full access to all system features'},
            {'code': 'MANAGER',  'name': 'Manager',       'description': 'Manage projects, team and review work'},
            {'code': 'EMPLOYEE', 'name': 'Employee',      'description': 'Log time, view assigned tasks and jobs'},
        ]
        for item in role_data:
            Role.objects.get_or_create(
                code=item['code'],
                defaults={'name': item['name'], 'description': item['description']},
            )
        self.stdout.write('Roles seeded.')

        # --- BƯỚC 2: Tạo toàn bộ permission theo nhóm ---
        permissions_data = [
            # ── User Management ──────────────────────────────────────────
            {
                'code': 'user:view',
                'name': 'View Users',
                'description': 'Xem danh sách và chi tiết tài khoản nhân viên',
                'group': 'User Management',
            },
            {
                'code': 'user:create',
                'name': 'Create Users',
                'description': 'Tạo tài khoản mới cho nhân viên',
                'group': 'User Management',
            },
            {
                'code': 'user:update',
                'name': 'Update Users',
                'description': 'Chỉnh sửa thông tin tài khoản và hồ sơ nhân viên',
                'group': 'User Management',
            },
            {
                'code': 'user:lock',
                'name': 'Lock / Unlock Users',
                'description': 'Khóa hoặc mở khóa tài khoản nhân viên',
                'group': 'User Management',
            },
            {
                'code': 'user:assign_role',
                'name': 'Assign Roles',
                'description': 'Thay đổi vai trò (role) của tài khoản nhân viên',
                'group': 'User Management',
            },
            {
                'code': 'user:reset_password',
                'name': 'Reset Passwords',
                'description': 'Đặt lại mật khẩu cho tài khoản nhân viên',
                'group': 'User Management',
            },

            # ── Client Management ─────────────────────────────────────────
            {
                'code': 'client:view',
                'name': 'View Clients',
                'description': 'Xem danh sách và chi tiết khách hàng',
                'group': 'Client Management',
            },
            {
                'code': 'client:create',
                'name': 'Create Clients',
                'description': 'Thêm khách hàng mới vào hệ thống',
                'group': 'Client Management',
            },
            {
                'code': 'client:update',
                'name': 'Update Clients',
                'description': 'Chỉnh sửa thông tin khách hàng',
                'group': 'Client Management',
            },
            {
                'code': 'client:delete',
                'name': 'Deactivate Clients',
                'description': 'Vô hiệu hóa (soft delete) khách hàng',
                'group': 'Client Management',
            },
            {
                'code': 'client:export',
                'name': 'Export Clients',
                'description': 'Xuất danh sách khách hàng ra file Excel/CSV',
                'group': 'Client Management',
            },

            # ── Job Management ────────────────────────────────────────────
            {
                'code': 'job:view',
                'name': 'View Jobs',
                'description': 'Xem danh sách và chi tiết dự án',
                'group': 'Job Management',
            },
            {
                'code': 'job:create',
                'name': 'Create Jobs',
                'description': 'Tạo dự án mới và gán Manager phụ trách',
                'group': 'Job Management',
            },
            {
                'code': 'job:update',
                'name': 'Update Jobs',
                'description': 'Chỉnh sửa thông tin dự án (tên, deadline, status...)',
                'group': 'Job Management',
            },
            {
                'code': 'job:delete',
                'name': 'Cancel Jobs',
                'description': 'Hủy dự án (soft delete, chuyển status sang CANCELLED)',
                'group': 'Job Management',
            },
            {
                'code': 'job:export',
                'name': 'Export Jobs',
                'description': 'Xuất danh sách dự án ra file Excel/CSV',
                'group': 'Job Management',
            },
            {
                'code': 'job:assign_manager',
                'name': 'Assign Manager',
                'description': 'Thay đổi Manager phụ trách dự án',
                'group': 'Job Management',
            },

            # ── Task Management ───────────────────────────────────────────
            {
                'code': 'task:view',
                'name': 'View Tasks',
                'description': 'Xem danh sách và chi tiết công việc trong dự án',
                'group': 'Task Management',
            },
            {
                'code': 'task:create',
                'name': 'Create Tasks',
                'description': 'Tạo công việc mới và gán cho nhân viên',
                'group': 'Task Management',
            },
            {
                'code': 'task:update',
                'name': 'Update Tasks',
                'description': 'Chỉnh sửa thông tin công việc (tiêu đề, deadline, priority...)',
                'group': 'Task Management',
            },
            {
                'code': 'task:delete',
                'name': 'Delete Tasks',
                'description': 'Xóa hoặc hủy công việc',
                'group': 'Task Management',
            },
            {
                'code': 'task:review',
                'name': 'Review Tasks',
                'description': 'Duyệt hoặc từ chối nghiệm thu công việc đã hoàn thành',
                'group': 'Task Management',
            },

            # ── Timesheet Control ─────────────────────────────────────────
            {
                'code': 'timesheet:view',
                'name': 'View Timesheets',
                'description': 'Xem bảng chấm công và giờ làm việc của nhân viên',
                'group': 'Timesheet Control',
            },
            {
                'code': 'timesheet:lock',
                'name': 'Lock Period',
                'description': 'Khóa kỳ timesheet theo tháng để chốt dữ liệu',
                'group': 'Timesheet Control',
            },
            {
                'code': 'timesheet:unlock',
                'name': 'Unlock Period',
                'description': 'Mở khóa kỳ timesheet đã chốt khi cần chỉnh sửa',
                'group': 'Timesheet Control',
            },
            {
                'code': 'timesheet:export',
                'name': 'Export Timesheets',
                'description': 'Xuất báo cáo timesheet ra file Excel/PDF',
                'group': 'Timesheet Control',
            },
            {
                'code': 'timesheet:review',
                'name': 'Review Log Works',
                'description': 'Duyệt hoặc từ chối bản ghi giờ làm của nhân viên',
                'group': 'Timesheet Control',
            },
            {
                'code': 'timesheet:manage',
                'name': 'Manage Violations',
                'description': 'Xử lý vi phạm giờ làm (vượt giới hạn, thiếu chấm công)',
                'group': 'Timesheet Control',
            },

            # ── Audit Logs ────────────────────────────────────────────────
            {
                'code': 'audit:view',
                'name': 'View Audit Logs',
                'description': 'Xem nhật ký kiểm toán và lịch sử thao tác trên hệ thống',
                'group': 'Audit Logs',
            },
            {
                'code': 'audit:export',
                'name': 'Export Audit Logs',
                'description': 'Xuất nhật ký kiểm toán ra file để lưu trữ hoặc báo cáo',
                'group': 'Audit Logs',
            },

            # ── Reports ───────────────────────────────────────────────────
            {
                'code': 'report:view',
                'name': 'View Reports',
                'description': 'Xem báo cáo tổng hợp hiệu suất công ty',
                'group': 'Reports',
            },
            {
                'code': 'report:export',
                'name': 'Export Reports',
                'description': 'Xuất báo cáo ra file PDF, Excel, hoặc CSV',
                'group': 'Reports',
            },

            # ── System Settings (backend-only) ────────────────────────────
            {
                'code': 'department:create',
                'name': 'Create Department',
                'description': 'Tạo phòng ban mới trong hệ thống',
                'group': 'System Settings',
            },
            {
                'code': 'department:update',
                'name': 'Update Department',
                'description': 'Chỉnh sửa thông tin phòng ban',
                'group': 'System Settings',
            },
            {
                'code': 'role:manage',
                'name': 'Manage Roles',
                'description': 'Thêm, sửa vai trò và gán quyền cho từng vai trò',
                'group': 'System Settings',
            },
        ]

        for item in permissions_data:
            Permission.objects.get_or_create(
                code=item['code'],
                defaults={
                    'name': item['name'],
                    'description': item['description'],
                    'group': item['group'],
                },
            )
        self.stdout.write(f'Permissions seeded: {len(permissions_data)} total.')

        # --- BƯỚC 3: Gán toàn bộ permission cho ADMIN ---
        admin_role = Role.objects.get(code='ADMIN')
        for perm in Permission.objects.all():
            RolePermission.objects.get_or_create(role=admin_role, permission=perm)
        self.stdout.write('RolePermissions seeded for ADMIN.')

        self.stdout.write(self.style.SUCCESS('Seed completed successfully.'))
