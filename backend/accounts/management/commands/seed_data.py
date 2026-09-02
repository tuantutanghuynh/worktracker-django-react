import random
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.contrib.auth.hashers import make_password

from accounts.models import CustomUser, Role, Department, EmployeeProfile
from projects.models import Client, Job
from tasks.models import Task, TaskFollower, TaskComment, TaskAttachment
from timesheets.models import LogWork, TimeLock, DailyUserTimesheet
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet
from chat.models import ChatRoom, ChatParticipant, ChatMessage
from system.models import AuditLog, Notification
from tasks.services.order_index_manager_service import key_between


class Command(BaseCommand):
    help = "Seed standard demo dataset (20 employees, 2 managers, 5 jobs, edge cases: locked client, locked job, August locked period)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe existing tasks, jobs, logworks, and accounts before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== Seeding Standard Enterprise Demo Dataset ==="))

        with transaction.atomic():
            if options['reset']:
                self.stdout.write("Reset flag set. Wiping existing transactional data...")
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
            # 1. ROLES & DEPARTMENTS
            # -----------------------------------------------------------------
            self.stdout.write("1. Setting up Roles & Departments...")
            role_admin, _ = Role.objects.get_or_create(code="ADMIN", defaults={"name": "System Administrator", "description": "Full system management"})
            role_manager, _ = Role.objects.get_or_create(code="MANAGER", defaults={"name": "Project Manager", "description": "Project and team leadership"})
            role_employee, _ = Role.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Software Engineer", "description": "Task execution and time logging"})

            dept_it, _ = Department.objects.get_or_create(name="Information Technology", defaults={"description": "Software architecture and engineering"})
            dept_mkt, _ = Department.objects.get_or_create(name="Digital Marketing", defaults={"description": "Growth, branding, and content campaigns"})
            dept_hr, _ = Department.objects.get_or_create(name="Human Resources", defaults={"description": "Talent acquisition and operations"})
            dept_design, _ = Department.objects.get_or_create(name="UI/UX Design", defaults={"description": "Product design and design system"})

            # Pre-hash common passwords for optimal performance
            pw_admin = make_password("Admin12345!")
            pw_manager = make_password("Manager12345!")
            pw_employee = make_password("Emp12345!")

            # -----------------------------------------------------------------
            # 2. ACCOUNTS (1 ADMIN, 2 MANAGERS, 20 EMPLOYEES)
            # -----------------------------------------------------------------
            self.stdout.write("2. Seeding Accounts (1 Admin, 2 Managers, 20 Employees)...")

            # 🛡️ ADMIN USER
            admin_user, _ = CustomUser.objects.get_or_create(
                email="admin@worktracker.vn",
                defaults={
                    "role": role_admin,
                    "is_staff": True,
                    "is_superuser": True,
                    "is_active": True,
                    "must_change_password": False,
                    "password": pw_admin,
                }
            )
            EmployeeProfile.objects.get_or_create(
                user=admin_user,
                defaults={
                    "full_name": "System Administrator",
                    "department": dept_it,
                    "phone_number": "+84 901 000 001",
                    "joined_date": date(2025, 1, 1),
                }
            )

            # 💼 MANAGER 1 (IT / Engineering Lead)
            manager1, _ = CustomUser.objects.get_or_create(
                email="manager@worktracker.vn",
                defaults={
                    "role": role_manager,
                    "is_active": True,
                    "must_change_password": False,
                    "password": pw_manager,
                }
            )
            EmployeeProfile.objects.get_or_create(
                user=manager1,
                defaults={
                    "full_name": "David Miller",
                    "department": dept_it,
                    "phone_number": "+84 902 000 001",
                    "joined_date": date(2025, 3, 1),
                }
            )

            # 💼 MANAGER 2 (Marketing & Product Lead)
            manager2, _ = CustomUser.objects.get_or_create(
                email="manager2@worktracker.vn",
                defaults={
                    "role": role_manager,
                    "is_active": True,
                    "must_change_password": False,
                    "password": pw_manager,
                }
            )
            EmployeeProfile.objects.get_or_create(
                user=manager2,
                defaults={
                    "full_name": "Sarah Connor",
                    "department": dept_mkt,
                    "phone_number": "+84 902 000 002",
                    "joined_date": date(2025, 4, 1),
                }
            )

            # Update Department heads
            dept_it.manager = manager1
            dept_it.save(update_fields=["manager"])
            dept_mkt.manager = manager2
            dept_mkt.save(update_fields=["manager"])

            # 👨‍💻 20 EMPLOYEES: 10 under Manager 1 (IT), 10 under Manager 2 (Mkt/Design)
            emp_definitions = [
                # 10 under Manager 1
                ("John Smith", "john.smith@worktracker.vn", dept_it, manager1, "+84 903 000 001"),
                ("Emma Johnson", "emma.johnson@worktracker.vn", dept_it, manager1, "+84 903 000 002"),
                ("Michael Brown", "michael.brown@worktracker.vn", dept_it, manager1, "+84 903 000 003"),
                ("Olivia Davis", "olivia.davis@worktracker.vn", dept_it, manager1, "+84 903 000 004"),
                ("William Wilson", "william.wilson@worktracker.vn", dept_it, manager1, "+84 903 000 005"),
                ("Sophia Martinez", "sophia.martinez@worktracker.vn", dept_it, manager1, "+84 903 000 006"),
                ("James Anderson", "james.anderson@worktracker.vn", dept_it, manager1, "+84 903 000 007"),
                ("Ava Taylor", "ava.taylor@worktracker.vn", dept_it, manager1, "+84 903 000 008"),
                ("Lucas Thomas", "lucas.thomas@worktracker.vn", dept_it, manager1, "+84 903 000 009"),
                ("Mia Jackson", "mia.jackson@worktracker.vn", dept_it, manager1, "+84 903 000 010"),
                # 10 under Manager 2
                ("Alexander White", "alexander.white@worktracker.vn", dept_mkt, manager2, "+84 903 000 011"),
                ("Charlotte Harris", "charlotte.harris@worktracker.vn", dept_mkt, manager2, "+84 903 000 012"),
                ("Daniel Martin", "daniel.martin@worktracker.vn", dept_design, manager2, "+84 903 000 013"),
                ("Harper Thompson", "harper.thompson@worktracker.vn", dept_design, manager2, "+84 903 000 014"),
                ("Henry Garcia", "henry.garcia@worktracker.vn", dept_mkt, manager2, "+84 903 000 015"),
                ("Evelyn Robinson", "evelyn.robinson@worktracker.vn", dept_hr, manager2, "+84 903 000 016"),
                ("Sebastian Clark", "sebastian.clark@worktracker.vn", dept_mkt, manager2, "+84 903 000 017"),
                ("Abigail Rodriguez", "abigail.rodriguez@worktracker.vn", dept_design, manager2, "+84 903 000 018"),
                ("Logan Lewis", "logan.lewis@worktracker.vn", dept_mkt, manager2, "+84 903 000 019"),
                ("Emily Lee", "emily.lee@worktracker.vn", dept_design, manager2, "+84 903 000 020"),
            ]

            employee_users = []
            for idx, (name, email, dept, assigned_mgr, phone) in enumerate(emp_definitions):
                emp, created = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={
                        "role": role_employee,
                        "is_active": True,
                        "must_change_password": False,
                        "password": pw_employee,
                    }
                )
                if not created and emp.password != pw_employee:
                    emp.password = pw_employee
                    emp.save(update_fields=["password"])

                joined = date(2025, 6, 1) + timedelta(days=idx * 15)
                profile, _ = EmployeeProfile.objects.get_or_create(
                    user=emp,
                    defaults={
                        "full_name": name,
                        "department": dept,
                        "manager": assigned_mgr,
                        "phone_number": phone,
                        "joined_date": joined,
                    }
                )
                profile.manager = assigned_mgr
                profile.save(update_fields=["manager"])
                employee_users.append(emp)

            # Phân tách danh sách nhân viên theo Manager
            mgr1_employees = [e for e in employee_users if e.profile.manager_id == manager1.id]
            mgr2_employees = [e for e in employee_users if e.profile.manager_id == manager2.id]

            # -----------------------------------------------------------------
            # 3. CLIENTS (4 ACTIVE, 1 LOCKED/INACTIVE)
            # -----------------------------------------------------------------
            self.stdout.write("3. Seeding Clients (4 Active, 1 Locked/Inactive)...")
            client_techcorp, _ = Client.objects.get_or_create(
                client_name="TechCorp Solutions",
                defaults={"tax_code": "0101234567", "industry": "Technology", "address": "72 Le Thanh Ton, Dist 1, HCMC", "is_active": True}
            )
            client_vingroup, _ = Client.objects.get_or_create(
                client_name="VinGroup Digital",
                defaults={"tax_code": "0107654321", "industry": "Real Estate & Retail", "address": "Landmark 81, Binh Thanh, HCMC", "is_active": True}
            )
            client_finance, _ = Client.objects.get_or_create(
                client_name="Global Finance Ltd",
                defaults={"tax_code": "0109998887", "industry": "Banking & Fintech", "address": "Bitexco Tower, Dist 1, HCMC", "is_active": True}
            )
            client_nexus, _ = Client.objects.get_or_create(
                client_name="Nexus Retail Group",
                defaults={"tax_code": "0105554443", "industry": "E-Commerce", "address": "Crescent Mall, Dist 7, HCMC", "is_active": True}
            )
            # 🔒 CLIENT BỊ KHÓA / NGỪNG HỢP TÁC (EDGE CASE)
            client_locked, _ = Client.objects.get_or_create(
                client_name="Apex Logistics Corp",
                defaults={"tax_code": "0103332221", "industry": "Logistics", "address": "Tan Binh Logistics Park, HCMC", "is_active": False}
            )
            client_locked.is_active = False
            client_locked.save(update_fields=["is_active"])

            # -----------------------------------------------------------------
            # 4. JOBS (5 JOBS: Active, Job-locked, Locked-client, Completed)
            # -----------------------------------------------------------------
            self.stdout.write("4. Seeding 5 Master Jobs...")
            # Job 1: Active Enterprise Job under Manager 1
            job1, _ = Job.objects.get_or_create(
                job_code="JOB-ERP-01",
                defaults={
                    "job_name": "ERP Enterprise Implementation",
                    "client": client_techcorp,
                    "manager": manager1,
                    "status": Job.Status.ACTIVE,
                    "priority": Job.Priority.HIGH,
                    "start_date": date(2026, 8, 1),
                    "deadline": date(2026, 11, 30),
                    "description": "Enterprise Resource Planning migration with SAP S/4HANA integration.",
                }
            )

            # Job 2: Mobile Banking under Manager 1 - WILL HAVE JOB-LEVEL TIMELOCK IN AUGUST
            job2, _ = Job.objects.get_or_create(
                job_code="JOB-MOB-02",
                defaults={
                    "job_name": "Mobile Banking Application",
                    "client": client_finance,
                    "manager": manager1,
                    "status": Job.Status.ACTIVE,
                    "priority": Job.Priority.HIGH,
                    "start_date": date(2026, 8, 1),
                    "deadline": date(2026, 10, 31),
                    "description": "Next-generation iOS & Android banking client with biometrics & real-time payments.",
                }
            )

            # Job 3: Cloud DevOps under Manager 1 - ATTACHED TO LOCKED CLIENT (EDGE CASE)
            job3, _ = Job.objects.get_or_create(
                job_code="JOB-CLD-03",
                defaults={
                    "job_name": "Cloud Infrastructure & DevOps",
                    "client": client_locked,  # 🔒 Client is inactive!
                    "manager": manager1,
                    "status": Job.Status.ON_HOLD,
                    "priority": Job.Priority.MEDIUM,
                    "start_date": date(2026, 8, 15),
                    "deadline": date(2026, 12, 15),
                    "description": "Multi-region Kubernetes migration on AWS (On Hold due to client contract freeze).",
                }
            )

            # Job 4: Marketing CRM under Manager 2 - Active
            job4, _ = Job.objects.get_or_create(
                job_code="JOB-CRM-04",
                defaults={
                    "job_name": "Marketing Automation CRM",
                    "client": client_vingroup,
                    "manager": manager2,
                    "status": Job.Status.ACTIVE,
                    "priority": Job.Priority.MEDIUM,
                    "start_date": date(2026, 9, 1),
                    "deadline": date(2026, 11, 15),
                    "description": "Customer lifecycle automation, omnichannel lead scoring, and automated campaigns.",
                }
            )

            # Job 5: Security Audit under Manager 2 - COMPLETED / LOCKED JOB (EDGE CASE)
            job5, _ = Job.objects.get_or_create(
                job_code="JOB-SEC-05",
                defaults={
                    "job_name": "Security & PenTest Audit",
                    "client": client_nexus,
                    "manager": manager2,
                    "status": Job.Status.COMPLETED,  # 🔒 Completed job!
                    "priority": Job.Priority.HIGH,
                    "start_date": date(2026, 7, 1),
                    "deadline": date(2026, 8, 31),
                    "description": "SOC2 Compliance penetration testing and vulnerability mitigation.",
                }
            )

            all_jobs = [job1, job2, job3, job4, job5]

            # -----------------------------------------------------------------
            # 5. TASKS (SPREAD ACROSS AUG, SEPT, OCT, NOV, DEC 2026)
            # -----------------------------------------------------------------
            self.stdout.write("5. Seeding Tasks (Spread across Aug, Sept, Oct, Nov, Dec 2026)...")

            created_tasks = []

            # Tasks Template for Job 1 (Manager 1, IT staff)
            job1_tasks_def = [
                ("Database Schema & Migration Scripts", Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 20), mgr1_employees[0]),
                ("RESTful Integration Layer Setup", Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 28), mgr1_employees[1]),
                ("SAP Core Connector Module", Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 15), mgr1_employees[2]),
                ("Warehouse Inventory Realtime Sync", Task.Status.REVIEWING, Task.Priority.MEDIUM, date(2026, 9, 10), mgr1_employees[3]),
                ("Financial Ledger Reconciliation API", Task.Status.TODO, Task.Priority.HIGH, date(2026, 10, 15), mgr1_employees[4]),
                ("End-of-Year Fiscal Report Generator", Task.Status.TODO, Task.Priority.LOW, date(2026, 11, 20), mgr1_employees[5]),
            ]

            # Tasks Template for Job 2 (Manager 1, IT staff)
            job2_tasks_def = [
                ("Biometric FaceID & TouchID SDK", Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 25), mgr1_employees[6]),
                ("Cardholder Transaction History UI", Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 8), mgr1_employees[7]),
                ("Instant Peer-to-Peer Transfer Engine", Task.Status.IN_PROGRESS, Task.Priority.HIGH, date(2026, 9, 20), mgr1_employees[8]),
                ("Push Notification APNS / FCM Pipeline", Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 10, 10), mgr1_employees[9]),
                ("Quarterly Security Hardening v2", Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 11, 25), mgr1_employees[0]),
            ]

            # Tasks Template for Job 3 (Manager 1, Locked Client)
            job3_tasks_def = [
                ("Terraform Multi-Cloud Baseline", Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 30), mgr1_employees[1]),
                ("Kubernetes Ingress Controller Tuning", Task.Status.TODO, Task.Priority.MEDIUM, date(2026, 12, 1), mgr1_employees[2]),
            ]

            # Tasks Template for Job 4 (Manager 2, Marketing/Design staff)
            job4_tasks_def = [
                ("Campaign Workflow Visual Builder", Task.Status.REVIEWING, Task.Priority.HIGH, date(2026, 9, 12), mgr2_employees[0]),
                ("Customer Segment Dynamic Filtering", Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, date(2026, 9, 25), mgr2_employees[1]),
                ("Omnichannel Email & SMS Templates", Task.Status.TODO, Task.Priority.LOW, date(2026, 10, 5), mgr2_employees[2]),
                ("Holiday Promotion Automated Triggers", Task.Status.TODO, Task.Priority.HIGH, date(2026, 11, 15), mgr2_employees[3]),
                ("Black Friday / New Year Lead Analytics", Task.Status.TODO, Task.Priority.HIGH, date(2026, 12, 20), mgr2_employees[4]),
            ]

            # Tasks Template for Job 5 (Manager 2, Completed Job)
            job5_tasks_def = [
                ("External Penetration Vulnerability Scan", Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 15), mgr2_employees[5]),
                ("SOC2 Audit Compliance Remediation", Task.Status.COMPLETED, Task.Priority.HIGH, date(2026, 8, 30), mgr2_employees[6]),
            ]

            all_tasks_specs = [
                (job1, job1_tasks_def),
                (job2, job2_tasks_def),
                (job3, job3_tasks_def),
                (job4, job4_tasks_def),
                (job5, job5_tasks_def),
            ]

            for target_job, task_list in all_tasks_specs:
                last_keys = {}
                for idx, (title, st, pr, deadline, assignee) in enumerate(task_list):
                    prev_key = last_keys.get(st)
                    new_lexo = key_between(prev_key, None)
                    last_keys[st] = new_lexo

                    t, _ = Task.objects.get_or_create(
                        title=title,
                        job=target_job,
                        defaults={
                            "creator": target_job.manager,
                            "assignee": assignee,
                            "status": st,
                            "priority": pr,
                            "deadline": deadline,
                            "order_index": new_lexo,
                            "description": f"Execution specifications for '{title}' under project {target_job.job_name}.",
                        }
                    )
                    created_tasks.append(t)
                    TaskFollower.objects.get_or_create(task=t, user=target_job.manager)
                    TaskFollower.objects.get_or_create(task=t, user=assignee)

                    # Deliverables / Attachments for REVIEWING tasks (để Manager có deliverables duyệt QA)
                    if st == Task.Status.REVIEWING:
                        TaskAttachment.objects.get_or_create(
                            task=t,
                            file_name=f"deliverable_release_v1_{t.id}.pdf",
                            defaults={
                                "file_url": f"https://example.com/files/deliverable_release_v1_{t.id}.pdf",
                                "file_size": 2048576,
                                "user": assignee,
                            }
                        )
                        TaskComment.objects.get_or_create(
                            task=t,
                            user=target_job.manager,
                            content=f"Deliverable specs reviewed for '{title}'. Ready for final acceptance verification.",
                            defaults={"comment_type": TaskComment.CommentType.NORMAL},
                        )
                    else:
                        TaskComment.objects.get_or_create(
                            task=t,
                            user=assignee,
                            content=f"Initial draft & module implementation for '{title}' actively underway.",
                            defaults={"comment_type": TaskComment.CommentType.NORMAL},
                        )

            # -----------------------------------------------------------------
            # 6. TIMESHEET LOGWORKS (AUGUST APPROVED, SEPTEMBER PENDING/REVIEW)
            # -----------------------------------------------------------------
            self.stdout.write("6. Seeding Timesheets (August past records + September active records)...")

            # 6.1. Tháng 8/2026: Ghi công quá khứ (ĐÃ DUYỆT - APPROVED)
            august_dates = [date(2026, 8, 25), date(2026, 8, 26), date(2026, 8, 27)]
            for emp in employee_users:
                emp_tasks = [t for t in created_tasks if t.assignee_id == emp.id]
                if not emp_tasks:
                    continue
                chosen_task = emp_tasks[0]

                for w_date in august_dates:
                    LogWork.objects.get_or_create(
                        task=chosen_task,
                        user=emp,
                        work_date=w_date,
                        defaults={
                            "hours_spent": Decimal("8.0"),
                            "description": f"Completed sprint deliverables in August for {chosen_task.title}.",
                            "review_status": LogWork.ReviewStatus.APPROVED,
                            "reviewed_by": emp.profile.manager or manager1,
                            "review_note": "Reconciled and approved for August payroll.",
                        }
                    )
                    rebuild_daily_user_timesheet(user_id=emp.id, work_date=w_date)

            # 6.2. Tháng 9/2026: Kỳ công hiện tại (PENDING & APPROVED & REJECTED)
            sept_dates = [date(2026, 9, 1), date(2026, 9, 2)]
            for idx, emp in enumerate(employee_users):
                emp_tasks = [t for t in created_tasks if t.assignee_id == emp.id]
                if not emp_tasks:
                    continue
                chosen_task = emp_tasks[0]

                # Ngày 01/09: PENDING để Manager vào duyệt
                LogWork.objects.get_or_create(
                    task=chosen_task,
                    user=emp,
                    work_date=sept_dates[0],
                    defaults={
                        "hours_spent": Decimal("8.0"),
                        "description": f"Active feature development and testing on {chosen_task.title}.",
                        "review_status": LogWork.ReviewStatus.PENDING,
                    }
                )
                rebuild_daily_user_timesheet(user_id=emp.id, work_date=sept_dates[0])

                # Ngày 02/09: Pha trộn PENDING, APPROVED, REJECTED
                status_choice = LogWork.ReviewStatus.PENDING if idx % 3 == 0 else (
                    LogWork.ReviewStatus.APPROVED if idx % 3 == 1 else LogWork.ReviewStatus.REJECTED
                )
                LogWork.objects.get_or_create(
                    task=chosen_task,
                    user=emp,
                    work_date=sept_dates[1],
                    defaults={
                        "hours_spent": Decimal("7.5"),
                        "description": f"Refactoring & QA inspection for {chosen_task.title}.",
                        "review_status": status_choice,
                        "reviewed_by": emp.profile.manager if status_choice != LogWork.ReviewStatus.PENDING else None,
                        "review_note": "Approved" if status_choice == LogWork.ReviewStatus.APPROVED else (
                            "Please clarify task deliverables." if status_choice == LogWork.ReviewStatus.REJECTED else None
                        ),
                    }
                )
                rebuild_daily_user_timesheet(user_id=emp.id, work_date=sept_dates[1])

            # -----------------------------------------------------------------
            # 7. TIMELOCKS (THÁNG 8 ĐÃ KHÓA GLOBAL & JOB LEVEL)
            # -----------------------------------------------------------------
            self.stdout.write("7. Seeding TimeLocks (August 2026 Locked Global + Job Scope)...")

            # 🔒 Global Lock Tháng 8/2026 (Admin Khóa toàn công ty)
            TimeLock.objects.get_or_create(
                job=None,
                lock_scope=TimeLock.LockScope.GLOBAL,
                lock_year=2026,
                lock_month=8,
                defaults={
                    "is_locked": True,
                    "locked_by": admin_user,
                    "lock_reason": "Company-wide fiscal period August 2026 finalized and frozen for payroll.",
                }
            )

            # 🔒 Job Scope Lock Tháng 8/2026 (Job 2 Khóa sớm nghiệm thu)
            TimeLock.objects.get_or_create(
                job=job2,
                lock_scope=TimeLock.LockScope.JOB,
                lock_year=2026,
                lock_month=8,
                defaults={
                    "is_locked": True,
                    "locked_by": manager1,
                    "lock_reason": "Early acceptance cutoff signed with Global Finance on 25 August 2026.",
                }
            )

            # -----------------------------------------------------------------
            # 8. CHAT CHANNELS & NOTIFICATIONS
            # -----------------------------------------------------------------
            self.stdout.write("8. Seeding Chat Rooms & Realtime Notifications...")
            for j in [job1, job2, job4]:
                room, _ = ChatRoom.objects.get_or_create(
                    name=f"Project Room - {j.job_name}",
                    room_type=ChatRoom.RoomType.JOB,
                    job=j,
                )
                ChatParticipant.objects.get_or_create(room=room, user=j.manager)
                ChatParticipant.objects.get_or_create(room=room, user=admin_user)
                ChatMessage.objects.get_or_create(
                    room=room,
                    sender=j.manager,
                    content=f"Welcome to {j.job_name} sprint channel. Please coordinate deliverable handovers here.",
                )

            # Notifications
            Notification.objects.get_or_create(
                user=admin_user,
                event_type=Notification.EventType.TIMESHEET_LOCK,
                title="Global Period Lock Active",
                defaults={
                    "content": "August 2026 payroll timesheet cycle is completely locked.",
                    "related_url": "/admin/timesheets",
                    "is_read": True,
                }
            )
            Notification.objects.get_or_create(
                user=manager1,
                event_type=Notification.EventType.TASK_ASSIGNED,
                title="Sprint Deliverables Pending QA",
                defaults={
                    "content": "Deliverables for ERP & Mobile Banking are ready in your review queue.",
                    "related_url": "/manager/tasks/review",
                    "is_read": False,
                }
            )

        self.stdout.write(self.style.SUCCESS("=== Standard Enterprise Demo Dataset Seeded Successfully! ==="))
        self.stdout.write("Accounts created:")
        self.stdout.write("  Admin:     admin@worktracker.vn / Admin12345!")
        self.stdout.write("  Manager 1: manager@worktracker.vn / Manager12345! (10 IT Staff)")
        self.stdout.write("  Manager 2: manager2@worktracker.vn / Manager12345! (10 Marketing/Design Staff)")
        self.stdout.write("  Employees: john.smith@worktracker.vn ... emily.lee@worktracker.vn / Emp12345!")
        self.stdout.write("Time distribution:")
        self.stdout.write("  - August 2026: LOCKED (Global & Job Lock) with approved logs")
        self.stdout.write("  - September 2026: OPEN with Pending/Review logworks & QA deliverables")
        self.stdout.write("  - Oct, Nov, Dec 2026: Future scheduled milestone tasks")