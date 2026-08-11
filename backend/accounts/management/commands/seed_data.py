import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from django.core.cache import cache

from accounts.models import Role, Permission, RolePermission, CustomUser, Department, EmployeeProfile
from projects.models import Client, Job
from tasks.models import Task, TaskComment, TaskFollower
from timesheets.models import LogWork, TimeLock


class Command(BaseCommand):
    help = "Khởi tạo bộ dữ liệu mẫu (Seed Data) hoàn chỉnh 100% cho toàn bộ hệ thống WorkTracker Pro."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Xóa toàn bộ dữ liệu nghiệp vụ cũ trước khi nạp dữ liệu mẫu mới.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Bat dau qua trinh nap du lieu mau..."))
        cache.clear()

        with transaction.atomic():
            if options['reset']:
                self.stdout.write(self.style.NOTICE("Dang don dep du lieu nghiep vu cu..."))
                TaskComment.objects.all().delete()
                TaskFollower.objects.all().delete()
                LogWork.objects.all().delete()
                TimeLock.objects.all().delete()
                Task.objects.all().delete()
                Job.objects.all().delete()
                Client.objects.all().delete()
                EmployeeProfile.objects.all().delete()
                Department.objects.all().delete()
                CustomUser.objects.exclude(email="admin@worktracker.vn").delete()

            # -----------------------------------------------------------------
            # 1. ROLES & PERMISSIONS
            # -----------------------------------------------------------------
            self.stdout.write("1. Seeding Roles & Permissions...")
            role_admin, _ = Role.objects.get_or_create(code="ADMIN", defaults={"name": "Administrator"})
            role_manager, _ = Role.objects.get_or_create(code="MANAGER", defaults={"name": "Manager"})
            role_employee, _ = Role.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Employee"})

            perm_codes = [
                ("team:view", "View Team"), ("team:assign_department", "Assign Department"),
                ("client:view", "View Client"), ("client:export", "Export Client"),
                ("job:view", "View Job"), ("job:create", "Create Job"), ("job:update", "Update Job"), ("job:change_status", "Change Job Status"), ("job:export", "Export Job"),
                ("task:view", "View Task"), ("task:create", "Create Task"), ("task:update", "Update Task"), ("task:change_status", "Change Task Status"), ("task:review", "Review Task"), ("task:cancel", "Cancel Task"), ("task:comment", "Comment Task"), ("task:attachment", "Attachment Task"), ("task:follow", "Follow Task"),
                ("timesheet:view", "View Timesheet"), ("timesheet:export", "Export Timesheet"), ("timesheet:review", "Review Timesheet"), ("timesheet:correct", "Correct Timesheet"), ("timesheet:void", "Void Timesheet"),
                ("timelock:view", "View TimeLock"), ("timelock:lock", "Lock TimeLock"), ("timelock:unlock", "Unlock TimeLock"),
                ("audit:view", "View Audit"), ("notification:view", "View Notification"), ("report:view", "View Report"), ("report:export", "Export Report")
            ]

            for code, name in perm_codes:
                perm_obj, _ = Permission.objects.get_or_create(code=code, defaults={"name": name})
                RolePermission.objects.get_or_create(role=role_manager, permission=perm_obj)

            # -----------------------------------------------------------------
            # 2. DEPARTMENTS & USERS & PROFILES
            # -----------------------------------------------------------------
            self.stdout.write("2. Seeding Departments & Users...")
            dept_eng, _ = Department.objects.get_or_create(name="Engineering", defaults={"description": "Software Development Team"})
            dept_des, _ = Department.objects.get_or_create(name="Design", defaults={"description": "UI/UX Design Team"})
            dept_mkt, _ = Department.objects.get_or_create(name="Marketing", defaults={"description": "Marketing & Content Team"})

            # Manager User
            manager_user, _ = CustomUser.objects.get_or_create(
                email="manager@worktracker.vn",
                defaults={"role": role_manager, "is_active": True, "must_change_password": False}
            )
            manager_user.set_password("Manager123@")
            manager_user.role = role_manager
            manager_user.must_change_password = False
            manager_user.save()

            EmployeeProfile.objects.get_or_create(
                user=manager_user,
                defaults={
                    "full_name": "Nguyen Van Manager",
                    "phone_number": "0901234567",
                    "department": dept_eng,
                    "joined_date": date(2024, 1, 15)
                }
            )

            # Employee Users (5 nhân viên)
            employees_data = [
                ("employee1@worktracker.vn", "Tran Thi Binh", dept_eng),
                ("employee2@worktracker.vn", "Hoang Van Cuong", dept_des),
                ("employee3@worktracker.vn", "Le Van Dung", dept_eng),
                ("employee4@worktracker.vn", "Pham Minh Em", dept_mkt),
                ("employee5@worktracker.vn", "Vu Thi Giang", dept_eng),
            ]

            employee_users = []
            for email, name, dept in employees_data:
                u, _ = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={"role": role_employee, "is_active": True, "must_change_password": False}
                )
                u.set_password("Employee123@")
                u.role = role_employee
                u.must_change_password = False
                u.save()

                EmployeeProfile.objects.get_or_create(
                    user=u,
                    defaults={"full_name": name, "phone_number": "0912345678", "department": dept, "joined_date": date(2025, 3, 1)}
                )
                employee_users.append(u)

            # -----------------------------------------------------------------
            # 3. CLIENTS & JOBS
            # -----------------------------------------------------------------
            self.stdout.write("3. Seeding Clients & Jobs...")
            client1, _ = Client.objects.get_or_create(client_name="TechCorp Solutions", defaults={"tax_code": "0101234567", "industry": "Technology"})
            client2, _ = Client.objects.get_or_create(client_name="VinGroup Digital", defaults={"tax_code": "0107654321", "industry": "Real Estate"})
            client3, _ = Client.objects.get_or_create(client_name="Global Finance Ltd", defaults={"tax_code": "0109998887", "industry": "Banking"})

            today = date.today()
            jobs_data = [
                ("JOB-ERP-01", "ERP System Implementation", client1, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=30), today + timedelta(days=60)),
                ("JOB-MOB-02", "Mobile App Development", client2, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=20), today + timedelta(days=40)),
                ("JOB-WEB-03", "Website Redesign", client3, Job.Status.ON_HOLD, Job.Priority.MEDIUM, today - timedelta(days=15), today + timedelta(days=30)),
                ("JOB-CLD-04", "Cloud Migration Phase 2", client1, Job.Status.PLANNING, Job.Priority.LOW, today, today + timedelta(days=90)),
                ("JOB-AI-05", "AI Chatbot Integration", client2, Job.Status.ACTIVE, Job.Priority.HIGH, today - timedelta(days=10), today + timedelta(days=20)),
                ("JOB-SEC-06", "Security Audit & Hardening", client3, Job.Status.COMPLETED, Job.Priority.MEDIUM, today - timedelta(days=60), today - timedelta(days=5)),
            ]

            jobs = []
            for code, name, client, status, priority, start, deadline in jobs_data:
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
            # 4. TASKS TRẢI DÀI NHIỀU JOB (KANBAN & OVERDUE)
            # -----------------------------------------------------------------
            self.stdout.write("4. Seeding Tasks...")

            all_tasks_spec = [
                # Job 0: ERP System
                (jobs[0], "Design Database Schema", Task.Status.REVIEWING, Task.Priority.HIGH, today - timedelta(days=2), "0|hzzzzz:"),
                (jobs[0], "API Integration Module", Task.Status.REVIEWING, Task.Priority.MEDIUM, today + timedelta(days=3), "0|i00000:"),
                (jobs[0], "User Interface Mockup", Task.Status.REVIEWING, Task.Priority.LOW, today + timedelta(days=5), "0|i00004:"),
                (jobs[0], "Setup PostgreSQL Cluster", Task.Status.IN_PROGRESS, Task.Priority.HIGH, today - timedelta(days=3), "0|i00008:"),
                (jobs[0], "Fix Authentication 401 Bug", Task.Status.IN_PROGRESS, Task.Priority.HIGH, today - timedelta(days=1), "0|i0000c:"),
                (jobs[0], "Write Unit Test Suite", Task.Status.TODO, Task.Priority.MEDIUM, today + timedelta(days=7), "0|i0000g:"),
                (jobs[0], "Deploy Staging Environment", Task.Status.COMPLETED, Task.Priority.HIGH, today - timedelta(days=10), "0|i0000o:"),

                # Job 1: Mobile App
                (jobs[1], "React Native Base Setup", Task.Status.COMPLETED, Task.Priority.HIGH, today - timedelta(days=15), "0|i00001:"),
                (jobs[1], "Push Notification Firebase", Task.Status.IN_PROGRESS, Task.Priority.HIGH, today - timedelta(days=2), "0|i00002:"),
                (jobs[1], "Biometric Authentication Login", Task.Status.TODO, Task.Priority.MEDIUM, today + timedelta(days=4), "0|i00003:"),

                # Job 2: Website Redesign
                (jobs[2], "Figma Design System System", Task.Status.IN_PROGRESS, Task.Priority.MEDIUM, today - timedelta(days=4), "0|i00005:"),
                (jobs[2], "SEO Meta Tags Optimization", Task.Status.TODO, Task.Priority.LOW, today + timedelta(days=8), "0|i00006:"),

                # Job 4: AI Chatbot
                (jobs[4], "Train Intent Classification", Task.Status.IN_PROGRESS, Task.Priority.HIGH, today - timedelta(days=1), "0|i00007:"),
                (jobs[4], "Connect OpenAI API Gateway", Task.Status.REVIEWING, Task.Priority.HIGH, today + timedelta(days=2), "0|i00009:"),
            ]

            created_tasks = []
            for idx, (target_job, title, status, priority, deadline, lexo) in enumerate(all_tasks_spec):
                assignee = employee_users[idx % len(employee_users)]
                t, _ = Task.objects.get_or_create(
                    title=title,
                    job=target_job,
                    defaults={
                        "creator": manager_user,
                        "assignee": assignee,
                        "status": status,
                        "priority": priority,
                        "deadline": deadline,
                        "order_index": lexo,
                        "description": f"Detailed requirement instructions for {title}."
                    }
                )
                created_tasks.append(t)

                # Tạo Followers & Comment mẫu cho Task
                TaskFollower.objects.get_or_create(task=t, user=manager_user)
                TaskFollower.objects.get_or_create(task=t, user=assignee)
                TaskComment.objects.get_or_create(
                    task=t,
                    user=manager_user,
                    defaults={"content": f"Please process task {title} with high priority."}
                )

            # -----------------------------------------------------------------
            # 5. TIMESHEETS (LOGWORK RECORDS & TIMELOCKS)
            # -----------------------------------------------------------------
            self.stdout.write("5. Seeding LogWorks & TimeLocks...")
            
            # 15 LogWorks PENDING chờ duyệt
            for i in range(15):
                emp = employee_users[i % len(employee_users)]
                tsk = created_tasks[i % len(created_tasks)]
                wdate = today - timedelta(days=(i % 5))
                LogWork.objects.get_or_create(
                    task=tsk,
                    user=emp,
                    work_date=wdate,
                    hours_spent=round(random.uniform(2.0, 8.0), 1),
                    defaults={
                        "description": f"Worked on {tsk.title} - Pending review log entry #{i+1}",
                        "review_status": LogWork.ReviewStatus.PENDING
                    }
                )

            # 25 LogWorks APPROVED phục vụ biểu đồ
            for i in range(25):
                emp = employee_users[i % len(employee_users)]
                tsk = created_tasks[i % len(created_tasks)]
                wdate = today - timedelta(days=(i % 20) + 1)
                LogWork.objects.get_or_create(
                    task=tsk,
                    user=emp,
                    work_date=wdate,
                    hours_spent=round(random.uniform(3.0, 7.5), 1),
                    defaults={
                        "description": f"Approved log work entry for {tsk.title}",
                        "review_status": LogWork.ReviewStatus.APPROVED,
                        "reviewed_by": manager_user,
                        "reviewed_at": timezone.now()
                    }
                )

            # TimeLock mẫu cho Job ERP
            TimeLock.objects.get_or_create(
                lock_month=7,
                lock_year=2026,
                lock_scope=TimeLock.LockScope.JOB,
                job=jobs[0],
                defaults={
                    "is_locked": True,
                    "locked_by": manager_user,
                    "lock_reason": "Khóa kỳ công chốt sổ dự án ERP tháng 7/2026."
                }
            )

        self.stdout.write(self.style.SUCCESS("\nTAO BO DU LIEU MAU (SEED DATA) THANH CONG 100%!"))
        self.stdout.write(self.style.SUCCESS("Manager:  manager@worktracker.vn / Manager123@"))
        self.stdout.write(self.style.SUCCESS("Employee: employee1@worktracker.vn / Employee123@"))