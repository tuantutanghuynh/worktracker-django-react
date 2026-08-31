from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import Role, Permission, RolePermission


class Command(BaseCommand):
    help = 'Seed roles, permissions, and role-permission mappings'

    def handle(self, *args, **options):
        # Bọc toàn bộ vào transaction: Nếu lỗi ở bất kỳ bước nào, tự động ROLLBACK 100%
        with transaction.atomic():

            # --- STEP 1: Create 3 roles ---
            role_data = [
                {'code': 'ADMIN',    'name': 'Administrator'},
                {'code': 'MANAGER',  'name': 'Manager'},
                {'code': 'EMPLOYEE', 'name': 'Employee'},
            ]
            for item in role_data:
                Role.objects.get_or_create(code=item['code'], defaults={'name': item['name']})
            self.stdout.write('Roles seeded.')

            # --- STEP 2: Create all permissions ---
            permissions_data = [
                # User & Team Management
                {'code': 'user:view',           'name': 'View employee account list and details'},
                {'code': 'user:create',         'name': 'Create new employee accounts'},
                {'code': 'user:update',         'name': 'Edit employee account info and profile'},
                {'code': 'user:lock',           'name': 'Lock or unlock an employee account'},
                {'code': 'user:assign_role',    'name': 'Change the role assigned to an employee account'},
                {'code': 'user:reset_password', 'name': 'Reset password for an employee account'},

                # Team Management (P3.6 - Team Coordinator)-manager 
                {'code': 'team:view',           'name': 'View employee list for task assignment'},
                {'code': 'team:assign_department', 'name': 'Assign employee to department'},

                # Client Management
                {'code': 'client:view',         'name': 'View client list and details'},
                {'code': 'client:create',       'name': 'Add new clients to the system'},
                {'code': 'client:update',       'name': 'Edit client information'},
                {'code': 'client:delete',       'name': 'Soft-delete a client by setting is_active to False'},
                {'code': 'client:export',       'name': 'Export client list to Excel or CSV'},

                # Job Management 
                {'code': 'job:view',            'name': 'View project list and details'},
                {'code': 'job:create',          'name': 'Create a new project and assign a manager'},
                {'code': 'job:update',          'name': 'Edit project info such as name, deadline, and status'},
                {'code': 'job:change_status',   'name': 'Change project status (Planning, Active, Completed)'},
                {'code': 'job:delete',          'name': 'Cancel a project by setting its status to CANCELLED'},
                {'code': 'job:export',          'name': 'Export project list to Excel or CSV'},
                {'code': 'job:assign_manager',  'name': 'Change the manager responsible for a project'},

                # Task Management 
                {'code': 'task:view',           'name': 'View task list and details within a project'},
                {'code': 'task:create',         'name': 'Create new tasks and assign them to employees'},
                {'code': 'task:update',         'name': 'Edit task info such as title, deadline, and priority'},
                {'code': 'task:change_status',  'name': 'Change task status on Kanban board'},
                {'code': 'task:delete',         'name': 'Delete a task'},
                {'code': 'task:review',         'name': 'Approve or reject a completed task submission'},
                {'code': 'task:cancel',         'name': 'Cancel a task'},
                {'code': 'task:comment',        'name': 'Add comments to task discussion'},
                {'code': 'task:attachment',     'name': 'Manage task file attachments'},
                {'code': 'task:follow',         'name': 'Follow or unfollow a task'},

                # Timesheet Control & TimeLock 
                {'code': 'timesheet:view',      'name': 'View employee timesheets and work hour logs'},
                {'code': 'timesheet:lock',      'name': 'Lock a monthly timesheet period to finalize data'},
                {'code': 'timesheet:unlock',    'name': 'Unlock a previously locked timesheet period for corrections'},
                {'code': 'timesheet:export',    'name': 'Export timesheet reports to Excel or PDF'},
                {'code': 'timesheet:review',    'name': 'Approve or reject employee work log entries'},
                {'code': 'timesheet:correct',   'name': 'Correct hours spent on employee work log'},
                {'code': 'timesheet:create', 'name': 'Log new work hours onto a task'},
                {'code': 'timesheet:void',      'name': 'Void an erroneous work log entry'},
                {'code': 'timesheet:edit',      'name': "Edit hours/description on your own pending work log"},
                {'code': 'timesheet:manage',    'name': 'Handle work hour violations such as over-limit or missing'},

                # TimeLock Management
                {'code': 'timelock:view',       'name': 'View locked timesheet periods'},
                {'code': 'timelock:lock',       'name': 'Lock timesheet period for a specific job'},
                {'code': 'timelock:unlock',     'name': 'Unlock timesheet period for a specific job'},
                {'code': 'timelock:global_manage', 'name': 'Lock or unlock the timesheet period company-wide (Admin only, TimeLock.LockScope.GLOBAL)'},

                # Audit Logs & Notifications
                {'code': 'audit:view',          'name': 'View system audit trail and action history'},
                {'code': 'audit:export',        'name': 'Export audit logs to file for archiving or reporting'},
                {'code': 'notification:view',   'name': 'View and manage personal notifications'},

                # Reports 
                {'code': 'report:view',         'name': 'View company-wide performance and summary reports'},
                {'code': 'report:export',       'name': 'Export reports to PDF, Excel, or CSV'},

                # System Settings
                {'code': 'department:view',   'name': 'View the department in the system'},
                {'code': 'department:create',   'name': 'Create a new department in the system'},
                {'code': 'department:update',   'name': 'Edit department information'},
                {'code': 'department:delete',   'name': 'Delete a department from the system'},
                {'code': 'role:manage',         'name': 'Add or edit roles and assign permissions to them'},
            ]

            for item in permissions_data:
                Permission.objects.get_or_create(code=item['code'], defaults={'name': item['name']})
            self.stdout.write(f'2. Permissions seeded: {len(permissions_data)} total.')

            # --- STEP 3: Assign permissions per role ---

            # ADMIN — full access to everything
            admin_role = Role.objects.get(code='ADMIN')
            for perm in Permission.objects.all():
                RolePermission.objects.get_or_create(role=admin_role, permission=perm)
            self.stdout.write('3. RolePermissions seeded for ADMIN.')

            # MANAGER — manage jobs, tasks, team timesheets, timelocks & reports
            manager_codes = [
                'client:view', 'client:export',
                'job:view', 'job:create', 'job:update', 'job:change_status', 'job:export',
                'task:view', 'task:create', 'task:update', 'task:change_status', 'task:review', 'task:cancel', 'task:comment', 'task:attachment', 'task:follow',
                'timesheet:view', 'timesheet:review', 'timesheet:correct', 'timesheet:void', 'timesheet:export',
                'timelock:view', 'timelock:lock', 'timelock:unlock',
                # team:assign_department da bo khoi MANAGER: co cau to chuc
                # (phong ban, tuyen bao cao) thuoc quyen Admin. Manager chi
                # can team:view de xem nhan vien cua minh ma giao viec.
                'team:view',
                'report:view', 'report:export',
                'notification:view', 'audit:view',
            ]
            manager_role = Role.objects.get(code='MANAGER')
            for code in manager_codes:
                perm = Permission.objects.get(code=code)
                RolePermission.objects.get_or_create(role=manager_role, permission=perm)
            self.stdout.write('4. RolePermissions seeded cho MANAGER.')

            # EMPLOYEE — view and work on assigned tasks, log time
            employee_codes = [
                'client:view',
                'job:view',
                'task:view', 'task:update', 'task:change_status', 'task:comment', 'task:attachment', 'task:follow',
                'timesheet:view','timesheet:create', 'timesheet:void', 'timesheet:edit', 'timesheet:export',
                'report:view', 'notification:view',
                'audit:view',
            ]
            employee_role = Role.objects.get(code='EMPLOYEE')
            for code in employee_codes:
                perm = Permission.objects.get(code=code)
                RolePermission.objects.get_or_create(role=employee_role, permission=perm)
            self.stdout.write('5. RolePermissions seeded cho EMPLOYEE.')

        self.stdout.write(self.style.SUCCESS('\nDa Seed du lieu phan quyen hoan tat & an toan tuyet doi!'))