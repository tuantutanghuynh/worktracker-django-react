import random
from datetime import date, timedelta
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
    help = "Seed 15 Employees, 10 Jobs, and 100 Tasks with unique LexoRank order_index"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe existing tasks, jobs, logworks, and accounts before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write("=== WorkTracker Pro Seed Data Script ===")

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

                # 🚀 RESET AUTO-INCREMENT SEQUENCES BACK TO ID 1 (SQLITE & POSTGRESQL)
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
            role_admin, _ = Role.objects.get_or_create(code="ADMIN", defaults={"name": "System Admin", "role_type": "ADMIN"})
            role_manager, _ = Role.objects.get_or_create(code="MANAGER", defaults={"name": "Project Manager", "role_type": "MANAGER"})
            role_employee, _ = Role.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Software Employee", "role_type": "EMPLOYEE"})

            dept_it, _ = Department.objects.get_or_create(name="Information Technology")
            dept_mkt, _ = Department.objects.get_or_create(name="Digital Marketing")
            dept_hr, _ = Department.objects.get_or_create(name="Human Resources")

            # -----------------------------------------------------------------
            # 2. ACCOUNTS (1 MANAGER manager@worktracker.vn & 15 EMPLOYEES)
            # -----------------------------------------------------------------
            self.stdout.write("2. Seeding Accounts (manager@worktracker.vn & 15 Employees)...")

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
                }
            )

            employee_names = [
                ("Sophia Johnson", "sophia.johnson@worktracker.vn", dept_it),
                ("Ethan Williams", "ethan.williams@worktracker.vn", dept_it),
                ("Emma Brown", "emma.brown@worktracker.vn", dept_mkt),
                ("Oliver Jones", "oliver.jones@worktracker.vn", dept_it),
                ("Ava Garcia", "ava.garcia@worktracker.vn", dept_it),
                ("Liam Miller", "liam.miller@worktracker.vn", dept_it),
                ("Isabella Davis", "isabella.davis@worktracker.vn", dept_mkt),
                ("Noah Rodriguez", "noah.rodriguez@worktracker.vn", dept_it),
                ("Mia Martinez", "mia.martinez@worktracker.vn", dept_hr),
                ("Lucas Hernandez", "lucas.hernandez@worktracker.vn", dept_it),
                ("Charlotte Lopez", "charlotte.lopez@worktracker.vn", dept_it),
                ("James Gonzalez", "james.gonzalez@worktracker.vn", dept_it),
                ("Amelia Wilson", "amelia.wilson@worktracker.vn", dept_mkt),
                ("Benjamin Anderson", "benjamin.anderson@worktracker.vn", dept_it),
                ("Harper Thomas", "harper.thomas@worktracker.vn", dept_it),
            ]

            employee_users = []
            for full_name, email, dept in employee_names:
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
                    }
                )
                employee_users.append(emp)

            # -----------------------------------------------------------------
            # 3. CLIENTS & JOBS (10 JOBS FOR manager@worktracker.vn)
            # -----------------------------------------------------------------
            self.stdout.write("3. Seeding 5 Clients & 10 Jobs for manager@worktracker.vn...")
            client1, _ = Client.objects.get_or_create(client_name="TechCorp Solutions", defaults={"tax_code": "0101234567", "industry": "Technology"})
            client2, _ = Client.objects.get_or_create(client_name="VinGroup Digital", defaults={"tax_code": "0107654321", "industry": "Real Estate"})
            client3, _ = Client.objects.get_or_create(client_name="Global Finance Ltd", defaults={"tax_code": "0109998887", "industry": "Banking"})
            client4, _ = Client.objects.get_or_create(client_name="Nexus Retail Group", defaults={"tax_code": "0105554443", "industry": "Retail"})
            client5, _ = Client.objects.get_or_create(client_name="CloudScale Express", defaults={"tax_code": "0103332221", "industry": "Logistics"})

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
                        "description": f"Detailed project implementation for {name}."
                    }
                )
                jobs.append(j)

            # -----------------------------------------------------------------
            # 4. SEED 10 TASKS PER JOB (MULTIPLE TASKS PER COLUMN WITH STRICT LEXORANK)
            # -----------------------------------------------------------------
            self.stdout.write("4. Seeding Tasks per Job with multi-card columns...")

            task_pool = [
                ("Design Database Schema", Task.Status.TODO, Task.Priority.HIGH),
                ("Architecture Review & Draft", Task.Status.TODO, Task.Priority.MEDIUM),
                ("User Story Workshop", Task.Status.TODO, Task.Priority.LOW),
                ("API Integration Module", Task.Status.IN_PROGRESS, Task.Priority.HIGH),
                ("Backend Core Refactoring", Task.Status.IN_PROGRESS, Task.Priority.HIGH),
                ("Setup Redis Cache Cluster", Task.Status.IN_PROGRESS, Task.Priority.MEDIUM),
                ("User Interface Mockup", Task.Status.REVIEWING, Task.Priority.MEDIUM),
                ("Code Review & QA Check", Task.Status.REVIEWING, Task.Priority.HIGH),
                ("Write Unit Test Suite", Task.Status.COMPLETED, Task.Priority.LOW),
                ("Deploy Staging Environment", Task.Status.CANCELLED, Task.Priority.HIGH),
            ]

            created_tasks = []

            for job_idx, target_job in enumerate(jobs):
                last_keys = {}  # Track LexoRank order_index per status to ensure strictly ascending keys

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
                            "description": f"Detailed requirement instructions for task {title} under project {target_job.job_name}."
                        }
                    )
                    created_tasks.append(t)

                    TaskFollower.objects.get_or_create(task=t, user=manager_user)
                    TaskFollower.objects.get_or_create(task=t, user=assignee)
                    TaskComment.objects.get_or_create(
                        task=t,
                        user=manager_user,
                        defaults={"content": f"Please process task '{title}' with high priority."}
                    )

            # -----------------------------------------------------------------
            # 5. TIMESHEETS (LOGWORK RECORDS & TIMELOCKS)
            # -----------------------------------------------------------------
            self.stdout.write("5. Seeding LogWorks & TimeLocks with standard 8.0h daily cap...")

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

                    # Chọn số lượng task tương ứng phân bổ giờ (không trùng lặp trong ngày)
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
                            review_note = "Great execution, approved!" if status_val == LogWork.ReviewStatus.APPROVED else None
                        else:
                            status_val = random.choice([LogWork.ReviewStatus.APPROVED, LogWork.ReviewStatus.APPROVED, LogWork.ReviewStatus.REJECTED])
                            reviewed_by_user = manager_user
                            review_note = "Approved by manager" if status_val == LogWork.ReviewStatus.APPROVED else "Please clarify work details on this task"

                        LogWork.objects.get_or_create(
                            task=task,
                            user=emp,
                            work_date=work_date,
                            defaults={
                                "hours_spent": hours,
                                "description": f"Worked on feature execution for task: {task.title}",
                                "review_status": status_val,
                                "reviewed_by": reviewed_by_user,
                                "review_note": review_note,
                            }
                        )

                    # Tự động cập nhật bảng DailyUserTimesheet chuẩn xác cho nhân viên và ngày đó
                    rebuild_daily_user_timesheet(user_id=emp.id, work_date=work_date)

            TimeLock.objects.get_or_create(
                job=jobs[0],
                lock_year=today.year,
                lock_month=today.month - 1 if today.month > 1 else 12,
                defaults={"is_locked": True, "locked_by": manager_user}
            )

            self.stdout.write(self.style.SUCCESS(f"Successfully seeded database for manager@worktracker.vn! Total Tasks: {len(created_tasks)}, Jobs: {len(jobs)}, Employees: {len(employee_users)}"))