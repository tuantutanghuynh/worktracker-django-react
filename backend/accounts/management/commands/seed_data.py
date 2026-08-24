import random
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction, connection

from accounts.models import CustomUser, Role, Department, EmployeeProfile
from projects.models import Client, Job
from tasks.models import Task, TaskFollower, TaskComment, TaskAttachment
from timesheets.models import LogWork, TimeLock, DailyUserTimesheet
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet
from chat.models import ChatRoom, ChatParticipant, ChatMessage
from system.models import AuditLog, Notification
from tasks.services.order_index_manager_service import key_between


class Command(BaseCommand):
    help = "Seed comprehensive enterprise demo dataset in English for Admin, Manager, and Employee roles"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe existing tasks, jobs, logworks, and accounts before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write("=== WorkTracker Pro Seed Data Script (All in English) ===")

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
                CustomUser.objects.exclude(is_superuser=True).delete()

                # RESET AUTO-INCREMENT SEQUENCES BACK TO ID 1 (SQLITE & POSTGRESQL)
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
            self.stdout.write("1. Seeding Roles & Departments...")
            role_admin, _ = Role.objects.get_or_create(code="ADMIN", defaults={"name": "System Administrator", "description": "Full system management"})
            role_manager, _ = Role.objects.get_or_create(code="MANAGER", defaults={"name": "Project Manager", "description": "Project and team leadership"})
            role_employee, _ = Role.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Software Engineer", "description": "Task execution and time logging"})

            dept_it, _ = Department.objects.get_or_create(name="Information Technology", defaults={"description": "Software architecture and engineering"})
            dept_mkt, _ = Department.objects.get_or_create(name="Digital Marketing", defaults={"description": "Growth, branding, and content campaigns"})
            dept_hr, _ = Department.objects.get_or_create(name="Human Resources", defaults={"description": "Talent acquisition and operations"})

            # -----------------------------------------------------------------
            # 2. ACCOUNTS (1 ADMIN, 1 MANAGER, 15 EMPLOYEES)
            # -----------------------------------------------------------------
            self.stdout.write("2. Seeding Accounts (Admin, Manager & 15 Employees)...")

            # 🛡️ ADMIN USER
            admin_user, _ = CustomUser.objects.get_or_create(
                email="admin@worktracker.vn",
                defaults={
                    "role": role_admin,
                    "is_staff": True,
                    "is_superuser": True,
                    "is_active": True,
                    "must_change_password": False,
                }
            )
            admin_user.set_password("Admin123!")
            admin_user.must_change_password = False
            admin_user.save()

            EmployeeProfile.objects.get_or_create(
                user=admin_user,
                defaults={
                    "full_name": "System Administrator",
                    "department": dept_it,
                    "phone_number": "+84 901 000 001",
                }
            )

            # 👔 MANAGER USER
            manager_user, _ = CustomUser.objects.get_or_create(
                email="manager@worktracker.vn",
                defaults={
                    "role": role_manager,
                    "is_staff": True,
                    "is_active": True,
                    "must_change_password": False,
                }
            )
            manager_user.set_password("Manager123!")
            manager_user.must_change_password = False
            manager_user.save()

            EmployeeProfile.objects.get_or_create(
                user=manager_user,
                defaults={
                    "full_name": "Alexander Wright",
                    "department": dept_it,
                    "phone_number": "+84 902 000 002",
                }
            )

            # Link department manager
            dept_it.manager = manager_user
            dept_it.save()

            # 👷 15 EMPLOYEE USERS
            employee_names = [
                ("Sophia Johnson", "sophia.johnson@worktracker.vn", dept_it, "+84 903 000 101"),
                ("Ethan Williams", "ethan.williams@worktracker.vn", dept_it, "+84 903 000 102"),
                ("Emma Brown", "emma.brown@worktracker.vn", dept_mkt, "+84 903 000 103"),
                ("Oliver Jones", "oliver.jones@worktracker.vn", dept_it, "+84 903 000 104"),
                ("Ava Garcia", "ava.garcia@worktracker.vn", dept_it, "+84 903 000 105"),
                ("Liam Miller", "liam.miller@worktracker.vn", dept_it, "+84 903 000 106"),
                ("Isabella Davis", "isabella.davis@worktracker.vn", dept_mkt, "+84 903 000 107"),
                ("Noah Rodriguez", "noah.rodriguez@worktracker.vn", dept_it, "+84 903 000 108"),
                ("Mia Martinez", "mia.martinez@worktracker.vn", dept_hr, "+84 903 000 109"),
                ("Lucas Hernandez", "lucas.hernandez@worktracker.vn", dept_it, "+84 903 000 110"),
                ("Charlotte Lopez", "charlotte.lopez@worktracker.vn", dept_it, "+84 903 000 111"),
                ("James Gonzalez", "james.gonzalez@worktracker.vn", dept_it, "+84 903 000 112"),
                ("Amelia Wilson", "amelia.wilson@worktracker.vn", dept_mkt, "+84 903 000 113"),
                ("Benjamin Anderson", "benjamin.anderson@worktracker.vn", dept_it, "+84 903 000 114"),
                ("Harper Thomas", "harper.thomas@worktracker.vn", dept_it, "+84 903 000 115"),
            ]

            employee_users = []
            for full_name, email, dept, phone in employee_names:
                emp, _ = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={
                        "role": role_employee,
                        "is_active": True,
                        "must_change_password": False,
                    }
                )
                emp.set_password("Emp12345!")
                emp.must_change_password = False
                emp.save()

                EmployeeProfile.objects.get_or_create(
                    user=emp,
                    defaults={
                        "full_name": full_name,
                        "department": dept,
                        "phone_number": phone,
                    }
                )
                employee_users.append(emp)

            # -----------------------------------------------------------------
            # 3. CLIENTS & JOBS (5 CLIENTS & 10 JOBS)
            # -----------------------------------------------------------------
            self.stdout.write("3. Seeding 5 Clients & 10 Master Jobs...")
            client1, _ = Client.objects.get_or_create(client_name="TechCorp Solutions", defaults={"tax_code": "0101234567", "industry": "Technology", "address": "72 Le Thanh Ton, Dist 1, HCMC"})
            client2, _ = Client.objects.get_or_create(client_name="VinGroup Digital", defaults={"tax_code": "0107654321", "industry": "Real Estate", "address": "Park 5, Landmark 81, Binh Thanh, HCMC"})
            client3, _ = Client.objects.get_or_create(client_name="Global Finance Ltd", defaults={"tax_code": "0109998887", "industry": "Banking & Fintech", "address": "Bitexco Tower, Dist 1, HCMC"})
            client4, _ = Client.objects.get_or_create(client_name="Nexus Retail Group", defaults={"tax_code": "0105554443", "industry": "Retail & E-Commerce", "address": "Crescent Mall, Dist 7, HCMC"})
            client5, _ = Client.objects.get_or_create(client_name="CloudScale Express", defaults={"tax_code": "0103332221", "industry": "Logistics & Supply Chain", "address": "Tan Binh Logistics Park, HCMC"})

            today = date.today()
            raw_jobs_list = [
                ("JOB-ERP-01", "ERP System Implementation", client1, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=30), today + timedelta(days=60)),
                ("JOB-MOB-02", "Mobile App Development", client2, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=20), today + timedelta(days=40)),
                ("JOB-WEB-03", "Website Redesign & Refactor", client3, Job.Status.ON_HOLD, Job.Priority.MEDIUM, today - timedelta(days=15), today + timedelta(days=30)),
                ("JOB-CLD-04", "Cloud Infrastructure Migration", client1, Job.Status.PLANNING, Job.Priority.LOW, today, today + timedelta(days=90)),
                ("JOB-AI-05", "AI Chatbot & Support Automation", client2, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=10), today + timedelta(days=20)),
                ("JOB-SEC-06", "Security Audit & Hardening", client3, Job.Status.COMPLETED, Job.Priority.MEDIUM, today - timedelta(days=60), today - timedelta(days=5)),
                ("JOB-BI-07", "Data Analytics & BI Dashboard", client4, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=5), today + timedelta(days=45)),
                ("JOB-PAY-08", "Payment Gateway Integration", client5, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=12), today + timedelta(days=25)),
                ("JOB-HRM-09", "HRMS Employee Portal System", client4, Job.Status.PLANNING, Job.Priority.MEDIUM, today, today + timedelta(days=75)),
                ("JOB-MKT-10", "Marketing CRM Automation Engine", client5, Job.Status.ACTIVE, Job.Priority.LOW, today - timedelta(days=8), today + timedelta(days=35)),
            ]

            jobs = []
            for code, name, client, status, priority, start, deadline in raw_jobs_list:
                j, _ = Job.objects.get_or_create(
                    job_code=code,
                    defaults={
                        "job_name": name,
                        "client": client,
                        "manager": manager_user,
                        "status": status,
                        "priority": priority,
                        "start_date": start,
                        "deadline": deadline,
                        "description": f"Comprehensive enterprise implementation for {name} with modern standards."
                    }
                )
                jobs.append(j)

            # -----------------------------------------------------------------
            # 4. TASKS (10 TASKS PER JOB = 100 TASKS WITH LEXORANK ORDER_INDEX)
            # -----------------------------------------------------------------
            self.stdout.write("4. Seeding 100 Tasks across 10 Jobs...")

            task_pool = [
                ("Database Schema Architecture", Task.Status.TODO, Task.Priority.HIGH),
                ("Technical Specification Review", Task.Status.TODO, Task.Priority.MEDIUM),
                ("User Flow Workshop & Prototyping", Task.Status.TODO, Task.Priority.LOW),
                ("RESTful API Service Module", Task.Status.IN_PROGRESS, Task.Priority.HIGH),
                ("Backend Core Business Refactoring", Task.Status.IN_PROGRESS, Task.Priority.HIGH),
                ("Redis Cache & Session Optimization", Task.Status.IN_PROGRESS, Task.Priority.MEDIUM),
                ("Responsive UI Interface Implementation", Task.Status.REVIEWING, Task.Priority.MEDIUM),
                ("Code Review & QA Inspection", Task.Status.REVIEWING, Task.Priority.HIGH),
                ("End-to-End Automated Test Suite", Task.Status.COMPLETED, Task.Priority.LOW),
                ("Staging Environment Deployment", Task.Status.CANCELLED, Task.Priority.HIGH),
            ]

            created_tasks = []

            for job_idx, target_job in enumerate(jobs):
                last_keys = {}

                for task_idx, (tmpl_title, default_status, default_priority) in enumerate(task_pool):
                    title = f"{tmpl_title} #{job_idx+1}.{task_idx+1}"
                    assignee = employee_users[(job_idx * 10 + task_idx) % len(employee_users)]
                    deadline = today + timedelta(days=random.randint(-5, 15))

                    prev_key = last_keys.get(default_status)
                    new_lexo_key = key_between(prev_key, None)
                    last_keys[default_status] = new_lexo_key

                    t, _ = Task.objects.get_or_create(
                        title=title,
                        job=target_job,
                        defaults={
                            "creator": manager_user,
                            "assignee": assignee,
                            "status": default_status,
                            "priority": default_priority,
                            "deadline": deadline,
                            "order_index": new_lexo_key,
                            "description": f"Standard operational guidelines for task '{title}' under {target_job.job_name}."
                        }
                    )
                    created_tasks.append(t)

                    TaskFollower.objects.get_or_create(task=t, user=manager_user)
                    TaskFollower.objects.get_or_create(task=t, user=assignee)
                    TaskComment.objects.get_or_create(
                        task=t,
                        user=manager_user,
                        defaults={"content": f"Please process task '{title}' with high priority and ensure clean unit test coverage."}
                    )

            # -----------------------------------------------------------------
            # 5. TIMESHEETS (LOGWORK RECORDS WITH 8.0H DAILY CEILING)
            # -----------------------------------------------------------------
            self.stdout.write("5. Seeding Timesheet LogWorks and Daily Totals...")

            hours_distribution_pool = [
                [8.0],
                [4.0, 4.0],
                [5.0, 3.0],
                [3.5, 2.5, 2.0],
                [4.0, 2.5, 1.5],
                [3.0, 3.0, 2.0],
                [6.0, 2.0],
                [7.5],
            ]

            for emp in employee_users:
                emp_tasks = [t for t in created_tasks if t.assignee_id == emp.id]
                if not emp_tasks:
                    continue

                for d_offset in range(1, 4):
                    work_date = today - timedelta(days=d_offset)
                    dist = random.choice(hours_distribution_pool)

                    num_tasks = min(len(dist), len(emp_tasks))
                    selected_tasks = random.sample(emp_tasks, num_tasks)

                    for idx, task in enumerate(selected_tasks):
                        hours = dist[idx] if idx < len(dist) else 2.0

                        if d_offset == 1:
                            status_val = LogWork.ReviewStatus.PENDING
                            reviewed_by_user = None
                            review_note = None
                        elif d_offset == 2:
                            status_val = random.choice([LogWork.ReviewStatus.PENDING, LogWork.ReviewStatus.APPROVED])
                            reviewed_by_user = manager_user if status_val == LogWork.ReviewStatus.APPROVED else None
                            review_note = "Excellent progress on feature implementation." if status_val == LogWork.ReviewStatus.APPROVED else None
                        else:
                            status_val = random.choice([LogWork.ReviewStatus.APPROVED, LogWork.ReviewStatus.APPROVED, LogWork.ReviewStatus.REJECTED])
                            reviewed_by_user = manager_user
                            review_note = "Approved by project manager." if status_val == LogWork.ReviewStatus.APPROVED else "Please provide more detailed work log descriptions."

                        LogWork.objects.get_or_create(
                            task=task,
                            user=emp,
                            work_date=work_date,
                            defaults={
                                "hours_spent": hours,
                                "description": f"Executed engineering work for task: {task.title}",
                                "review_status": status_val,
                                "reviewed_by": reviewed_by_user,
                                "review_note": review_note,
                            }
                        )

                    # Automatically rebuild daily timesheets accurately
                    rebuild_daily_user_timesheet(user_id=emp.id, work_date=work_date)

            # -----------------------------------------------------------------
            # 6. TIMELOCKS (1 GLOBAL LOCK FOR ADMIN, 1 JOB LOCK FOR MANAGER)
            # -----------------------------------------------------------------
            self.stdout.write("6. Seeding Period TimeLocks...")
            prev_month = today.month - 1 if today.month > 1 else 12
            prev_year = today.year if today.month > 1 else today.year - 1

            # Job Scope Lock (Manager)
            TimeLock.objects.get_or_create(
                job=jobs[0],
                lock_scope=TimeLock.LockScope.JOB,
                lock_year=prev_year,
                lock_month=prev_month,
                defaults={
                    "is_locked": True,
                    "locked_by": manager_user,
                    "lock_reason": f"Monthly timesheet cycle completed and reconciled for {jobs[0].job_name}."
                }
            )

            # Global Scope Lock (Admin)
            TimeLock.objects.get_or_create(
                job=None,
                lock_scope=TimeLock.LockScope.GLOBAL,
                lock_year=prev_year,
                lock_month=prev_month,
                defaults={
                    "is_locked": True,
                    "locked_by": admin_user,
                    "lock_reason": "Company-wide fiscal timesheet period finalized for payroll processing."
                }
            )

            # -----------------------------------------------------------------
            # 7. CHAT ROOMS & CHAT MESSAGES
            # -----------------------------------------------------------------
            self.stdout.write("7. Seeding Realtime Chat Rooms & Messages...")
            for job in jobs[:4]:
                room, _ = ChatRoom.objects.get_or_create(
                    name=f"Channel - {job.job_name}",
                    room_type=ChatRoom.RoomType.JOB,
                    job=job,
                )
                ChatParticipant.objects.get_or_create(room=room, user=manager_user)
                for emp in employee_users[:3]:
                    ChatParticipant.objects.get_or_create(room=room, user=emp)

                ChatMessage.objects.get_or_create(
                    room=room,
                    sender=manager_user,
                    content=f"Welcome team to {job.job_name}. Please coordinate your sprint tasks here.",
                )
                ChatMessage.objects.get_or_create(
                    room=room,
                    sender=employee_users[0],
                    content="Acknowledged. The technical baseline has been set up.",
                )

            # -----------------------------------------------------------------
            # 8. NOTIFICATIONS FOR ADMIN, MANAGER & EMPLOYEE
            # -----------------------------------------------------------------
            self.stdout.write("8. Seeding EventType Notifications across all 3 roles...")

            # Notifications for Admin
            Notification.objects.get_or_create(
                user=admin_user,
                event_type=Notification.EventType.ACCOUNT_OR_PERMISSION_CHANGED,
                title="Security Policy Updated",
                defaults={
                    "content": "Administrator password policy and permission mappings have been reloaded.",
                    "related_url": "/admin/users/search",
                    "is_read": False,
                }
            )
            Notification.objects.get_or_create(
                user=admin_user,
                event_type=Notification.EventType.TIMESHEET_LOCK,
                title="Global Period Lock Active",
                defaults={
                    "content": f"Global payroll cycle for {prev_month}/{prev_year} has been locked successfully.",
                    "related_url": "/admin/timesheets",
                    "is_read": True,
                }
            )

            # Notifications for Manager
            first_task = created_tasks[0]
            Notification.objects.get_or_create(
                user=manager_user,
                event_type=Notification.EventType.TASK_SUBMITTED,
                title="Task Submitted for QA Review",
                defaults={
                    "content": f"Employee Sophia Johnson submitted '{first_task.title}' for QA inspection.",
                    "related_url": "/manager/tasks/review",
                    "is_read": False,
                }
            )
            Notification.objects.get_or_create(
                user=manager_user,
                event_type=Notification.EventType.TASK_COMMENT,
                title="New Task Discussion",
                defaults={
                    "content": "Sophia Johnson commented on the database indexing strategy.",
                    "related_url": f"/manager/jobs/{jobs[0].id}",
                    "is_read": True,
                }
            )

            # Notifications for Employee (Sophia)
            sophia_user = employee_users[0]
            Notification.objects.get_or_create(
                user=sophia_user,
                event_type=Notification.EventType.TASK_ASSIGNED,
                title="New Task Assigned",
                defaults={
                    "content": f"Manager Alexander Wright assigned you to '{first_task.title}'.",
                    "related_url": "/employee/my-tasks",
                    "is_read": False,
                }
            )
            Notification.objects.get_or_create(
                user=sophia_user,
                event_type=Notification.EventType.LOG_WORK_APPROVED,
                title="Log Work Approved",
                defaults={
                    "content": f"Your work log entry on '{first_task.title}' was approved by Alexander Wright.",
                    "related_url": "/employee/timesheet",
                    "is_read": False,
                }
            )

            self.stdout.write(self.style.SUCCESS(
                f"Successfully seeded enterprise data in English!\n"
                f"• Admin: admin@worktracker.vn / Admin123!\n"
                f"• Manager: manager@worktracker.vn / Manager123!\n"
                f"• Employee: sophia.johnson@worktracker.vn / Emp12345!\n"
                f"• Total Tasks: {len(created_tasks)}, Jobs: {len(jobs)}, LogWorks: {LogWork.objects.count()}"
            ))