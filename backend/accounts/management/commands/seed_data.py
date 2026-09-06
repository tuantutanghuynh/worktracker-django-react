"""
Module: accounts.management.commands.seed_data
Description: Master Enterprise Seed Script populating IT (WorkTracker Core) and Construction (Greenfield Luxury Villa).
Supports full table-reset, RBAC mapping, Gantt lifecycle tasks, TimeLocks, LogWork hours, Chat channels, and Notifications.
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
    help = "Seed enterprise master dataset (IT & Construction domains, 1 Client = 1 Manager = 1 Job)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe all existing transactional data and accounts before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== Seeding Master Enterprise Dataset (IT & Construction) ==="))

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
            # 1. ROLES, PERMISSIONS & RBAC MAPPINGS (Single Source of Truth: seed_roles)
            # -----------------------------------------------------------------
            self.stdout.write("1. Setting up Roles, Permissions & RBAC mappings via seed_roles...")
            from django.core.management import call_command
            call_command('seed_roles')

            role_admin = Role.objects.get(code="ADMIN")
            role_manager = Role.objects.get(code="MANAGER")
            role_employee = Role.objects.get(code="EMPLOYEE")

            # -----------------------------------------------------------------
            # 2. DEPARTMENTS SETUP
            # -----------------------------------------------------------------
            self.stdout.write("2. Creating Specialized Departments...")
            dept_se, _ = Department.objects.get_or_create(name="Software Engineering Department", defaults={"description": "Backend architecture, Django REST APIs & React development"})
            dept_qa, _ = Department.objects.get_or_create(name="Quality Assurance & Testing Department", defaults={"description": "Automated Pytest suites, performance testing & CI/CD validation"})
            dept_design, _ = Department.objects.get_or_create(name="UI/UX Product Design Department", defaults={"description": "User experience research, design system & interface ergonomics"})
            dept_devops, _ = Department.objects.get_or_create(name="Cloud Infrastructure & DevOps Department", defaults={"description": "Server reliability, Redis caching, Docker & cloud deployment"})
            dept_const, _ = Department.objects.get_or_create(name="Civil & Construction Engineering Department", defaults={"description": "Site survey, structural framing, MEP installation & villa finishing"})

            # Pre-hash standard password
            standard_password = make_password("Password123@")

            # -----------------------------------------------------------------
            # 3. ACCOUNTS (1 ADMIN, 2 MANAGERS, 14 EMPLOYEES)
            # -----------------------------------------------------------------
            self.stdout.write("3. Seeding Accounts (1 Admin, 2 Managers, 14 Specialized Employees)...")

            # 🛡️ ADMIN
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

            # 💼 MANAGER 1: IT Project Manager (David Miller)
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

            # 💼 MANAGER 2: Construction Project Director (Marcus Vance)
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

            # 👨‍💻 8 IT EMPLOYEES (Under David Miller)
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

            # 🏗️ 6 CONSTRUCTION EMPLOYEES (Under Marcus Vance)
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
            # 4. CLIENTS & JOBS
            # -----------------------------------------------------------------
            self.stdout.write("4. Seeding Clients & Master Jobs...")

            # Client 1: IT Client
            client_it, _ = Client.objects.get_or_create(
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

            # Job 1: WorkTracker Core Platform (Manager: David Miller)
            job_it, _ = Job.objects.get_or_create(
                job_code="JOB-WT-2026",
                defaults={
                    "job_name": "WorkTracker Core — Enterprise Project & Timesheet Governance Platform",
                    "client": client_it,
                    "manager": manager_it,
                    "priority": Job.Priority.HIGH,
                    "status": Job.Status.ACTIVE,
                    "start_date": date(2026, 8, 1),
                    "deadline": date(2026, 10, 31),
                    "description": "Multi-tenant role-based project and timesheet governance platform for enterprise teams.",
                }
            )

            # Client 2: Construction Client
            client_const, _ = Client.objects.get_or_create(
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

            # Job 2: Greenfield Luxury Villa (Manager: Marcus Vance)
            job_const, _ = Job.objects.get_or_create(
                job_code="JOB-CONST-2026",
                defaults={
                    "job_name": "Greenfield Luxury Villa — Turnkey Construction & Interior Finishing",
                    "client": client_const,
                    "manager": manager_const,
                    "priority": Job.Priority.HIGH,
                    "status": Job.Status.ACTIVE,
                    "start_date": date(2026, 8, 15),
                    "deadline": date(2026, 10, 15),
                    "description": "Turnkey construction of 3-story luxury villa including structural framing, MEP, and interior finishing.",
                }
            )

            # -----------------------------------------------------------------
            # 5. TASKS (24 GANTT TASKS ACROSS 2 JOBS)
            # -----------------------------------------------------------------
            self.stdout.write("5. Seeding Gantt Chart Tasks (IT & Construction)...")

            # Helper for order index
            def make_order_keys(n):
                keys = []
                prev = None
                for _ in range(n):
                    k = key_between(prev, None)
                    keys.append(k)
                    prev = k
                return keys

            # 14 Tasks for Job IT (All have assignees)
            it_task_defs = [
                # Phase 1: Completed
                ("Database Schema Design, Django Migrations & ERD", it_employees["john.smith@worktracker.vn"], Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 1), date(2026, 8, 10), timezone.now() - timedelta(days=25)),
                ("JWT Authentication, RBAC Permissions & Token Blacklist", it_employees["michael.brown@worktracker.vn"], Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 5), date(2026, 8, 18), timezone.now() - timedelta(days=19)),
                ("React 19 Frontend Shell, Tailwind v4 Theme & Drawer UI", it_employees["emma.johnson@worktracker.vn"], Task.Status.COMPLETED, Task.Priority.MEDIUM, date(2026, 8, 10), date(2026, 8, 25), timezone.now() - timedelta(days=12)),
                ("Multi-Channel Support Desk & WebSocket Gateway", it_employees["william.wilson@worktracker.vn"], Task.Status.COMPLETED, Task.Priority.MEDIUM, date(2026, 8, 18), date(2026, 8, 30), timezone.now() - timedelta(days=7)),
                # Phase 2: Active / Current
                ("React Kanban Board & Drag-and-Drop Order Index", it_employees["sophia.martinez@worktracker.vn"], Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 12), None),
                ("Timesheet Daily 8-Hour Cap & Multi-Role Review Flow", it_employees["john.smith@worktracker.vn"], Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 10), None),
                ("Manager Workload Utilization & Capacity Metrics Engine", it_employees["michael.brown@worktracker.vn"], Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 4), date(2026, 9, 15), None),
                ("Automated Pytest Suite (372 cases) & CI Validation", it_employees["olivia.davis@worktracker.vn"], Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 3), date(2026, 9, 14), None),
                ("Employee 30-Day Performance Radar & KPI Analytics", it_employees["emma.johnson@worktracker.vn"], Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 5), date(2026, 9, 18), None),
                # Phase 3: Upcoming
                ("Global TimeLock Auto-Lock Cron & Admin Unlock Audit", it_employees["james.anderson@worktracker.vn"], Task.Status.TODO, Task.Priority.HIGH, date(2026, 9, 15), date(2026, 9, 28), None),
                ("PDF & Excel Enterprise Export Engine for Timesheets", it_employees["ava.taylor@worktracker.vn"], Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 20), date(2026, 10, 5), None),
                # Phase 4: Backlog / Future Sprints
                ("Redis Multi-Node Cluster & Distributed Cache Eviction", it_employees["william.wilson@worktracker.vn"], Task.Status.TODO, Task.Priority.LOW, date(2026, 9, 25), date(2026, 10, 15), None),
                ("SOC2 Audit Compliance Trail & Vulnerability Scan", it_employees["michael.brown@worktracker.vn"], Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 1), date(2026, 10, 25), None),
                ("Release Candidate Packaging & User Acceptance Testing", it_employees["olivia.davis@worktracker.vn"], Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 20), date(2026, 10, 31), None),
            ]

            it_order_keys = make_order_keys(len(it_task_defs))
            it_tasks = []
            for idx, (title, assignee, status, priority, s_date, d_date, comp_at) in enumerate(it_task_defs):
                task, _ = Task.objects.get_or_create(
                    title=title,
                    job=job_it,
                    defaults={
                        "creator": manager_it,
                        "assignee": assignee,
                        "status": status,
                        "priority": priority,
                        "start_date": s_date,
                        "deadline": d_date,
                        "completed_at": comp_at,
                        "order_index": it_order_keys[idx],
                        "description": f"Deliverable scope for {title} under WorkTracker Core Platform.",
                    }
                )
                if assignee:
                    TaskFollower.objects.get_or_create(task=task, user=assignee)
                TaskFollower.objects.get_or_create(task=task, user=manager_it)
                it_tasks.append(task)

            # 10 Tasks for Job Construction
            const_task_defs = [
                # Phase 1: Completed
                ("Topographic Site Survey, Foundation Excavation & Pile Cap Pouring", const_employees["nathan.ward@worktracker.vn"], Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 15), date(2026, 8, 23), timezone.now() - timedelta(days=14)),
                ("Ground Floor Reinforced Concrete Slab & Waterproof Membrane", const_employees["brian.miller@worktracker.vn"], Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 20), date(2026, 8, 31), timezone.now() - timedelta(days=6)),
                # Phase 2: Active / Current
                ("Second Floor Structural Column Formwork & Concrete Pouring", const_employees["brian.miller@worktracker.vn"], Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 1), date(2026, 9, 10), None),
                ("Underground Plumbing Pipe Conduits & Electrical Wiring Rough-In", const_employees["ethan.ross@worktracker.vn"], Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 3), date(2026, 9, 12), None),
                ("Roof Steel Truss Fabrication, Insulation & Terracotta Tiling", const_employees["nathan.ward@worktracker.vn"], Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 5), date(2026, 9, 18), None),
                ("HSE Site Safety Scaffolding Inspection & Fall Protection Audit", const_employees["grace.hall@worktracker.vn"], Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 2), date(2026, 9, 8), None),
                # Phase 3: Upcoming
                ("Italian Marble Floor Tiling & Moisture-Proof Wall Plastering", const_employees["chloe.bennett@worktracker.vn"], Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 20), date(2026, 9, 30), None),
                ("Smart Home Central HVAC Ducting & Recessed Lighting Setup", const_employees["ethan.ross@worktracker.vn"], Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 9, 25), date(2026, 10, 5), None),
                # Phase 4: Backlog / Future Stages
                ("Infinity Swimming Pool Filtration & Landscape Garden Masonry", const_employees["zoe.foster@worktracker.vn"], Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 5), date(2026, 10, 12), None),
                ("Structural Load Bearing Certification & Fire Safety Handover Audit", const_employees["brian.miller@worktracker.vn"], Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 10), date(2026, 10, 15), None),
            ]

            const_order_keys = make_order_keys(len(const_task_defs))
            const_tasks = []
            for idx, (title, assignee, status, priority, s_date, d_date, comp_at) in enumerate(const_task_defs):
                task, _ = Task.objects.get_or_create(
                    title=title,
                    job=job_const,
                    defaults={
                        "creator": manager_const,
                        "assignee": assignee,
                        "status": status,
                        "priority": priority,
                        "start_date": s_date,
                        "deadline": d_date,
                        "completed_at": comp_at,
                        "order_index": const_order_keys[idx],
                        "description": f"Site specifications for {title} under Greenfield Luxury Villa.",
                    }
                )
                if assignee:
                    TaskFollower.objects.get_or_create(task=task, user=assignee)
                TaskFollower.objects.get_or_create(task=task, user=manager_const)
                const_tasks.append(task)

            # -----------------------------------------------------------------
            # 6. LOGWORK, TIMESHEETS & TIMELOCK ENFORCEMENT
            # -----------------------------------------------------------------
            self.stdout.write("6. Generating Verified LogWork Records & TimeLocks...")

            # August 2026 Global TimeLock
            TimeLock.objects.get_or_create(
                lock_year=2026,
                lock_month=8,
                lock_scope=TimeLock.LockScope.GLOBAL,
                job=None,
                defaults={
                    "is_locked": True,
                    "locked_by": admin_user,
                    "locked_at": timezone.now() - timedelta(days=6),
                    "lock_reason": "Chốt sổ tài chính kế toán Tháng 08/2026 toàn công ty",
                }
            )

            # LogWork entries (August & September)
            logwork_entries = [
                # IT August Logs (Approved)
                (it_tasks[0], it_employees["john.smith@worktracker.vn"], date(2026, 8, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Designed core tables and foreign key relations."),
                (it_tasks[0], it_employees["john.smith@worktracker.vn"], date(2026, 8, 5), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented initial database migrations."),
                (it_tasks[1], it_employees["michael.brown@worktracker.vn"], date(2026, 8, 8), "7.50", LogWork.ReviewStatus.APPROVED, manager_it, "Built JWT refresh and blacklist middleware."),
                (it_tasks[2], it_employees["emma.johnson@worktracker.vn"], date(2026, 8, 15), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Configured Tailwind CSS v4 and drawer layout."),
                (it_tasks[3], it_employees["william.wilson@worktracker.vn"], date(2026, 8, 22), "6.00", LogWork.ReviewStatus.APPROVED, manager_it, "Tested WebSocket live chat support channel."),

                # IT September Logs (Active/In-Progress)
                (it_tasks[4], it_employees["sophia.martinez@worktracker.vn"], date(2026, 9, 1), "6.00", LogWork.ReviewStatus.APPROVED, manager_it, "Developed Kanban board columns and DnD context."),
                (it_tasks[4], it_employees["sophia.martinez@worktracker.vn"], date(2026, 9, 2), "7.50", LogWork.ReviewStatus.APPROVED, manager_it, "Implemented fractional ordering index algorithm."),
                (it_tasks[4], it_employees["sophia.martinez@worktracker.vn"], date(2026, 9, 3), "8.00", LogWork.ReviewStatus.APPROVED, manager_it, "Connected Kanban drag actions to patch API."),
                (it_tasks[4], it_employees["sophia.martinez@worktracker.vn"], date(2026, 9, 4), "6.50", LogWork.ReviewStatus.PENDING, None, "Refined mobile responsive drawer gestures."),
                (it_tasks[4], it_employees["sophia.martinez@worktracker.vn"], date(2026, 9, 5), "7.00", LogWork.ReviewStatus.PENDING, None, "Handled Kanban optimistic UI updates and rollbacks."),
                (it_tasks[5], it_employees["john.smith@worktracker.vn"], date(2026, 9, 2), "8.00", LogWork.ReviewStatus.PENDING, None, "Created 8-hour daily cap validation service."),
                (it_tasks[5], it_employees["john.smith@worktracker.vn"], date(2026, 9, 3), "8.00", LogWork.ReviewStatus.PENDING, None, "Built manager review and voiding endpoints."),
                (it_tasks[6], it_employees["michael.brown@worktracker.vn"], date(2026, 9, 4), "6.00", LogWork.ReviewStatus.APPROVED, manager_it, "Aggregated team workload hours across jobs."),
                (it_tasks[7], it_employees["olivia.davis@worktracker.vn"], date(2026, 9, 3), "8.00", LogWork.ReviewStatus.PENDING, None, "Automated 372 unit test suites on CI."),

                # Construction August Logs (Approved)
                (const_tasks[0], const_employees["nathan.ward@worktracker.vn"], date(2026, 8, 16), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Surveyed topographical elevation and set site datum."),
                (const_tasks[0], const_employees["nathan.ward@worktracker.vn"], date(2026, 8, 18), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Supervised hydraulic pile driving test loading."),
                (const_tasks[1], const_employees["brian.miller@worktracker.vn"], date(2026, 8, 22), "7.50", LogWork.ReviewStatus.APPROVED, manager_const, "Inspected rebar tying for ground floor slab."),
                (const_tasks[1], const_employees["brian.miller@worktracker.vn"], date(2026, 8, 25), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Poured 120m3 grade-300 concrete for basement."),

                # Construction September Logs (Active/In-Progress)
                (const_tasks[2], const_employees["brian.miller@worktracker.vn"], date(2026, 9, 1), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Erected formwork for second-floor structural columns."),
                (const_tasks[2], const_employees["brian.miller@worktracker.vn"], date(2026, 9, 2), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Verified concrete slump test 12cm before pump."),
                (const_tasks[2], const_employees["brian.miller@worktracker.vn"], date(2026, 9, 3), "8.00", LogWork.ReviewStatus.APPROVED, manager_const, "Cured second-floor concrete slab with burlap covers."),
                (const_tasks[3], const_employees["ethan.ross@worktracker.vn"], date(2026, 9, 3), "7.00", LogWork.ReviewStatus.PENDING, None, "Laid PVC drainage pipes and electrical conduits in ground floor."),
                (const_tasks[5], const_employees["grace.hall@worktracker.vn"], date(2026, 9, 2), "6.00", LogWork.ReviewStatus.APPROVED, manager_const, "Inspected perimeter safety netting and scaffolding clips."),
            ]

            rebuild_targets = set()
            for task_obj, user_obj, w_date, hrs, r_status, rev_by, desc in logwork_entries:
                LogWork.objects.get_or_create(
                    task=task_obj,
                    user=user_obj,
                    work_date=w_date,
                    hours_spent=Decimal(hrs),
                    defaults={
                        "description": desc,
                        "review_status": r_status,
                        "reviewed_by": rev_by,
                        "reviewed_at": timezone.now() - timedelta(days=1) if rev_by else None,
                    }
                )
                rebuild_targets.add((user_obj.id, w_date))

            # Rebuild daily aggregates
            for uid, dt in rebuild_targets:
                rebuild_daily_user_timesheet(uid, dt)

            # -----------------------------------------------------------------
            # 7. CHAT CHANNELS, COMMENTS, NOTIFICATIONS & AUDIT LOGS
            # -----------------------------------------------------------------
            self.stdout.write("7. Initializing Chat Rooms, Comments, Notifications & Audit Logs...")

            # 1. Job 1 Chat Room (IT)
            room_it, _ = ChatRoom.objects.get_or_create(
                room_type=ChatRoom.RoomType.JOB,
                job=job_it,
                defaults={"name": "[JOB-WT-2026] WorkTracker Core Team"}
            )
            ChatParticipant.objects.get_or_create(room=room_it, user=manager_it)
            for u in it_employees.values():
                ChatParticipant.objects.get_or_create(room=room_it, user=u)

            ChatMessage.objects.get_or_create(
                room=room_it,
                sender=manager_it,
                content="Chào cả team, mục tiêu Sprint tháng 9 là hoàn thiện Kanban Drag-and-Drop và tính năng TimeLock.",
            )
            ChatMessage.objects.get_or_create(
                room=room_it,
                sender=it_employees["sophia.martinez@worktracker.vn"],
                content="Em đã hoàn thành cấu trúc Order Index cho Kanban, đang hoàn thiện UI và optimistic updates.",
            )

            # 2. Job 2 Chat Room (Construction)
            room_const, _ = ChatRoom.objects.get_or_create(
                room_type=ChatRoom.RoomType.JOB,
                job=job_const,
                defaults={"name": "[JOB-CONST-2026] Greenfield Villa Construction Site Team"}
            )
            ChatParticipant.objects.get_or_create(room=room_const, user=manager_const)
            for u in const_employees.values():
                ChatParticipant.objects.get_or_create(room=room_const, user=u)

            ChatMessage.objects.get_or_create(
                room=room_const,
                sender=manager_const,
                content="Kỹ sư Brian chú ý kiểm tra độ sụt bê tông mác 300 trước khi bơm lên sàn tầng 2 nhé.",
            )
            ChatMessage.objects.get_or_create(
                room=room_const,
                sender=const_employees["brian.miller@worktracker.vn"],
                content="Báo cáo Chỉ huy trưởng, xe bồn đã vào vị trí, mẫu thử đạt chuẩn 12±2cm.",
            )

            # 3. Support Desk 1-on-1 (Sophia <-> Admin)
            room_support, _ = ChatRoom.objects.get_or_create(
                room_type=ChatRoom.RoomType.DIRECT,
                name="Support: Sophia Martinez & Admin",
            )
            ChatParticipant.objects.get_or_create(room=room_support, user=admin_user)
            ChatParticipant.objects.get_or_create(room=room_support, user=it_employees["sophia.martinez@worktracker.vn"])

            ChatMessage.objects.get_or_create(
                room=room_support,
                sender=it_employees["sophia.martinez@worktracker.vn"],
                content="Nhờ Admin cấp quyền truy cập Redis staging server để test benchmark hiệu năng.",
            )
            ChatMessage.objects.get_or_create(
                room=room_support,
                sender=admin_user,
                content="Đã cấp quyền qua VPN gateway, em kiểm tra kết nối lại nhé.",
            )

            # 4. Task Comments
            TaskComment.objects.get_or_create(
                task=it_tasks[0],
                user=it_employees["john.smith@worktracker.vn"],
                defaults={"content": "Đã hoàn tất 34 migration files và tài liệu ERD trong thư mục docs/."}
            )
            TaskComment.objects.get_or_create(
                task=it_tasks[5],
                user=manager_it,
                defaults={"content": "Đã review logic 8h/ngày, cần bổ sung test case cho edge case đổi múi giờ."}
            )
            TaskComment.objects.get_or_create(
                task=const_tasks[1],
                user=const_employees["brian.miller@worktracker.vn"],
                defaults={"content": "Đã nghiệm thu màng chống thấm Sika, không phát hiện rò rỉ sau khi thử nước 24h."}
            )

            # 5. Notifications for Sophia Martinez
            sophia_user = it_employees["sophia.martinez@worktracker.vn"]
            notif_data = [
                (Notification.EventType.TASK_ASSIGNED, "Phân công công việc mới", "Bạn đã được phân công vào công việc WT-05: React Kanban Board & Drag-and-Drop Order Index", f"/employee/tasks/{it_tasks[4].id}", 5, True),
                (Notification.EventType.LOG_WORK_APPROVED, "Giờ làm việc đã được duyệt", "Bản ghi 8.0 giờ ngày 03/09 của bạn trên task WT-05 đã được duyệt bởi David Miller", "/employee/timesheet", 3, True),
                (Notification.EventType.TASK_COMMENT, "Bình luận mới trên công việc", "David Miller đã bình luận trên công việc WT-06 mà bạn đang theo dõi", f"/employee/tasks/{it_tasks[5].id}", 2, False),
                (Notification.EventType.TIMESHEET_LOCK, "Kỳ công đã bị khóa", "Kỳ công Tháng 08/2026 đã được chốt sổ bởi System Administrator", "/employee/timesheet", 6, True),
            ]
            for evt, title, content, url, days_ago, is_read in notif_data:
                Notification.objects.get_or_create(
                    user=sophia_user,
                    title=title,
                    defaults={
                        "type": Notification.ChannelType.SYSTEM_ONLY,
                        "event_type": evt,
                        "content": content,
                        "related_url": url,
                        "is_read": is_read,
                        "created_at": timezone.now() - timedelta(days=days_ago),
                    }
                )

            # 6. Audit Logs
            audit_events = [
                (admin_user, "CREATE", "clients", 1, AuditLog.Severity.NORMAL, "Created client TechCore Innovations Corp", None, {"client_name": "TechCore Innovations Corp", "tax_code": "0101234567"}),
                (admin_user, "CREATE", "clients", 2, AuditLog.Severity.NORMAL, "Created client Summit Horizon Construction Corp", None, {"client_name": "Summit Horizon Construction Corp", "tax_code": "0102345678"}),
                (admin_user, "CREATE", "jobs", 1, AuditLog.Severity.NORMAL, "Created master job JOB-WT-2026", None, {"job_code": "JOB-WT-2026", "manager": "manager@worktracker.vn"}),
                (admin_user, "CREATE", "jobs", 2, AuditLog.Severity.NORMAL, "Created master job JOB-CONST-2026", None, {"job_code": "JOB-CONST-2026", "manager": "manager.construction@worktracker.vn"}),
                (admin_user, "LOCK_TIMESHEET", "time_locks", 1, AuditLog.Severity.WARNING, "Locked Global Timesheet for 08/2026", {"is_locked": False}, {"is_locked": True, "lock_year": 2026, "lock_month": 8}),
                (manager_it, "UPDATE", "jobs", 1, AuditLog.Severity.NORMAL, "Activated project sprint", {"status": "PLANNING"}, {"status": "ACTIVE"}),
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
            "=== Enterprise Master Dataset (IT & Construction) Successfully Seeded! ==="
        ))