from django.core.management.base import BaseCommand
from accounts.models import Role, Permission, RolePermission


class Command(BaseCommand):
    help = 'Seed roles, permissions, and role-permission mappings'

    def handle(self, *args, **options):

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
            # User Management
            {'code': 'user:view',           'name': 'View employee account list and details'},
            {'code': 'user:create',         'name': 'Create new employee accounts'},
            {'code': 'user:update',         'name': 'Edit employee account info and profile'},
            {'code': 'user:lock',           'name': 'Lock or unlock an employee account'},
            {'code': 'user:assign_role',    'name': 'Change the role assigned to an employee account'},
            {'code': 'user:reset_password', 'name': 'Reset password for an employee account'},

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
            {'code': 'job:delete',          'name': 'Cancel a project by setting its status to CANCELLED'},
            {'code': 'job:export',          'name': 'Export project list to Excel or CSV'},
            {'code': 'job:assign_manager',  'name': 'Change the manager responsible for a project'},

            # Task Management
            {'code': 'task:view',           'name': 'View task list and details within a project'},
            {'code': 'task:create',         'name': 'Create new tasks and assign them to employees'},
            {'code': 'task:update',         'name': 'Edit task info such as title, deadline, and priority'},
            {'code': 'task:delete',         'name': 'Delete or cancel a task'},
            {'code': 'task:review',         'name': 'Approve or reject a completed task submission'},

            # Timesheet Control
            {'code': 'timesheet:view',      'name': 'View employee timesheets and work hour logs'},
            {'code': 'timesheet:lock',      'name': 'Lock a monthly timesheet period to finalize data'},
            {'code': 'timesheet:unlock',    'name': 'Unlock a previously locked timesheet period for corrections'},
            {'code': 'timesheet:export',    'name': 'Export timesheet reports to Excel or PDF'},
            {'code': 'timesheet:review',    'name': 'Approve or reject employee work log entries'},
            {'code': 'timesheet:manage',    'name': 'Handle work hour violations such as over-limit or missing'},

            # Audit Logs
            {'code': 'audit:view',          'name': 'View system audit trail and action history'},
            {'code': 'audit:export',        'name': 'Export audit logs to file for archiving or reporting'},

            # Reports
            {'code': 'report:view',         'name': 'View company-wide performance and summary reports'},
            {'code': 'report:export',       'name': 'Export reports to PDF, Excel, or CSV'},

            # System Settings
            {'code': 'department:create',   'name': 'Create a new department in the system'},
            {'code': 'department:update',   'name': 'Edit department information'},
            {'code': 'role:manage',         'name': 'Add or edit roles and assign permissions to them'},
        ]

        for item in permissions_data:
            Permission.objects.get_or_create(code=item['code'], defaults={'name': item['name']})
        self.stdout.write(f'Permissions seeded: {len(permissions_data)} total.')

        # --- STEP 3: Assign permissions per role ---

        # ADMIN — full access to everything
        admin_role = Role.objects.get(code='ADMIN')
        for perm in Permission.objects.all():
            RolePermission.objects.get_or_create(role=admin_role, permission=perm)
        self.stdout.write('RolePermissions seeded for ADMIN.')

        # MANAGER — manage their projects, tasks, and team timesheets (18 permissions)
        manager_codes = [
            'client:view', 'client:export',
            'job:view', 'job:update', 'job:export', 'job:assign_manager',
            'task:view', 'task:create', 'task:update', 'task:delete', 'task:review',
            'timesheet:view', 'timesheet:lock', 'timesheet:unlock',
            'timesheet:export', 'timesheet:review', 'timesheet:manage',
            'report:view',
        ]
        manager_role = Role.objects.get(code='MANAGER')
        for code in manager_codes:
            perm = Permission.objects.get(code=code)
            RolePermission.objects.get_or_create(role=manager_role, permission=perm)
        self.stdout.write('RolePermissions seeded for MANAGER.')

        # EMPLOYEE — view and work on assigned tasks, log time (8 permissions)
        employee_codes = [
            'client:view',
            'job:view',
            'task:view', 'task:create', 'task:update',
            'timesheet:view', 'timesheet:export',
            'report:view',
        ]
        employee_role = Role.objects.get(code='EMPLOYEE')
        for code in employee_codes:
            perm = Permission.objects.get(code=code)
            RolePermission.objects.get_or_create(role=employee_role, permission=perm)
        self.stdout.write('RolePermissions seeded for EMPLOYEE.')

        self.stdout.write(self.style.SUCCESS('Seed completed successfully.'))
