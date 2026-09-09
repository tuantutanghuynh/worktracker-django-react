"""
Module: accounts.management.commands.seed_data
Description: Master Enterprise Seed Script populating IT and Construction domains.
Includes 6 Master Jobs, 14 Specialized Employees (each with 5-10 diverse tasks, ~103 tasks total),
varied employee productivity, rich review scenarios with attachments & rejection notes,
daily timesheet aggregations, chat rooms, and audit trails. Strictly excludes ON_HOLD.
"""

from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.contrib.auth.hashers import make_password
from django.utils import timezone

from accounts.models import CustomUser, Role, Permission, RolePermission, Department, EmployeeProfile
from projects.models import Client, Job
from tasks.models import Task, TaskFollower, TaskComment, TaskAttachment
from timesheets.models import LogWork, TimeLock, DailyUserTimesheet
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet
from chat.models import ChatRoom, ChatParticipant, ChatMessage
from system.models import AuditLog, Notification
from tasks.services.order_index_manager_service import key_between


class Command(BaseCommand):
    help = "Seed enterprise master dataset (6 Jobs across IT & Construction, 5-10 tasks per employee, varied productivity, no ON_HOLD)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe all existing transactional data and accounts before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== Seeding Master Enterprise Dataset (Expanded Multi-Job & Full Scenarios) ==="))

        with transaction.atomic():
            if options['reset']:
                self.stdout.write("Reset flag detected. Wiping existing transactional data...")
                ChatMessage.objects.all().delete()
                ChatParticipant.objects.all().delete()
                ChatRoom.objects.all().delete()
                LogWork.objects.all().delete()
                DailyUserTimesheet.objects.all().delete()
                TimeLock.objects.all().delete()
                TaskAttachment.objects.all().delete()
                TaskComment.objects.all().delete()
                TaskFollower.objects.all().delete()
                Task.objects.all().delete()
                Job.objects.all().delete()
                Client.objects.all().delete()
                AuditLog.objects.all().delete()
                Notification.objects.all().delete()
                EmployeeProfile.objects.all().delete()
                CustomUser.objects.all().delete()

                with connection.cursor() as cursor:
                    if connection.vendor == 'sqlite':
                        cursor.execute("DELETE FROM sqlite_sequence;")
                    elif connection.vendor == 'postgresql':
                        target_tables = [
                            Task._meta.db_table,
                            Job._meta.db_table,
                            Client._meta.db_table,
                            CustomUser._meta.db_table,
                            LogWork._meta.db_table,
                            TimeLock._meta.db_table,
                            ChatRoom._meta.db_table,
                            ChatMessage._meta.db_table,
                        ]
                        for tbl in target_tables:
                            try:
                                with transaction.atomic():
                                    cursor.execute(f"SELECT pg_get_serial_sequence('{tbl}', 'id')")
                                    row = cursor.fetchone()
                                    if row and row[0]:
                                        seq_name = row[0]
                                        cursor.execute(f"ALTER SEQUENCE {seq_name} RESTART WITH 1;")
                            except Exception:
                                pass

            # -----------------------------------------------------------------
            # 1. ROLES, PERMISSIONS & RBAC MAPPINGS
            # -----------------------------------------------------------------
            self.stdout.write("1. Setting up Roles, Permissions & RBAC mappings...")
            role_admin, _ = Role.objects.get_or_create(code="ADMIN", defaults={"name": "System Administrator", "description": "Full enterprise system administration"})
            role_manager, _ = Role.objects.get_or_create(code="MANAGER", defaults={"name": "Project Manager", "description": "Project scoping, team management & task approvals"})
            role_employee, _ = Role.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Specialist / Engineer", "description": "Task execution and time logging"})

            permissions_data = [
                # User & Team Management
                {'code': 'user:view', 'name': 'View employee account list and details'},
                {'code': 'user:create', 'name': 'Create new employee accounts'},
                {'code': 'user:update', 'name': 'Edit employee account info and profile'},
                {'code': 'user:lock', 'name': 'Lock or unlock an employee account'},
                {'code': 'user:assign_role', 'name': 'Change the role assigned to an employee account'},
                {'code': 'user:reset_password', 'name': 'Reset password for an employee account'},
                {'code': 'team:view', 'name': 'View employee list for task assignment'},
                {'code': 'team:assign_department', 'name': 'Assign employee to department'},

                # Client Management
                {'code': 'client:view', 'name': 'View client list and details'},
                {'code': 'client:create', 'name': 'Add new clients to the system'},
                {'code': 'client:update', 'name': 'Edit client information'},
                {'code': 'client:delete', 'name': 'Soft-delete a client by setting is_active to False'},
                {'code': 'client:export', 'name': 'Export client list to Excel or CSV'},

                # Job Management
                {'code': 'job:view', 'name': 'View project list and details'},
                {'code': 'job:create', 'name': 'Create a new project and assign a manager'},
                {'code': 'job:update', 'name': 'Edit project info such as name, deadline, and status'},
                {'code': 'job:change_status', 'name': 'Change project status (Planning, Active, Completed)'},
                {'code': 'job:delete', 'name': 'Cancel a project by setting its status to CANCELLED'},
                {'code': 'job:export', 'name': 'Export project list to Excel or CSV'},
                {'code': 'job:assign_manager', 'name': 'Change the manager responsible for a project'},

                # Task Management
                {'code': 'task:view', 'name': 'View task list and details within a project'},
                {'code': 'task:create', 'name': 'Create new tasks and assign them to employees'},
                {'code': 'task:update', 'name': 'Edit task info such as title, deadline, and priority'},
                {'code': 'task:change_status', 'name': 'Change task status on Kanban board'},
                {'code': 'task:delete', 'name': 'Delete a task'},
                {'code': 'task:review', 'name': 'Approve or reject a completed task submission'},
                {'code': 'task:cancel', 'name': 'Cancel a task'},
                {'code': 'task:comment', 'name': 'Add comments to task discussion'},
                {'code': 'task:attachment', 'name': 'Manage task file attachments'},
                {'code': 'task:follow', 'name': 'Follow or unfollow a task'},

                # Timesheet Control & TimeLock
                {'code': 'timesheet:view', 'name': 'View employee timesheets and work hour logs'},
                {'code': 'timesheet:lock', 'name': 'Lock a monthly timesheet period to finalize data'},
                {'code': 'timesheet:unlock', 'name': 'Unlock a previously locked timesheet period for corrections'},
                {'code': 'timesheet:export', 'name': 'Export timesheet reports to Excel or PDF'},
                {'code': 'timesheet:review', 'name': 'Approve or reject employee work log entries'},
                {'code': 'timesheet:correct', 'name': 'Correct hours spent on employee work log'},
                {'code': 'timesheet:create', 'name': 'Log new work hours onto a task'},
                {'code': 'timesheet:void', 'name': 'Void an erroneous work log entry'},
                {'code': 'timesheet:edit', 'name': "Edit hours/description on your own pending work log"},
                {'code': 'timesheet:manage', 'name': 'Handle work hour violations such as over-limit or missing'},
                {'code': 'timelock:view', 'name': 'View locked timesheet periods'},
                {'code': 'timelock:lock', 'name': 'Lock timesheet period for a specific job'},
                {'code': 'timelock:unlock', 'name': 'Unlock timesheet period for a specific job'},
                {'code': 'timelock:global_manage', 'name': 'Lock or unlock the timesheet period company-wide'},

                # Audit, Notification, Reports, Department
                {'code': 'audit:view', 'name': 'View system audit trail and action history'},
                {'code': 'audit:export', 'name': 'Export audit logs to file for archiving or reporting'},
                {'code': 'notification:view', 'name': 'View and manage personal notifications'},
                {'code': 'report:view', 'name': 'View company-wide performance and summary reports'},
                {'code': 'report:export', 'name': 'Export reports to PDF, Excel, or CSV'},
                {'code': 'department:view', 'name': 'View departments in the system'},
                {'code': 'department:create', 'name': 'Create a new department in the system'},
                {'code': 'department:update', 'name': 'Edit department information'},
                {'code': 'department:delete', 'name': 'Delete a department from the system'},
                {'code': 'role:manage', 'name': 'Add or edit roles and assign permissions to them'},
            ]

            perm_objects = {}
            for item in permissions_data:
                perm, _ = Permission.objects.get_or_create(code=item['code'], defaults={'name': item['name']})
                perm_objects[item['code']] = perm

            for perm in perm_objects.values():
                RolePermission.objects.get_or_create(role=role_admin, permission=perm)

            manager_perm_codes = [
                'user:view', 'team:view', 'team:assign_department',
                'client:view', 'client:export',
                'job:view', 'job:create', 'job:update', 'job:change_status', 'job:export',
                'task:view', 'task:create', 'task:update', 'task:change_status', 'task:review', 'task:cancel', 'task:comment', 'task:attachment', 'task:follow',
                'timesheet:view', 'timesheet:review', 'timesheet:correct', 'timesheet:create', 'timesheet:edit', 'timesheet:void', 'timesheet:export',
                'timelock:view', 'timelock:lock', 'timelock:unlock',
                'audit:view', 'audit:export', 'notification:view',
                'report:view', 'report:export', 'department:view',
            ]
            for code in manager_perm_codes:
                if code in perm_objects:
                    RolePermission.objects.get_or_create(role=role_manager, permission=perm_objects[code])

            employee_perm_codes = [
                'job:view',
                'task:view', 'task:change_status', 'task:comment', 'task:attachment', 'task:follow',
                'timesheet:create', 'timesheet:edit', 'timesheet:view',
                'notification:view',
            ]
            for code in employee_perm_codes:
                if code in perm_objects:
                    RolePermission.objects.get_or_create(role=role_employee, permission=perm_objects[code])

            # -----------------------------------------------------------------
            # 2. DEPARTMENTS SETUP
            # -----------------------------------------------------------------
            self.stdout.write("2. Creating Specialized Departments...")
            dept_se, _ = Department.objects.get_or_create(name="Software Engineering Department", defaults={"description": "Backend architecture, Django REST APIs & React development"})
            dept_qa, _ = Department.objects.get_or_create(name="Quality Assurance & Testing Department", defaults={"description": "Automated Pytest suites, performance testing & CI/CD validation"})
            dept_design, _ = Department.objects.get_or_create(name="UI/UX Product Design Department", defaults={"description": "User experience research, design system & interface ergonomics"})
            dept_devops, _ = Department.objects.get_or_create(name="Cloud Infrastructure & DevOps Department", defaults={"description": "Server reliability, Redis caching, Docker & cloud deployment"})
            dept_const, _ = Department.objects.get_or_create(name="Civil & Construction Engineering Department", defaults={"description": "Site survey, structural framing, MEP installation & villa finishing"})

            standard_password = make_password("Password123@")

            # -----------------------------------------------------------------
            # 3. ACCOUNTS (1 ADMIN, 2 MANAGERS, 14 EMPLOYEES)
            # -----------------------------------------------------------------
            self.stdout.write("3. Seeding Accounts (1 Admin, 2 Managers, 14 Specialized Employees)...")

            # Admin
            admin_user, _ = CustomUser.objects.get_or_create(
                email="admin@worktracker.vn",
                defaults={
                    "role": role_admin,
                    "is_staff": True,
                    "is_superuser": True,
                    "is_active": True,
                    "must_change_password": False,
                    "password": standard_password,
                }
            )
            EmployeeProfile.objects.get_or_create(
                user=admin_user,
                defaults={
                    "full_name": "System Administrator",
                    "department": dept_se,
                    "phone_number": "+84 901 000 001",
                    "joined_date": date(2025, 1, 1),
                }
            )

            # Manager 1: IT (David Miller)
            manager_it, _ = CustomUser.objects.get_or_create(
                email="manager@worktracker.vn",
                defaults={
                    "role": role_manager,
                    "is_active": True,
                    "must_change_password": False,
                    "password": standard_password,
                }
            )
            EmployeeProfile.objects.get_or_create(
                user=manager_it,
                defaults={
                    "full_name": "David Miller",
                    "department": dept_se,
                    "phone_number": "+84 902 000 001",
                    "joined_date": date(2025, 3, 1),
                }
            )
            dept_se.manager = manager_it
            dept_se.save(update_fields=["manager"])
            dept_qa.manager = manager_it
            dept_qa.save(update_fields=["manager"])
            dept_design.manager = manager_it
            dept_design.save(update_fields=["manager"])
            dept_devops.manager = manager_it
            dept_devops.save(update_fields=["manager"])

            # Manager 2: Construction (Marcus Vance)
            manager_const, _ = CustomUser.objects.get_or_create(
                email="manager.construction@worktracker.vn",
                defaults={
                    "role": role_manager,
                    "is_active": True,
                    "must_change_password": False,
                    "password": standard_password,
                }
            )
            EmployeeProfile.objects.get_or_create(
                user=manager_const,
                defaults={
                    "full_name": "Marcus Vance",
                    "department": dept_const,
                    "phone_number": "+84 902 000 002",
                    "joined_date": date(2025, 4, 1),
                }
            )
            dept_const.manager = manager_const
            dept_const.save(update_fields=["manager"])

            # 8 IT Employees
            it_emp_defs = [
                ("Sophia Martinez", "sophia.martinez@worktracker.vn", dept_se, "+84 903 000 006", date(2025, 6, 1)),
                ("John Smith", "john.smith@worktracker.vn", dept_se, "+84 903 000 001", date(2025, 6, 15)),
                ("Emma Johnson", "emma.johnson@worktracker.vn", dept_design, "+84 903 000 002", date(2025, 7, 1)),
                ("Michael Brown", "michael.brown@worktracker.vn", dept_se, "+84 903 000 003", date(2025, 7, 15)),
                ("Olivia Davis", "olivia.davis@worktracker.vn", dept_qa, "+84 903 000 004", date(2025, 8, 1)),
                ("William Wilson", "william.wilson@worktracker.vn", dept_devops, "+84 903 000 005", date(2025, 8, 15)),
                ("James Anderson", "james.anderson@worktracker.vn", dept_se, "+84 903 000 007", date(2025, 9, 1)),
                ("Ava Taylor", "ava.taylor@worktracker.vn", dept_design, "+84 903 000 008", date(2025, 9, 15)),
            ]

            it_employees = {}
            for name, email, dept, phone, joined in it_emp_defs:
                user, _ = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={
                        "role": role_employee,
                        "is_active": True,
                        "must_change_password": False,
                        "password": standard_password,
                    }
                )
                prof, _ = EmployeeProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "full_name": name,
                        "department": dept,
                        "manager": manager_it,
                        "phone_number": phone,
                        "joined_date": joined,
                    }
                )
                prof.manager = manager_it
                prof.department = dept
                prof.save(update_fields=["manager", "department"])
                it_employees[email] = user

            # 6 Construction Employees
            const_emp_defs = [
                ("Brian Miller", "brian.miller@worktracker.vn", dept_const, "+84 903 000 011", date(2025, 6, 1)),
                ("Chloe Bennett", "chloe.bennett@worktracker.vn", dept_const, "+84 903 000 012", date(2025, 6, 15)),
                ("Ethan Ross", "ethan.ross@worktracker.vn", dept_const, "+84 903 000 013", date(2025, 7, 1)),
                ("Grace Hall", "grace.hall@worktracker.vn", dept_const, "+84 903 000 014", date(2025, 7, 15)),
                ("Nathan Ward", "nathan.ward@worktracker.vn", dept_const, "+84 903 000 015", date(2025, 8, 1)),
                ("Zoe Foster", "zoe.foster@worktracker.vn", dept_const, "+84 903 000 016", date(2025, 8, 15)),
            ]

            const_employees = {}
            for name, email, dept, phone, joined in const_emp_defs:
                user, _ = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={
                        "role": role_employee,
                        "is_active": True,
                        "must_change_password": False,
                        "password": standard_password,
                    }
                )
                prof, _ = EmployeeProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "full_name": name,
                        "department": dept,
                        "manager": manager_const,
                        "phone_number": phone,
                        "joined_date": joined,
                    }
                )
                prof.manager = manager_const
                prof.department = dept
                prof.save(update_fields=["manager", "department"])
                const_employees[email] = user

            # -----------------------------------------------------------------
            # 4. CLIENTS & JOBS (6 MASTER JOBS ACROSS 2 MANAGERS, NO ON_HOLD)
            # -----------------------------------------------------------------
            self.stdout.write("4. Seeding Clients & Master Jobs (6 Distinct Jobs)...")

            # --- David Miller's 3 IT Jobs ---
            client_it1, _ = Client.objects.get_or_create(
                client_name="TechCore Innovations Corp",
                defaults={
                    "tax_code": "0101234567",
                    "industry": "Information Technology",
                    "address": "72 Le Thanh Ton Street, Ben Nghe Ward, District 1, Ho Chi Minh City",
                    "contact_person": "Robert Vance",
                    "contact_email": "contact@techcore.com",
                    "contact_phone": "+84 28 3822 9999",
                    "is_active": True,
                    "notes": "Strategic Enterprise Partner for WorkTracker Core Ecosystem",
                }
            )
            job_it1, _ = Job.objects.get_or_create(
                job_code="JOB-WT-2026",
                defaults={
                    "job_name": "WorkTracker Core — Enterprise Project & Timesheet Governance Platform",
                    "client": client_it1,
                    "manager": manager_it,
                    "priority": Job.Priority.HIGH,
                    "status": Job.Status.ACTIVE,
                    "start_date": date(2026, 8, 1),
                    "deadline": date(2026, 10, 31),
                    "description": "Multi-tenant role-based project and timesheet governance platform for enterprise teams.",
                }
            )

            client_it2, _ = Client.objects.get_or_create(
                client_name="FinTech Global Solutions Corp",
                defaults={
                    "tax_code": "0103456789",
                    "industry": "Financial Technology & Banking",
                    "address": "Bitexco Financial Tower, Floor 32, 2 Hai Trieu, District 1, HCMC",
                    "contact_person": "Alexander Sterling",
                    "contact_email": "partner@fintechglobal.com",
                    "contact_phone": "+84 28 3910 1122",
                    "is_active": True,
                    "notes": "Banking grade mobile enterprise application development",
                }
            )
            job_it2, _ = Job.objects.get_or_create(
                job_code="JOB-WT-APP-2026",
                defaults={
                    "job_name": "WorkTracker Mobile App — React Native iOS & Android Client",
                    "client": client_it2,
                    "manager": manager_it,
                    "priority": Job.Priority.HIGH,
                    "status": Job.Status.ACTIVE,
                    "start_date": date(2026, 8, 20),
                    "deadline": date(2026, 11, 30),
                    "description": "Cross-platform mobile client for field engineers with offline time-logging, biometric sign-in, and push notifications.",
                }
            )

            client_it3, _ = Client.objects.get_or_create(
                client_name="NextGen Cloud Systems Corp",
                defaults={
                    "tax_code": "0104567890",
                    "industry": "AI & Cloud Software",
                    "address": "Saigon Hi-Tech Park, Lot T2-4, Thu Duc City, HCMC",
                    "contact_person": "Elena Rostova",
                    "contact_email": "ops@nextgencloud.io",
                    "contact_phone": "+84 28 7300 8899",
                    "is_active": True,
                    "notes": "Enterprise Machine Learning algorithms for capacity and workload forecasting",
                }
            )
            job_it3, _ = Job.objects.get_or_create(
                job_code="JOB-AI-OPS-2026",
                defaults={
                    "job_name": "AI-Powered Workload Forecast & Resource Optimization Engine",
                    "client": client_it3,
                    "manager": manager_it,
                    "priority": Job.Priority.MEDIUM,
                    "status": Job.Status.PLANNING,
                    "start_date": date(2026, 9, 1),
                    "deadline": date(2026, 12, 15),
                    "description": "Predictive workload forecasting and smart dispatching system using historical timesheets and sprint burn-down rates.",
                }
            )

            # --- Marcus Vance's 3 Construction Jobs ---
            client_const1, _ = Client.objects.get_or_create(
                client_name="Summit Horizon Construction Corp",
                defaults={
                    "tax_code": "0102345678",
                    "industry": "Construction & Real Estate",
                    "address": "120 Nguyen Huu Tho Avenue, Tan Phong Ward, District 7, Ho Chi Minh City",
                    "contact_person": "Jonathan Hayes",
                    "contact_email": "contact@summithorizon.com",
                    "contact_phone": "+84 28 3775 8888",
                    "is_active": True,
                    "notes": "Prime Contractor for Luxury Estates & Villa Developments",
                }
            )
            job_const1, _ = Job.objects.get_or_create(
                job_code="JOB-CONST-2026",
                defaults={
                    "job_name": "Greenfield Luxury Villa — Turnkey Construction & Interior Finishing",
                    "client": client_const1,
                    "manager": manager_const,
                    "priority": Job.Priority.HIGH,
                    "status": Job.Status.ACTIVE,
                    "start_date": date(2026, 8, 15),
                    "deadline": date(2026, 10, 15),
                    "description": "Turnkey construction of 3-story luxury villa including structural framing, MEP, and interior finishing.",
                }
            )

            client_const2, _ = Client.objects.get_or_create(
                client_name="Vinhomes Horizon Corporation",
                defaults={
                    "tax_code": "0105678901",
                    "industry": "Commercial Real Estate",
                    "address": "Landmark 81 Tower, Floor 45, 720A Dien Bien Phu, Binh Thanh District, HCMC",
                    "contact_person": "Tran Nguyen Hoang",
                    "contact_email": "projects@vinhomeshorizon.vn",
                    "contact_phone": "+84 28 3823 6677",
                    "is_active": True,
                    "notes": "Grade-A Commercial Office Tower Superstructure & MEP",
                }
            )
            job_const2, _ = Job.objects.get_or_create(
                job_code="JOB-TOWER-2026",
                defaults={
                    "job_name": "Landmark Commercial Plaza — Structural Framing & MEP Installation",
                    "client": client_const2,
                    "manager": manager_const,
                    "priority": Job.Priority.HIGH,
                    "status": Job.Status.ACTIVE,
                    "start_date": date(2026, 8, 10),
                    "deadline": date(2026, 11, 20),
                    "description": "25-story commercial complex concrete framing, HVAC central cooling towers, and fire protection MEP.",
                }
            )

            client_const3, _ = Client.objects.get_or_create(
                client_name="Sun Premier Hospitality Group",
                defaults={
                    "tax_code": "0106789012",
                    "industry": "Hospitality & Resort Infrastructure",
                    "address": "Son Tra Peninsula Coastal Boulevard, Da Nang City",
                    "contact_person": "Vuong Dinh Bach",
                    "contact_email": "development@sunpremier.vn",
                    "contact_phone": "+84 236 3999 555",
                    "is_active": True,
                    "notes": "5-star seaside eco-resort complex and coastal bungalows",
                }
            )
            job_const3, _ = Job.objects.get_or_create(
                job_code="JOB-RESORT-2026",
                defaults={
                    "job_name": "Son Tra Coastal Eco-Resort — Landscape & Bungalow Architecture",
                    "client": client_const3,
                    "manager": manager_const,
                    "priority": Job.Priority.MEDIUM,
                    "status": Job.Status.PLANNING,
                    "start_date": date(2026, 9, 5),
                    "deadline": date(2026, 12, 30),
                    "description": "Oceanfront luxury bungalows, saltwater infinity pool filtration, environmental wastewater treatment, and native tropical landscaping.",
                }
            )

            # Helper for LexoRank ordering keys
            def make_order_keys(n):
                keys = []
                prev = None
                for _ in range(n):
                    k = key_between(prev, None)
                    keys.append(k)
                    prev = k
                return keys

            # -----------------------------------------------------------------
            # 5. EXPANDED TASKS: ~103 TASKS ACROSS 6 JOBS (5-10 TASKS PER EMPLOYEE)
            # -----------------------------------------------------------------
            self.stdout.write("5. Seeding Expanded Task Lifecycle (~103 Tasks with full scenarios, strictly no ON_HOLD)...")

            # Reference users
            u_sophia = it_employees["sophia.martinez@worktracker.vn"]
            u_john = it_employees["john.smith@worktracker.vn"]
            u_emma = it_employees["emma.johnson@worktracker.vn"]
            u_michael = it_employees["michael.brown@worktracker.vn"]
            u_olivia = it_employees["olivia.davis@worktracker.vn"]
            u_william = it_employees["william.wilson@worktracker.vn"]
            u_james = it_employees["james.anderson@worktracker.vn"]
            u_ava = it_employees["ava.taylor@worktracker.vn"]

            u_brian = const_employees["brian.miller@worktracker.vn"]
            u_chloe = const_employees["chloe.bennett@worktracker.vn"]
            u_ethan = const_employees["ethan.ross@worktracker.vn"]
            u_grace = const_employees["grace.hall@worktracker.vn"]
            u_nathan = const_employees["nathan.ward@worktracker.vn"]
            u_zoe = const_employees["zoe.foster@worktracker.vn"]

            # Format: (job, title, assignee, status, priority, start_date, deadline, completed_at, description)
            tasks_master_defs = [
                # =============================================================
                # JOB 1: JOB-WT-2026 (WorkTracker Core) - 24 Tasks
                # =============================================================
                # Phase 1: Completed August
                (job_it1, "Database Schema Design, Django Migrations & ERD", u_john, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 1), date(2026, 8, 10), timezone.now() - timedelta(days=26), "Core relational data models, composite indexes, and ERD documentation."),
                (job_it1, "JWT Authentication, RBAC Permissions & Token Blacklist", u_michael, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 5), date(2026, 8, 18), timezone.now() - timedelta(days=19), "Token refresh rotation, Redis blacklist caching, and authorization guards."),
                (job_it1, "React 19 Frontend Shell, Tailwind v4 Theme & Drawer UI", u_emma, Task.Status.COMPLETED, Task.Priority.MEDIUM, date(2026, 8, 10), date(2026, 8, 25), timezone.now() - timedelta(days=12), "Design tokens, responsive shell layout, sidebar navigation, and mobile drawer."),
                (job_it1, "Multi-Channel Support Desk & WebSocket Gateway", u_william, Task.Status.COMPLETED, Task.Priority.MEDIUM, date(2026, 8, 18), date(2026, 8, 30), timezone.now() - timedelta(days=7), "Django Channels ASGI setup, redis channel layers, and real-time chat routing."),
                (job_it1, "Unit Test Suite for RBAC Service Layer (120 Tests)", u_olivia, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 12), date(2026, 8, 24), timezone.now() - timedelta(days=14), "Pytest fixtures, role permission boundary tests, and assertion coverage."),
                (job_it1, "Client Directory CRUD & Search Indexing API", u_james, Task.Status.COMPLETED, Task.Priority.MEDIUM, date(2026, 8, 20), date(2026, 8, 29), timezone.now() - timedelta(days=9), "Django REST Framework ViewSets for client management and tax code validation."),

                # Phase 2: Active / Current September
                (job_it1, "React Kanban Board & Drag-and-Drop Order Index", u_sophia, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 14), None, "Full Drag-and-Drop interaction with LexoRank fractional ordering and optimistic rollback."),
                (job_it1, "Timesheet Daily 8-Hour Cap & Multi-Role Review Flow", u_john, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 10), None, "Daily 8-hour submission ceiling check, manager batch approval, and voiding endpoints."),
                (job_it1, "Manager Workload Utilization & Capacity Metrics Engine", u_michael, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 4), date(2026, 9, 16), None, "Aggregated work log metrics, overtime warnings, and department capacity utilization."),
                (job_it1, "Automated Pytest Suite (372 cases) & CI Validation", u_olivia, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 3), date(2026, 9, 12), None, "Full test automation regression suite verifying all APIs and transition rules."),
                (job_it1, "Employee Performance Radar & KPI Analytics Dashboard", u_sophia, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 4), date(2026, 9, 15), None, "Five-axis radar chart for velocity, on-time delivery, workload capacity, and quality."),
                (job_it1, "Mobile Responsive Optimization for Timesheet Matrix Grid", u_emma, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 3), date(2026, 9, 13), None, "Touch scroll gestures, virtualized row rendering, and sticky week navigation."),
                (job_it1, "Global TimeLock Auto-Lock Cron & Admin Unlock Audit", u_james, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 9), None, "Celery periodic task to lock previous month timesheets and log unlock audit trail."),
                (job_it1, "Nginx Reverse Proxy Caching & SSL TLS 1.3 Setup", u_william, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 2), date(2026, 9, 14), None, "Nginx microcaching for public assets and strict HTTP transport security headers."),
                (job_it1, "Accessibility Contrast & Screen Reader Audit (WCAG 2.1)", u_ava, Task.Status.IN_PROGRESS, Task.Priority.LOW, date(2026, 9, 5), date(2026, 9, 17), None, "ARIA attributes for complex tables, modal keyboard navigation, and contrast check."),

                # Phase 3: Review / Overdue / Rejection Scenario
                (job_it1, "Elasticsearch Full-Text Query for Project Tasks", u_john, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 8, 28), date(2026, 9, 5), None, "Full-text indexing with fuzzy match. Rejected back from Review due to memory leak."),
                (job_it1, "PDF & Excel Enterprise Export Engine for Timesheets", u_ava, Task.Status.REVIEWING, Task.Priority.MEDIUM, date(2026, 9, 2), date(2026, 9, 11), None, "Tabular report generator formatting timesheet matrices into styled Excel workbooks."),
                (job_it1, "Legacy XML Timesheet Migration Parser", u_michael, Task.Status.CANCELLED, Task.Priority.LOW, date(2026, 8, 15), date(2026, 8, 28), None, "Deprecated after customer decided to import directly via JSON REST endpoints."),

                # Phase 4: Backlog / Upcoming Sprint
                (job_it1, "Redis Multi-Node Cluster & Distributed Cache Eviction", u_william, Task.Status.TODO, Task.Priority.LOW, date(2026, 9, 25), date(2026, 10, 15), None, "Redis sentinel configuration and selective cache invalidation on task mutation."),
                (job_it1, "SOC2 Audit Compliance Trail & Vulnerability Scan", u_michael, Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 1), date(2026, 10, 25), None, "AuditLog tampering verification, automated security scans, and pen-testing report."),
                (job_it1, "Release Candidate Packaging & User Acceptance Testing", u_olivia, Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 20), date(2026, 10, 31), None, "Final staging sanity check, production migration dry-run, and UAT sign-off."),
                (job_it1, "Notification Preference Settings & Slack Webhook Dispatch", u_james, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 22), date(2026, 10, 6), None, "User-level toggle matrix for email, push, and slack webhook notifications."),
                (job_it1, "Design System v2 Icons & Empty State Illustrations", u_emma, Task.Status.TODO, Task.Priority.LOW, date(2026, 9, 28), date(2026, 10, 12), None, "SVG iconography set and friendly illustrations for zero-state views."),
                (job_it1, "Dark Theme High-Contrast Mode & Theme Persistence", u_sophia, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 2), date(2026, 10, 18), None, "CSS variable theme toggling with system preference detection and localStorage."),

                # =============================================================
                # JOB 2: JOB-WT-APP-2026 (WorkTracker Mobile App) - 18 Tasks
                # =============================================================
                (job_it2, "React Native Navigation Shell & Bottom Tab Architecture", u_sophia, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 20), date(2026, 8, 30), timezone.now() - timedelta(days=8), "Setup Expo Router, stack navigators, and authenticated route guards."),
                (job_it2, "Mobile Biometric Authentication (FaceID & Fingerprint)", u_michael, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 22), date(2026, 9, 2), timezone.now() - timedelta(days=5), "Integration with iOS Keychain and Android Keystore for zero-friction login."),
                (job_it2, "Mobile App UI Wireframes & Interactive Figma Prototype", u_emma, Task.Status.COMPLETED, Task.Priority.MEDIUM, date(2026, 8, 20), date(2026, 9, 1), timezone.now() - timedelta(days=6), "Complete 40-screen mobile user journeys for quick logging and task dispatch."),
                (job_it2, "Offline SQLite Sync Engine for Field Timesheet Logs", u_john, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 15), None, "Local transaction buffer syncing back to Django backend once internet reconnects."),
                (job_it2, "Push Notification Service with Firebase Cloud Messaging (FCM)", u_james, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 3), date(2026, 9, 16), None, "Direct push routing for urgent task assignment and manager review status changes."),
                (job_it2, "Mobile Quick Log Widget & One-Tap Timer Feature", u_sophia, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 11), None, "Floating action button with start/stop timer directly on device home screen."),
                (job_it2, "Mobile Device Farm Test Automation (Appium Suite)", u_olivia, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 4), date(2026, 9, 18), None, "Cross-device regression testing on Pixel 7, iPhone 15, and Samsung Galaxy S23."),
                (job_it2, "CI/CD Mobile Build Pipeline with Fastlane & GitHub Actions", u_william, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 2), date(2026, 9, 16), None, "Automated TestFlight distribution and Google Play Internal testing track."),
                (job_it2, "Mobile Design Tokens & Typography Scale Harmonization", u_ava, Task.Status.IN_PROGRESS, Task.Priority.LOW, date(2026, 9, 3), date(2026, 9, 14), None, "Aligning Tailwind design tokens with React Native StyleSheet variables."),
                (job_it2, "Overdue Task Geofencing Alert Prototype", u_james, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 8, 25), date(2026, 9, 4), None, "Location based reminder when entering construction site. Currently overdue."),
                (job_it2, "Apple Watch Companion App Extension", u_sophia, Task.Status.CANCELLED, Task.Priority.LOW, date(2026, 8, 24), date(2026, 9, 1), None, "Cancelled by client to prioritize tablet responsive layout for site supervisors."),
                (job_it2, "Tablet Split-View Layout for Construction Supervisors", u_emma, Task.Status.REVIEWING, Task.Priority.MEDIUM, date(2026, 9, 1), date(2026, 9, 12), None, "Master-detail navigation layout taking full advantage of iPad 11-inch screen."),
                (job_it2, "Camera OCR Receipt Scanner for Field Expense Logging", u_john, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 20), date(2026, 10, 10), None, "On-device OCR parsing dates and amounts from merchant receipts."),
                (job_it2, "In-App Crash Reporting & Sentry Telemetry Integration", u_william, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 25), date(2026, 10, 8), None, "Symbolicating stack traces and tracking slow render performance on older devices."),
                (job_it2, "Mobile App Performance Profiling & 60fps Optimization", u_olivia, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 10, 1), date(2026, 10, 16), None, "Eliminating JS bridge bottleneck and optimizing FlatList re-renders."),
                (job_it2, "App Store & Google Play Launch Compliance Audit", u_michael, Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 10), date(2026, 10, 25), None, "Privacy policy manifest, data collection disclosures, and terms of service."),
                (job_it2, "Dark Mode Color Palette for OLED Battery Savings", u_ava, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 5), date(2026, 10, 19), None, "Pure black #000000 theme surfaces and high-contrast accessibility tags."),
                (job_it2, "Deep Linking Architecture & Universal URL Routing", u_john, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 15), date(2026, 11, 5), None, "Route handling for links shared via email or Slack to open directly in app."),

                # =============================================================
                # JOB 3: JOB-AI-OPS-2026 (AI Workload Forecast) - 16 Tasks
                # =============================================================
                (job_it3, "Historical Timesheet Feature Extraction & Dataset Cleaning", u_john, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 6), timezone.now() - timedelta(days=2), "Cleaned 100,000 historical log records into normalized pandas feature frames."),
                (job_it3, "ARIMA & Prophet Time Series Model for Sprint Workload", u_michael, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 3), date(2026, 9, 17), None, "Baseline forecasting model predicting weekly team overload 14 days in advance."),
                (job_it3, "Smart Task Allocation Genetic Algorithm Prototype", u_sophia, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 5), date(2026, 9, 20), None, "Optimizing task assignment based on developer domain velocity and current workload."),
                (job_it3, "FastAPI Microservice Containerization & Model Serving", u_william, Task.Status.REVIEWING, Task.Priority.MEDIUM, date(2026, 9, 2), date(2026, 9, 10), None, "Dockerized inference API with gRPC endpoints communicating with Django backend."),
                (job_it3, "Prediction Accuracy Backtesting Suite (RMSE & MAPE Metrics)", u_olivia, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 4), date(2026, 9, 19), None, "Benchmarking model accuracy against actual delivery dates of past 6 months."),
                (job_it3, "Capacity Forecast Chart Components & Visual Trendlines", u_ava, Task.Status.REVIEWING, Task.Priority.MEDIUM, date(2026, 9, 3), date(2026, 9, 12), None, "Chart.js spline graph visualizing predicted vs actual team hour consumption."),
                (job_it3, "Manager AI Recommendation Card UI & One-Click Accept", u_emma, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 4), date(2026, 9, 18), None, "Interactive card on Manager Dashboard proposing workload rebalancing."),
                (job_it3, "Automated Overtime Anomaly Detector & Early Warning Service", u_james, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 15), None, "Statistical z-score trigger alerting when an employee logs over 45 hours weekly."),
                (job_it3, "Batch Model Retraining Pipeline on Ray Cluster", u_william, Task.Status.TODO, Task.Priority.LOW, date(2026, 9, 22), date(2026, 10, 10), None, "Distributed retraining triggered on the 1st of every month using fresh timesheet data."),
                (job_it3, "Explainable AI (SHAP Values) Feature Importance Panel", u_michael, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 28), date(2026, 10, 15), None, "Explain why specific tasks are predicted to slip deadline to assist PM decisions."),
                (job_it3, "Developer Skill Matrix & Velocity Tagging Algorithm", u_john, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 10, 1), date(2026, 10, 20), None, "Automated scoring of proficiency in Django, React, DevOps based on completion rate."),
                (job_it3, "What-If Scenario Simulation Tool for Project Scoping", u_sophia, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 8), date(2026, 10, 28), None, "Slider-based UI allowing PM to simulate adding 2 developers or changing sprint deadline."),
                (job_it3, "Real-Time Drift Detection for Time Series Inference", u_olivia, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 10, 15), date(2026, 11, 2), None, "Monitoring distribution shift between training data and active sprint behavior."),
                (job_it3, "Weekly Executive Forecast PDF Digest Dispatcher", u_james, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 20), date(2026, 11, 8), None, "Scheduled email report sent to department heads summarizing project health predictions."),
                (job_it3, "On-Premises LLM Integration for Task Description Refinement", u_emma, Task.Status.CANCELLED, Task.Priority.LOW, date(2026, 9, 1), date(2026, 9, 8), None, "Deferred due to high GPU server infrastructure costs during current quarter."),
                (job_it3, "Interactive Capacity Heatmap for Cross-Project Resource Sharing", u_ava, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 25), date(2026, 11, 15), None, "Matrix showing resource availability across all 6 active corporate jobs."),

                # =============================================================
                # JOB 4: JOB-CONST-2026 (Greenfield Luxury Villa) - 18 Tasks
                # =============================================================
                (job_const1, "Topographic Site Survey, Foundation Excavation & Pile Cap Pouring", u_nathan, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 15), date(2026, 8, 23), timezone.now() - timedelta(days=15), "Excavation to -3.5m datum and ultrasonic pile integrity testing."),
                (job_const1, "Ground Floor Reinforced Concrete Slab & Waterproof Membrane", u_brian, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 20), date(2026, 8, 31), timezone.now() - timedelta(days=7), "Sub-slab vapor barrier, 250mm reinforced concrete slab, and Sika waterstop joints."),
                (job_const1, "Second Floor Structural Column Formwork & Concrete Pouring", u_brian, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 12), None, "Reinforcement cage tying, column shuttering, and grade-350 concrete pump."),
                (job_const1, "Underground Plumbing Pipe Conduits & Electrical Wiring Rough-In", u_ethan, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 3), date(2026, 9, 11), None, "PPR hot/cold water distribution pipes and PVC electrical conduit embedment."),
                (job_const1, "Roof Steel Truss Fabrication, Insulation & Terracotta Tiling", u_nathan, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 5), date(2026, 9, 18), None, "Welded steel roof trusses with thermal insulation and moisture-resistant underlay."),
                (job_const1, "HSE Site Safety Scaffolding Inspection & Fall Protection Audit", u_grace, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 8), None, "Scaffold safety tags, perimeter safety netting, and fall arrest harness checks."),
                (job_const1, "Italian Marble Floor Tiling & Moisture-Proof Wall Plastering", u_chloe, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 4), date(2026, 9, 22), None, "800x800mm Calacatta gold marble tile installation with leveling clips."),
                (job_const1, "Smart Home Central HVAC Ducting & Recessed Lighting Setup", u_ethan, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 5), date(2026, 9, 25), None, "Concealed ducted VRV air conditioning and Dali protocol smart lighting wiring."),
                (job_const1, "Infinity Swimming Pool Filtration & Landscape Garden Masonry", u_zoe, Task.Status.IN_PROGRESS, Task.Priority.LOW, date(2026, 9, 4), date(2026, 9, 26), None, "Perimeter balance tank construction and basalt stone retaining walls."),
                (job_const1, "Basement Dewatering Pump Capacity Verification", u_brian, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 8, 25), date(2026, 9, 3), None, "Testing submersible sump pumps during heavy monsoon rain. Overdue deliverable."),
                (job_const1, "Custom Teakwood Entrance Pivot Door Installation", u_chloe, Task.Status.CANCELLED, Task.Priority.LOW, date(2026, 8, 28), date(2026, 9, 5), None, "Cancelled by client in favor of imported Italian aluminum armored security door."),
                (job_const1, "Master Bathroom Jacuzzi & Hansgrohe Sanitary Fixtures", u_chloe, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 10), None, "Pressure testing thermostatic mixer valves and acoustic drain pipe insulation."),
                (job_const1, "Structural Load Bearing Certification & Fire Safety Handover Audit", u_brian, Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 1), date(2026, 10, 15), None, "Municipal construction department load testing certification and fire alarm sign-off."),
                (job_const1, "Outdoor BBQ Pergola & Composite Timber Decking", u_zoe, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 5), date(2026, 10, 20), None, "Weatherproof WPC decking and tempered glass pergola canopy."),
                (job_const1, "Substation Transformer Power Grid Energization", u_ethan, Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 8), date(2026, 10, 22), None, "EVN power company inspection, step-down transformer energization, and earth grounding."),
                (job_const1, "Perimeter Infrared Security Fence & CCTV Dome Deployment", u_grace, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 10, 10), date(2026, 10, 25), None, "4K IP camera network with perimeter boundary tripwire sensor integration."),
                (job_const1, "Deep Cleaning, Air Quality Purging & Final Turnkey Handover", u_brian, Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 20), date(2026, 10, 31), None, "Industrial HEPA vacuuming, VOC paint exhaust purging, and owner key handover."),
                (job_const1, "Bespoke Wine Cellar Climate Control Installation", u_nathan, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 15), date(2026, 10, 28), None, "Hermetic vapor barrier and dual-compressor cooling keeping constant 14°C at 65% RH."),

                # =============================================================
                # JOB 5: JOB-TOWER-2026 (Landmark Commercial Plaza) - 15 Tasks
                # =============================================================
                (job_const2, "Diaphragm Wall (D-Wall) Slurry Trenching & Bentonite Pumping", u_nathan, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 10), date(2026, 8, 25), timezone.now() - timedelta(days=13), "800mm thick perimeter D-wall down to 32m rock strata for deep basement excavation."),
                (job_const2, "Deep Basement Top-Down Excavation & Steel Strut Pre-loading", u_brian, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 18), date(2026, 8, 31), timezone.now() - timedelta(days=7), "Hydraulic jack preloading of 600mm steel struts across 4 basement levels."),
                (job_const2, "High-Strength Self-Compacting Concrete Pouring (Level B1)", u_brian, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 13), None, "Continuous pour of 450m3 grade-450 SCC concrete for basement vehicle ramps."),
                (job_const2, "Central Chiller Plant Water Pipe Header Installation", u_ethan, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 16), None, "Seamless steel chilled water pipes DN300 with nitrile foam insulation."),
                (job_const2, "Tower Crane Climbing & Anchor Tie Installation (Level 12)", u_nathan, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 9), None, "Climbing collar alignment, torque verification of high-tensile anchor bolts."),
                (job_const2, "Emergency Fire Sprinkler Riser Pressure Testing (16 Bar)", u_grace, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 3), date(2026, 9, 11), None, "Hydrostatic 2-hour pressure test of fire suppression risers across podium floors."),
                (job_const2, "Curtain Wall Unitized Double-Glazed Glass Panel Mounting", u_chloe, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 4), date(2026, 9, 24), None, "Low-E argon-filled double-glazed panels with structural silicone weather seals."),
                (job_const2, "Heavy Machinery Rigging HSE Safety Briefing & Permit Review", u_grace, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 15), None, "Daily toolbox talks, lifting gear tag validation, and blind spot marshaling."),
                (job_const2, "Sub-Basement Drainage Sump Pit Level Sensor Wiring", u_ethan, Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 8, 26), date(2026, 9, 4), None, "Float sensor calibration. Overdue inspection due to supplier shipment delay."),
                (job_const2, "Helipad Structural Vibration Damping Isolation Pads", u_nathan, Task.Status.CANCELLED, Task.Priority.LOW, date(2026, 8, 20), date(2026, 9, 1), None, "Cancelled following city aviation authority height ceiling revision."),
                (job_const2, "High-Speed Elevator Core Shaft Plumb Line Laser Survey", u_brian, Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 10), None, "Total station laser verification of 4.0m/s passenger elevator hoistway verticality."),
                (job_const2, "Atrium Skylight Steel Space Frame Erection", u_nathan, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 25), date(2026, 10, 15), None, "Assembly of 36m span tubular steel truss dome over commercial atrium."),
                (job_const2, "BMS Central Monitoring Room Video Wall & Console Integration", u_ethan, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 10, 1), date(2026, 10, 20), None, "BACnet IP integration connecting energy meters, air handling units, and fire alarms."),
                (job_const2, "Public Plaza Granite Pavers & Integrated Sub-Surface Drainage", u_zoe, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 10), date(2026, 10, 30), None, "Flame-finished grey granite slabs with permeable gravel sub-base."),
                (job_const2, "Environmental Noise & Vibration Monitoring Station Audit", u_grace, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 15), date(2026, 11, 5), None, "Ensuring site decibel levels remain below 70dB at adjacent residential boundary."),

                # =============================================================
                # JOB 6: JOB-RESORT-2026 (Son Tra Eco Resort) - 12 Tasks
                # =============================================================
                (job_const3, "Coastal Wetland Topographic Survey & Mangrove Conservation Zone", u_zoe, Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 9, 5), date(2026, 9, 8), timezone.now() - timedelta(days=1), "Boundary demarcation preserving 100% of native coastal mangrove forest."),
                (job_const3, "Eco-Friendly Timber Pile Foundation for Overwater Bungalows", u_nathan, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 6), date(2026, 9, 22), None, "Rot-resistant ironwood timber pilings driven using low-vibration sonic rigs."),
                (job_const3, "Saltwater-Resistant Underground Conduit & Electrical Feeders", u_ethan, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 7), date(2026, 9, 24), None, "Marine-grade armored copper cabling and watertight resin-sealed junction boxes."),
                (job_const3, "Bungalow Teakwood Framing & Bamboo Shingle Roofing Design", u_chloe, Task.Status.REVIEWING, Task.Priority.MEDIUM, date(2026, 9, 6), date(2026, 9, 14), None, "Modular sustainable prefabricated wood joinery with natural airflow ventilation."),
                (job_const3, "Natural Biological Wastewater Wetland Filtration System", u_zoe, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 7), date(2026, 9, 28), None, "Reed bed gravel filtration turning resort greywater into irrigation water."),
                (job_const3, "Seaside Cliff Edge Safety Barrier & Night Illuminance Survey", u_grace, Task.Status.REVIEWING, Task.Priority.MEDIUM, date(2026, 9, 7), date(2026, 9, 15), None, "Tensioned stainless steel cable barriers and turtle-friendly low-kelvin LED lighting."),
                (job_const3, "Beachside Saltwater Infinity Pool Shell Concrete Pouring", u_brian, Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 8), date(2026, 9, 25), None, "Sulfate-resisting Portland cement with crystalline waterproofing admixture."),
                (job_const3, "Resort Solar Photovoltaic Canopy & Battery Energy Storage", u_ethan, Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 25), date(2026, 10, 18), None, "150kW rooftop solar array coupled with 300kWh lithium iron phosphate battery banks."),
                (job_const3, "Native Coastal Botanical Garden & Drip Irrigation Network", u_zoe, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 1), date(2026, 10, 25), None, "Drought-tolerant native sea almond and pandanus trees with smart soil moisture sensors."),
                (job_const3, "Open-Air Spa Pavilion Natural Granite Soak Tubs", u_chloe, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 8), date(2026, 10, 28), None, "Monolithic carved river boulder tubs with outdoor rain shower enclosures."),
                (job_const3, "Golf Cart Pervious Gravel Pathways & Timber Bridges", u_brian, Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 15), date(2026, 11, 8), None, "Permeable stabilized gravel pathways minimizing stormwater runoff into the sea."),
                (job_const3, "Emergency Medical Evacuation Helicopter Landing Pad", u_grace, Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 20), date(2026, 11, 15), None, "Design and lighting standards compliance for medical medevac helicopters."),
            ]

            # Group tasks by job to generate correct LexoRank order keys per job
            jobs_task_buckets = {}
            for t_def in tasks_master_defs:
                j_obj = t_def[0]
                if j_obj not in jobs_task_buckets:
                    jobs_task_buckets[j_obj] = []
                jobs_task_buckets[j_obj].append(t_def)

            created_tasks_map = {}
            for j_obj, task_list in jobs_task_buckets.items():
                order_keys = make_order_keys(len(task_list))
                for idx, t_data in enumerate(task_list):
                    _, title, assignee, status, priority, s_date, d_date, comp_at, desc = t_data
                    mgr = j_obj.manager
                    task, _ = Task.objects.get_or_create(
                        title=title,
                        job=j_obj,
                        defaults={
                            "creator": mgr,
                            "assignee": assignee,
                            "status": status,
                            "priority": priority,
                            "start_date": s_date,
                            "deadline": d_date,
                            "completed_at": comp_at,
                            "order_index": order_keys[idx],
                            "description": desc,
                        }
                    )
                    task.status = status
                    task.priority = priority
                    task.start_date = s_date
                    task.deadline = d_date
                    task.completed_at = comp_at
                    task.order_index = order_keys[idx]
                    task.description = desc
                    task.assignee = assignee
                    task.creator = mgr
                    task.save()

                    TaskFollower.objects.get_or_create(task=task, user=assignee)
                    TaskFollower.objects.get_or_create(task=task, user=mgr)
                    created_tasks_map[title] = task

            # -----------------------------------------------------------------
            # 6. REJECTION NOTES, COMMENTS & ATTACHMENTS FOR REVIEWING TASKS
            # -----------------------------------------------------------------
            self.stdout.write("6. Attaching Rejection Notes, Deliverables & Attachments...")

            # 1. Rejection notes on tasks that were reworked or rejected back
            rejection_notes_data = [
                (
                    "Elasticsearch Full-Text Query for Project Tasks",
                    manager_it,
                    "[Rejection Note]: Kết quả profiling cho thấy memory spike vượt 85% RAM khi index 5,000 tasks cùng lúc. Yêu cầu refactor sang chunked bulk index và hủy filter query lồng nhau.",
                ),
                (
                    "Timesheet Daily 8-Hour Cap & Multi-Role Review Flow",
                    manager_it,
                    "[Rejection Note]: Logic kiểm tra 8h/ngày đang tính theo múi giờ UTC thay vì local Asia/Ho_Chi_Minh. Yêu cầu John Smith fix timezone và bổ sung thêm 4 test cases.",
                ),
                (
                    "Basement Dewatering Pump Capacity Verification",
                    manager_const,
                    "[Rejection Note]: Bơm chìm số 2 bị kẹt rác xây dựng trong đợt thử nghiệm xả lũ. Yêu cầu Brian cho lắp thêm lưới lọc rác thô và đo lại lưu lượng xả đạt tối thiểu 50m3/h.",
                ),
                (
                    "Underground Plumbing Pipe Conduits & Electrical Wiring Rough-In",
                    manager_const,
                    "[Rejection Note]: Tuyến ống cấp nước PPR tại trục A-B giao cắt máng cáp điện chưa đảm bảo khoảng cách an toàn tối thiểu 200mm theo TCVN 9206:2012. Yêu cầu kỹ sư Ethan bố trí lại giá đỡ.",
                ),
            ]
            for t_title, author, note_content in rejection_notes_data:
                if t_title in created_tasks_map:
                    t_obj = created_tasks_map[t_title]
                    TaskComment.objects.get_or_create(
                        task=t_obj,
                        user=author,
                        comment_type=TaskComment.CommentType.REJECTION_NOTE,
                        defaults={"content": note_content}
                    )

            # 2. Attachments for Reviewing & Completed deliverables
            attachments_data = [
                ("Database Schema Design, Django Migrations & ERD", u_john, "WorkTracker_Core_ERD_Architecture_v2.pdf", "https://storage.worktracker.vn/docs/erd_v2.pdf", 2048500),
                ("JWT Authentication, RBAC Permissions & Token Blacklist", u_michael, "RBAC_Security_Audit_Report.pdf", "https://storage.worktracker.vn/docs/rbac_audit.pdf", 1450000),
                ("React 19 Frontend Shell, Tailwind v4 Theme & Drawer UI", u_emma, "Design_System_Tailwind_Tokens_v4.figma", "https://storage.worktracker.vn/figma/tokens_v4.figma", 8740000),
                ("Automated Pytest Suite (372 cases) & CI Validation", u_olivia, "Pytest_CI_Coverage_Report_372_Passed.pdf", "https://storage.worktracker.vn/reports/pytest_372.pdf", 980000),
                ("PDF & Excel Enterprise Export Engine for Timesheets", u_ava, "Timesheet_Enterprise_Export_Sample.xlsx", "https://storage.worktracker.vn/samples/export_sample.xlsx", 450000),
                ("React Kanban Board & Drag-and-Drop Order Index", u_sophia, "Kanban_Optimistic_DnD_Demonstration.mp4", "https://storage.worktracker.vn/videos/kanban_dnd.mp4", 14500000),
                ("Mobile Quick Log Widget & One-Tap Timer Feature", u_sophia, "React_Native_Timer_Widget_Demo.mp4", "https://storage.worktracker.vn/videos/rn_timer.mp4", 11200000),
                ("Topographic Site Survey, Foundation Excavation & Pile Cap Pouring", u_nathan, "Autodesk_Revit_Pile_Cap_Structural_Plan.dwg", "https://storage.worktracker.vn/dwg/pile_cap.dwg", 18900000),
                ("Ground Floor Reinforced Concrete Slab & Waterproof Membrane", u_brian, "Concrete_Grade350_Compressive_Test_Report.pdf", "https://storage.worktracker.vn/docs/concrete_test.pdf", 3200000),
                ("HSE Site Safety Scaffolding Inspection & Fall Protection Audit", u_grace, "HSE_Safety_Checklist_Scaffold_Signed.pdf", "https://storage.worktracker.vn/hse/scaffold_tag_sept.pdf", 1850000),
                ("Master Bathroom Jacuzzi & Hansgrohe Sanitary Fixtures", u_chloe, "Master_Bath_Hansgrohe_Installation_Spec.pdf", "https://storage.worktracker.vn/interior/bath_spec.pdf", 4500000),
                ("High-Speed Elevator Core Shaft Plumb Line Laser Survey", u_brian, "Laser_Total_Station_Plumbness_Log.pdf", "https://storage.worktracker.vn/survey/plumbness_log.pdf", 2150000),
                ("Bungalow Teakwood Framing & Bamboo Shingle Roofing Design", u_chloe, "Eco_Bungalow_Bamboo_Framing_Detail.pdf", "https://storage.worktracker.vn/architect/bungalow_detail.pdf", 5600000),
            ]
            for t_title, author, f_name, f_url, f_sz in attachments_data:
                if t_title in created_tasks_map:
                    t_obj = created_tasks_map[t_title]
                    TaskAttachment.objects.get_or_create(
                        task=t_obj,
                        user=author,
                        file_name=f_name,
                        defaults={"file_url": f_url, "file_size": f_sz}
                    )

            # -----------------------------------------------------------------
            # 7. LOGWORK & TIMESHEETS (DIVERSE PRODUCTIVITY ACROSS AUGUST & SEPTEMBER)
            # -----------------------------------------------------------------
            self.stdout.write("7. Seeding Realistic Work Logs & Computing Daily Timesheets...")

            # Global Lock for August 2026
            TimeLock.objects.get_or_create(
                lock_year=2026,
                lock_month=8,
                lock_scope=TimeLock.LockScope.GLOBAL,
                job=None,
                defaults={
                    "is_locked": True,
                    "locked_by": admin_user,
                    "locked_at": timezone.now() - timedelta(days=9),
                    "lock_reason": "Global timesheet period finalized for Corporate Payroll August 2026.",
                }
            )

            # Diverse log entries to demonstrate different employee productivities:
            # - High performers: Sophia (80h), John (78h), Brian (82h)
            # - Solid performers: Michael (60h), Emma (52h), Olivia (56h), Ethan (62h), Nathan (64h)
            # - Developing/Needs improvement: James (35h, has rejected log), Ava (28h), Chloe (36h), Grace (38h), Zoe (34h), William (48h)
            logwork_definitions = [
                # --- Sophia Martinez (Top Performer - Frontend Lead) ---
                (created_tasks_map["React 19 Frontend Shell, Tailwind v4 Theme & Drawer UI"], u_sophia, date(2026, 8, 12), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Built responsive navigation bar and mobile drawer layout.", None),
                (created_tasks_map["React 19 Frontend Shell, Tailwind v4 Theme & Drawer UI"], u_sophia, date(2026, 8, 14), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Configured Tailwind v4 design tokens and CSS variables.", None),
                (created_tasks_map["React 19 Frontend Shell, Tailwind v4 Theme & Drawer UI"], u_sophia, date(2026, 8, 18), "7.50", LogWork.ReviewStatus.APPROVED, manager_it, "Optimized drawer swipe gestures and keyboard trap navigation.", None),
                (created_tasks_map["React Kanban Board & Drag-and-Drop Order Index"], u_sophia, date(2026, 9, 1), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Built Kanban column headers and HTML5 drag-and-drop context.", None),
                (created_tasks_map["React Kanban Board & Drag-and-Drop Order Index"], u_sophia, date(2026, 9, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Integrated LexoRank key_between algorithm for zero-rebalance ordering.", None),
                (created_tasks_map["React Kanban Board & Drag-and-Drop Order Index"], u_sophia, date(2026, 9, 3), "7.50", LogWork.ReviewStatus.APPROVED, manager_it, "Connected drag drop handlers to PATCH /api/tasks/{id}/ endpoints.", None),
                (created_tasks_map["Employee Performance Radar & KPI Analytics Dashboard"], u_sophia, date(2026, 9, 4), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented 5-axis Radar chart and KPI summary cards.", None),
                (created_tasks_map["Mobile Quick Log Widget & One-Tap Timer Feature"], u_sophia, date(2026, 9, 5), "7.50", LogWork.ReviewStatus.PENDING, None, "Built floating timer widget for React Native client.", None),
                (created_tasks_map["React Native Navigation Shell & Bottom Tab Architecture"], u_sophia, date(2026, 8, 22), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented Expo Router deep link structure and persistent bottom tabs.", None),

                # --- John Smith (Top Performer - Backend Lead) ---
                (created_tasks_map["Database Schema Design, Django Migrations & ERD"], u_john, date(2026, 8, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Drafted SQL normalization, foreign keys, and indexes for 12 tables.", None),
                (created_tasks_map["Database Schema Design, Django Migrations & ERD"], u_john, date(2026, 8, 5), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented Django initial migrations and database constraints.", None),
                (created_tasks_map["Database Schema Design, Django Migrations & ERD"], u_john, date(2026, 8, 8), "7.50", LogWork.ReviewStatus.APPROVED, manager_it, "Exported ERD schema diagram and documentation.", None),
                (created_tasks_map["Timesheet Daily 8-Hour Cap & Multi-Role Review Flow"], u_john, date(2026, 9, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Created DailyUserTimesheet aggregation service and 8h ceiling check.", None),
                (created_tasks_map["Timesheet Daily 8-Hour Cap & Multi-Role Review Flow"], u_john, date(2026, 9, 3), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Added manager review, approval, and voiding API actions.", None),
                (created_tasks_map["Offline SQLite Sync Engine for Field Timesheet Logs"], u_john, date(2026, 9, 4), "7.50", LogWork.ReviewStatus.PENDING, None, "Built delta-sync protocol reconciling local offline submissions.", None),
                (created_tasks_map["Elasticsearch Full-Text Query for Project Tasks"], u_john, date(2026, 9, 5), "6.50", LogWork.ReviewStatus.PENDING, None, "Troubleshooting memory consumption on Elasticsearch indexing.", None),

                # --- Brian Miller (Top Performer - Site Supervisor) ---
                (created_tasks_map["Ground Floor Reinforced Concrete Slab & Waterproof Membrane"], u_brian, date(2026, 8, 22), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Supervised reinforcement tying for 250mm concrete slab.", None),
                (created_tasks_map["Ground Floor Reinforced Concrete Slab & Waterproof Membrane"], u_brian, date(2026, 8, 26), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Monitored concrete pumping grade-350 and slump testing.", None),
                (created_tasks_map["Deep Basement Top-Down Excavation & Steel Strut Pre-loading"], u_brian, date(2026, 8, 28), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Verified hydraulic jacking of steel struts on basement level 2.", None),
                (created_tasks_map["Second Floor Structural Column Formwork & Concrete Pouring"], u_brian, date(2026, 9, 1), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Assembled structural column shuttering and laser alignment.", None),
                (created_tasks_map["Second Floor Structural Column Formwork & Concrete Pouring"], u_brian, date(2026, 9, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Conducted slump test 12±2cm and poured 85m3 concrete.", None),
                (created_tasks_map["Second Floor Structural Column Formwork & Concrete Pouring"], u_brian, date(2026, 9, 3), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Supervised wet burlap curing and temperature differential logging.", None),
                (created_tasks_map["High-Strength Self-Compacting Concrete Pouring (Level B1)"], u_brian, date(2026, 9, 4), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Poured SCC concrete for vehicle ramp in commercial plaza.", None),
                (created_tasks_map["Beachside Saltwater Infinity Pool Shell Concrete Pouring"], u_brian, date(2026, 9, 8), "7.50", LogWork.ReviewStatus.PENDING, None, "Supervised crystalline waterproofing additive mixing for pool shell.", None),

                # --- Michael Brown (Backend & Security) ---
                (created_tasks_map["JWT Authentication, RBAC Permissions & Token Blacklist"], u_michael, date(2026, 8, 8), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Built JWT refresh rotation and token blacklist in Redis.", None),
                (created_tasks_map["JWT Authentication, RBAC Permissions & Token Blacklist"], u_michael, date(2026, 8, 12), "7.50", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented permission middleware decorator for DRF endpoints.", None),
                (created_tasks_map["Mobile Biometric Authentication (FaceID & Fingerprint)"], u_michael, date(2026, 8, 25), "7.00", LogWork.ReviewStatus.APPROVED, manager_it, "Integrated biometric signature verification on authentication endpoints.", None),
                (created_tasks_map["Manager Workload Utilization & Capacity Metrics Engine"], u_michael, date(2026, 9, 4), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented team capacity calculation and aggregated utilization query.", None),
                (created_tasks_map["ARIMA & Prophet Time Series Model for Sprint Workload"], u_michael, date(2026, 9, 5), "7.00", LogWork.ReviewStatus.PENDING, None, "Trained Prophet model predicting upcoming sprint workload.", None),

                # --- Emma Johnson (UI/UX Senior Designer) ---
                (created_tasks_map["React 19 Frontend Shell, Tailwind v4 Theme & Drawer UI"], u_emma, date(2026, 8, 15), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Designed UI component kit and typography system.", None),
                (created_tasks_map["Mobile App UI Wireframes & Interactive Figma Prototype"], u_emma, date(2026, 8, 24), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Created wireframes for React Native mobile application.", None),
                (created_tasks_map["Mobile Responsive Optimization for Timesheet Matrix Grid"], u_emma, date(2026, 9, 3), "7.00", LogWork.ReviewStatus.APPROVED, manager_it, "Refined timesheet cell tap interactions and sticky headers.", None),
                (created_tasks_map["Manager AI Recommendation Card UI & One-Click Accept"], u_emma, date(2026, 9, 4), "6.50", LogWork.ReviewStatus.PENDING, None, "Prototyped AI workload rebalancing recommendation cards.", None),

                # --- Olivia Davis (QA Lead) ---
                (created_tasks_map["Unit Test Suite for RBAC Service Layer (120 Tests)"], u_olivia, date(2026, 8, 16), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented test fixtures for roles and permission matrices.", None),
                (created_tasks_map["Automated Pytest Suite (372 cases) & CI Validation"], u_olivia, date(2026, 9, 3), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Ran automated test suite across all API endpoints with 94% coverage.", None),
                (created_tasks_map["Mobile Device Farm Test Automation (Appium Suite)"], u_olivia, date(2026, 9, 5), "7.50", LogWork.ReviewStatus.PENDING, None, "Automated mobile regression tests on iOS Simulator and Android Emulator.", None),

                # --- William Wilson (DevOps) ---
                (created_tasks_map["Multi-Channel Support Desk & WebSocket Gateway"], u_william, date(2026, 8, 20), "7.50", LogWork.ReviewStatus.APPROVED, manager_it, "Configured Redis channel layer for real-time WebSocket chat.", None),
                (created_tasks_map["Nginx Reverse Proxy Caching & SSL TLS 1.3 Setup"], u_william, date(2026, 9, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Configured SSL certificates and HTTP/2 proxy pass.", None),
                (created_tasks_map["FastAPI Microservice Containerization & Model Serving"], u_william, date(2026, 9, 4), "7.00", LogWork.ReviewStatus.PENDING, None, "Wrote Dockerfile and docker-compose for AI forecasting microservice.", None),

                # --- Ethan Ross (MEP Engineer) ---
                (created_tasks_map["Underground Plumbing Pipe Conduits & Electrical Wiring Rough-In"], u_ethan, date(2026, 9, 3), "7.50", LogWork.ReviewStatus.APPROVED, manager_const, "Laid PPR water supply lines and PVC conduit sleeves.", None),
                (created_tasks_map["Central Chiller Plant Water Pipe Header Installation"], u_ethan, date(2026, 9, 4), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Installed welded steel pipe headers for HVAC cooling tower.", None),
                (created_tasks_map["Saltwater-Resistant Underground Conduit & Electrical Feeders"], u_ethan, date(2026, 9, 7), "7.00", LogWork.ReviewStatus.PENDING, None, "Ran armored underground power lines to seaside bungalows.", None),

                # --- Nathan Ward (Structural Engineer) ---
                (created_tasks_map["Topographic Site Survey, Foundation Excavation & Pile Cap Pouring"], u_nathan, date(2026, 8, 16), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Completed topographical leveling and set benchmarks.", None),
                (created_tasks_map["Diaphragm Wall (D-Wall) Slurry Trenching & Bentonite Pumping"], u_nathan, date(2026, 8, 20), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Inspected slurry trench excavation and rebar cage lowering.", None),
                (created_tasks_map["Tower Crane Climbing & Anchor Tie Installation (Level 12)"], u_nathan, date(2026, 9, 2), "7.50", LogWork.ReviewStatus.APPROVED, manager_const, "Verified torque and tie-in collar bolts on tower crane mast.", None),

                # --- James Anderson (Developing - has a REJECTED log to test revision) ---
                (created_tasks_map["Client Directory CRUD & Search Indexing API"], u_james, date(2026, 8, 24), "7.00", LogWork.ReviewStatus.APPROVED, manager_it, "Built client listing and tax code search endpoints.", None),
                (created_tasks_map["Global TimeLock Auto-Lock Cron & Admin Unlock Audit"], u_james, date(2026, 9, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented Celery periodic task for monthly timelock enforcement.", None),
                (created_tasks_map["Push Notification Service with Firebase Cloud Messaging (FCM)"], u_james, date(2026, 9, 4), "6.00", LogWork.ReviewStatus.PENDING, None, "Integrated Firebase Admin SDK for FCM push notifications.", None),
                # REJECTED Log entry for demonstration:
                (created_tasks_map["Overdue Task Geofencing Alert Prototype"], u_james, date(2026, 9, 3), "7.00", LogWork.ReviewStatus.REJECTED, manager_it, "Mô tả công việc chung chung, chưa làm rõ kết quả đo đạc độ chính xác GPS. Đề nghị giải trình và log lại.", "Giờ log vượt quá thời lượng estimate thực tế và thiếu báo cáo kết quả."),

                # --- Chloe Bennett (Interior Architect - has a REJECTED log to test revision) ---
                (created_tasks_map["Italian Marble Floor Tiling & Moisture-Proof Wall Plastering"], u_chloe, date(2026, 9, 4), "7.50", LogWork.ReviewStatus.APPROVED, manager_const, "Inspected marble tile alignment and leveling clip installation.", None),
                (created_tasks_map["Master Bathroom Jacuzzi & Hansgrohe Sanitary Fixtures"], u_chloe, date(2026, 9, 5), "6.50", LogWork.ReviewStatus.PENDING, None, "Checked Hansgrohe thermostatic valve pressure testing.", None),
                # REJECTED Log entry for demonstration:
                (created_tasks_map["Curtain Wall Unitized Double-Glazed Glass Panel Mounting"], u_chloe, date(2026, 9, 2), "8.00", LogWork.ReviewStatus.REJECTED, manager_const, "Nghiệm thu kính mặt dựng không đạt tiêu chuẩn độ hở ron silicone.", "Nghiệm thu thực tế chưa hoàn thành, yêu cầu nhà thầu xử lý lại rồi mới ghi nhận giờ."),

                # --- Grace Hall (HSE Safety) ---
                (created_tasks_map["HSE Site Safety Scaffolding Inspection & Fall Protection Audit"], u_grace, date(2026, 9, 2), "6.50", LogWork.ReviewStatus.APPROVED, manager_const, "Inspected scaffold platforms, safety tags, and toe boards.", None),
                (created_tasks_map["Emergency Fire Sprinkler Riser Pressure Testing (16 Bar)"], u_grace, date(2026, 9, 3), "7.00", LogWork.ReviewStatus.APPROVED, manager_const, "Witnessed 16-bar hydrostatic pressure testing of fire risers.", None),
                (created_tasks_map["Seaside Cliff Edge Safety Barrier & Night Illuminance Survey"], u_grace, date(2026, 9, 7), "6.00", LogWork.ReviewStatus.PENDING, None, "Surveyed cliff edge lighting and safety barrier stanchions.", None),

                # --- Ava Taylor (UI/UX Designer) ---
                (created_tasks_map["Accessibility Contrast & Screen Reader Audit (WCAG 2.1)"], u_ava, date(2026, 9, 4), "6.50", LogWork.ReviewStatus.APPROVED, manager_it, "Ran automated axe-core accessibility scanner on primary screens.", None),
                (created_tasks_map["PDF & Excel Enterprise Export Engine for Timesheets"], u_ava, date(2026, 9, 5), "6.00", LogWork.ReviewStatus.PENDING, None, "Designed layout styling and column header color tokens for Excel export.", None),

                # --- Zoe Foster (Landscape Architect) ---
                (created_tasks_map["Coastal Wetland Topographic Survey & Mangrove Conservation Zone"], u_zoe, date(2026, 9, 6), "7.00", LogWork.ReviewStatus.APPROVED, manager_const, "Delineated buffer protection boundary for mangrove wetland.", None),
                (created_tasks_map["Infinity Swimming Pool Filtration & Landscape Garden Masonry"], u_zoe, date(2026, 9, 7), "6.50", LogWork.ReviewStatus.PENDING, None, "Verified basal stone cladding around pool perimeter.", None),
            ]

            rebuild_targets = set()
            for t_obj, u_obj, w_date, hrs, r_status, rev_by, desc, r_note in logwork_definitions:
                lw, _ = LogWork.objects.get_or_create(
                    task=t_obj,
                    user=u_obj,
                    work_date=w_date,
                    hours_spent=Decimal(hrs),
                    defaults={
                        "description": desc,
                        "review_status": r_status,
                        "reviewed_by": rev_by,
                        "reviewed_at": timezone.now() - timedelta(days=1) if rev_by else None,
                        "review_note": r_note,
                    }
                )
                lw.review_status = r_status
                lw.reviewed_by = rev_by
                lw.reviewed_at = timezone.now() - timedelta(days=1) if rev_by else None
                lw.review_note = r_note
                lw.description = desc
                lw.save()
                rebuild_targets.add((u_obj.id, w_date))

            # Rebuild daily timesheet aggregates
            for uid, dt in rebuild_targets:
                rebuild_daily_user_timesheet(uid, dt)

            # -----------------------------------------------------------------
            # 8. CHAT ROOMS ACROSS ALL 6 JOBS & SUPPORT DESK
            # -----------------------------------------------------------------
            self.stdout.write("8. Setting up Chat Rooms & Communications for all 6 Master Jobs...")

            jobs_rooms_data = [
                (job_it1, "[JOB-WT-2026] WorkTracker Core Platform Team", manager_it, [u_sophia, u_john, u_michael, u_olivia, u_emma, u_william, u_james, u_ava], "Chào team, Sprint tháng 9 tập trung cao độ hoàn thiện Kanban drag-drop và timesheet lock."),
                (job_it2, "[JOB-WT-APP-2026] WorkTracker Mobile App Engineering", manager_it, [u_sophia, u_john, u_michael, u_emma, u_olivia, u_william, u_james], "Team Mobile lưu ý tối ưu hoá offline sync và biometric FaceID cho đợt release TestFlight tuần tới."),
                (job_it3, "[JOB-AI-OPS-2026] AI Workload Forecast & Optimization Team", manager_it, [u_sophia, u_john, u_michael, u_emma, u_olivia, u_william, u_ava], "Dữ liệu timesheet lịch sử đã được làm sạch, team AI triển khai huấn luyện mô hình Prophet nhé."),
                (job_const1, "[JOB-CONST-2026] Greenfield Luxury Villa Site Team", manager_const, [u_brian, u_chloe, u_ethan, u_grace, u_nathan, u_zoe], "Chỉ huy trưởng Brian chú ý kiểm tra độ sụt bê tông mác 350 trước khi bơm lên sàn tầng 2."),
                (job_const2, "[JOB-TOWER-2026] Landmark Commercial Plaza Construction Team", manager_const, [u_brian, u_chloe, u_ethan, u_grace, u_nathan, u_zoe], "Kỹ sư an toàn Grace kiểm định kỹ giàn giáo và cáp cẩu tháp trước khi bốc dỡ dầm thép."),
                (job_const3, "[JOB-RESORT-2026] Son Tra Eco Resort Project Team", manager_const, [u_brian, u_chloe, u_ethan, u_grace, u_nathan, u_zoe], "Toàn bộ vật liệu tại resort ven biển phải tuân thủ chuẩn chống ăn mòn muối mặn TCVN."),
            ]

            for j_obj, room_name, mgr, members, init_msg in jobs_rooms_data:
                room, _ = ChatRoom.objects.get_or_create(
                    room_type=ChatRoom.RoomType.JOB,
                    job=j_obj,
                    defaults={"name": room_name}
                )
                ChatParticipant.objects.get_or_create(room=room, user=mgr)
                for mem in members:
                    ChatParticipant.objects.get_or_create(room=room, user=mem)

                ChatMessage.objects.get_or_create(
                    room=room,
                    sender=mgr,
                    content=init_msg,
                )

            # Direct Support Room (Sophia <-> Admin)
            room_support, _ = ChatRoom.objects.get_or_create(
                room_type=ChatRoom.RoomType.DIRECT,
                name="Support: Sophia Martinez & Admin",
            )
            ChatParticipant.objects.get_or_create(room=room_support, user=admin_user)
            ChatParticipant.objects.get_or_create(room=room_support, user=u_sophia)
            ChatMessage.objects.get_or_create(
                room=room_support,
                sender=u_sophia,
                content="Nhờ Admin kiểm tra phân quyền truy cập máy chủ staging Redis để test benchmark.",
            )
            ChatMessage.objects.get_or_create(
                room=room_support,
                sender=admin_user,
                content="Đã mở cổng bảo mật VPN cho dải IP của em, em thử kết nối lại nhé.",
            )

            # -----------------------------------------------------------------
            # 9. NOTIFICATIONS & AUDIT LOGS
            # -----------------------------------------------------------------
            self.stdout.write("9. Emitting Real-world Notifications & Audit Log Trail...")

            notifs = [
                (u_sophia, Notification.EventType.TASK_ASSIGNED, "Phân công công việc mới", f"Bạn được phân công vào task: React Kanban Board & Drag-and-Drop Order Index", "/employee/tasks", 5, True),
                (u_sophia, Notification.EventType.LOG_WORK_APPROVED, "Giờ làm việc đã duyệt", "Bản ghi 8.0 giờ ngày 02/09 của bạn đã được David Miller phê duyệt.", "/employee/timesheet", 3, True),
                (u_sophia, Notification.EventType.TIMESHEET_LOCK, "Kỳ công tháng 08/2026 đã chốt", "Kỳ công Tháng 08/2026 đã được chốt bởi Quản trị viên.", "/employee/timesheet", 8, True),
                (u_brian, Notification.EventType.TASK_ASSIGNED, "Chỉ định nhiệm vụ giám sát", "Marcus Vance đã giao nhiệm vụ đổ bê tông sàn tầng 2 biệt thự Greenfield.", "/employee/tasks", 6, True),
                (u_john, Notification.EventType.TASK_COMMENT, "Bình luận trên công việc", "David Miller đã gửi ghi chú phản hồi trên task 8-Hour Cap Validation.", "/employee/tasks", 2, False),
                (u_james, Notification.EventType.LOG_WORK_REJECTED, "Giờ làm việc bị từ chối", "Bản ghi ngày 03/09 của bạn bị từ chối với lý do: Mô tả công việc chung chung.", "/employee/timesheet", 1, False),
            ]
            for user_target, evt_type, title, content, url, days_ago, is_read in notifs:
                Notification.objects.get_or_create(
                    user=user_target,
                    title=title,
                    defaults={
                        "type": Notification.ChannelType.SYSTEM_ONLY,
                        "event_type": evt_type,
                        "content": content,
                        "related_url": url,
                        "is_read": is_read,
                        "created_at": timezone.now() - timedelta(days=days_ago),
                    }
                )

            audit_events = [
                (admin_user, "CREATE", "clients", 1, AuditLog.Severity.NORMAL, "Created client TechCore Innovations Corp", None, {"client_name": "TechCore Innovations Corp"}),
                (admin_user, "CREATE", "clients", 2, AuditLog.Severity.NORMAL, "Created client Summit Horizon Construction Corp", None, {"client_name": "Summit Horizon Construction Corp"}),
                (admin_user, "CREATE", "clients", 3, AuditLog.Severity.NORMAL, "Created client FinTech Global Solutions Corp", None, {"client_name": "FinTech Global Solutions Corp"}),
                (admin_user, "CREATE", "clients", 4, AuditLog.Severity.NORMAL, "Created client Vinhomes Horizon Corporation", None, {"client_name": "Vinhomes Horizon Corporation"}),
                (admin_user, "CREATE", "jobs", 1, AuditLog.Severity.NORMAL, "Created master job JOB-WT-2026", None, {"job_code": "JOB-WT-2026"}),
                (admin_user, "CREATE", "jobs", 2, AuditLog.Severity.NORMAL, "Created master job JOB-WT-APP-2026", None, {"job_code": "JOB-WT-APP-2026"}),
                (admin_user, "CREATE", "jobs", 3, AuditLog.Severity.NORMAL, "Created master job JOB-AI-OPS-2026", None, {"job_code": "JOB-AI-OPS-2026"}),
                (admin_user, "CREATE", "jobs", 4, AuditLog.Severity.NORMAL, "Created master job JOB-CONST-2026", None, {"job_code": "JOB-CONST-2026"}),
                (admin_user, "CREATE", "jobs", 5, AuditLog.Severity.NORMAL, "Created master job JOB-TOWER-2026", None, {"job_code": "JOB-TOWER-2026"}),
                (admin_user, "CREATE", "jobs", 6, AuditLog.Severity.NORMAL, "Created master job JOB-RESORT-2026", None, {"job_code": "JOB-RESORT-2026"}),
                (admin_user, "LOCK_TIMESHEET", "time_locks", 1, AuditLog.Severity.WARNING, "Locked Global Timesheet for 08/2026", {"is_locked": False}, {"is_locked": True, "lock_year": 2026, "lock_month": 8}),
            ]
            for act_user, act, tbl, rec_id, sev, summ, old_v, new_v in audit_events:
                AuditLog.objects.get_or_create(
                    user=act_user,
                    action=act,
                    table_name=tbl,
                    record_id=rec_id,
                    defaults={
                        "severity": sev,
                        "summary": summ,
                        "old_values": old_v,
                        "new_values": new_v,
                    }
                )

        self.stdout.write(self.style.SUCCESS(
            "=== Master Enterprise Dataset Successfully Seeded! (6 Jobs, 103 Tasks, Full Scenarios, No ON_HOLD) ==="
        ))