import random
import time
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.contrib.auth.hashers import make_password

from accounts.models import CustomUser, Role, Department, EmployeeProfile
from projects.models import Client, Job
from tasks.models import Task, TaskFollower, TaskComment, TaskAttachment
from timesheets.models import LogWork, TimeLock, DailyUserTimesheet
from system.models import Notification
from chat.models import ChatRoom, ChatParticipant, ChatMessage
from tasks.services.order_index_manager_service import key_between


class Command(BaseCommand):
    help = "Seed high-volume stress test dataset (5,000 employees, 100 managers, 250 jobs, 5,000 tasks, 15,000 logworks) optimized via bulk_create"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe existing tasks, jobs, logworks, and accounts before seeding',
        )

    def handle(self, *args, **options):
        start_time = time.time()
        self.stdout.write(self.style.MIGRATE_HEADING("=== Seeding High-Volume Stress Test Dataset (5,000 Staff, 100 Managers) ==="))

        with transaction.atomic():
            if options['reset']:
                self.stdout.write("Reset flag set. Purging existing transactional data...")
                ChatMessage.objects.all().delete()
                ChatParticipant.objects.all().delete()
                ChatRoom.objects.all().delete()
                Notification.objects.all().delete()
                TaskComment.objects.all().delete()
                TaskAttachment.objects.all().delete()
                TaskFollower.objects.all().delete()
                LogWork.objects.all().delete()
                DailyUserTimesheet.objects.all().delete()
                TimeLock.objects.all().delete()
                Task.objects.all().delete()
                Job.objects.all().delete()
                Client.objects.all().delete()
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

            dept_names = ["Information Technology", "Digital Marketing", "Human Resources", "Finance & Accounting", "Quality Assurance", "Customer Support"]
            departments = []
            for d_name in dept_names:
                d, _ = Department.objects.get_or_create(name=d_name, defaults={"description": f"{d_name} Operations"})
                departments.append(d)

            # Pre-compute password hashes ONCE (Saving ~10 minutes of PBKDF2 calculation)
            self.stdout.write("Pre-computing secure password hashes...")
            pw_admin = make_password("Admin12345!")
            pw_manager = make_password("Manager12345!")
            pw_employee = make_password("Emp12345!")

            # -----------------------------------------------------------------
            # 2. SEED ADMIN & 100 MANAGERS
            # -----------------------------------------------------------------
            self.stdout.write("2. Creating 1 Admin & 100 Managers...")

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
                    "department": departments[0],
                    "phone_number": "+84 901 000 001",
                    "joined_date": date(2025, 1, 1),
                }
            )

            # Bulk create 100 Managers
            manager_users_to_create = []
            for m_idx in range(1, 101):
                email = f"manager{m_idx}@worktracker.vn"
                manager_users_to_create.append(
                    CustomUser(
                        email=email,
                        role=role_manager,
                        is_active=True,
                        must_change_password=False,
                        password=pw_manager,
                    )
                )

            # Insert managers in bulk
            created_manager_users = CustomUser.objects.bulk_create(manager_users_to_create, batch_size=100)
            
            # Fetch created managers with IDs
            manager_list = list(CustomUser.objects.filter(role=role_manager).order_by("id"))
            self.stdout.write(f"   -> {len(manager_list)} Managers created.")

            # Create Manager Profiles in bulk
            manager_profiles_to_create = []
            for idx, m_user in enumerate(manager_list):
                dept = departments[idx % len(departments)]
                manager_profiles_to_create.append(
                    EmployeeProfile(
                        user=m_user,
                        full_name=f"Manager #{idx+1} ({dept.name})",
                        department=dept,
                        phone_number=f"+84 902 {idx+1:03d} 000",
                        joined_date=date(2025, 2, 1) + timedelta(days=idx * 2),
                    )
                )
            EmployeeProfile.objects.bulk_create(manager_profiles_to_create, batch_size=100)

            # -----------------------------------------------------------------
            # 3. SEED 5,000 EMPLOYEES (50 EMPLOYEES PER MANAGER)
            # -----------------------------------------------------------------
            self.stdout.write("3. Bulk creating 5,000 Employees (50 assigned per Manager)...")
            
            emp_users_to_create = []
            total_employees = 5000
            for e_idx in range(1, total_employees + 1):
                emp_users_to_create.append(
                    CustomUser(
                        email=f"emp{e_idx}@worktracker.vn",
                        role=role_employee,
                        is_active=True,
                        must_change_password=False,
                        password=pw_employee,
                    )
                )

            CustomUser.objects.bulk_create(emp_users_to_create, batch_size=1000)
            employee_list = list(CustomUser.objects.filter(role=role_employee).order_by("id"))
            self.stdout.write(f"   -> {len(employee_list)} Employee User accounts created.")

            # Bulk create 5,000 Employee Profiles with explicit manager assignment
            emp_profiles_to_create = []
            for e_idx, e_user in enumerate(employee_list):
                # 50 employees per manager (5000 / 100 = 50)
                assigned_manager = manager_list[e_idx // 50]
                dept = departments[e_idx % len(departments)]
                emp_profiles_to_create.append(
                    EmployeeProfile(
                        user=e_user,
                        full_name=f"Staff #{e_idx+1} ({assigned_manager.email.split('@')[0]})",
                        department=dept,
                        manager=assigned_manager,
                        phone_number=f"+84 903 {e_idx % 1000:03d} {e_idx // 1000:03d}",
                        joined_date=date(2025, 5, 1) + timedelta(days=(e_idx % 365)),
                    )
                )

            EmployeeProfile.objects.bulk_create(emp_profiles_to_create, batch_size=1000)
            self.stdout.write("   -> 5,000 Profiles linked with designated Managers.")

            # Map manager_id -> list of assigned employee users
            employees_by_manager = {}
            for e_user in employee_list:
                mgr_id = manager_list[employee_list.index(e_user) // 50].id
                if mgr_id not in employees_by_manager:
                    employees_by_manager[mgr_id] = []
                employees_by_manager[mgr_id].append(e_user)

            # -----------------------------------------------------------------
            # 4. SEED 20 CLIENTS & 250 MASTER JOBS
            # -----------------------------------------------------------------
            self.stdout.write("4. Creating 20 Enterprise Clients & 250 Jobs...")
            client_objs = []
            for c_idx in range(1, 21):
                client_objs.append(
                    Client(
                        client_name=f"Enterprise Client #{c_idx:02d} Group",
                        tax_code=f"010{c_idx:07d}",
                        industry="Enterprise Technology & Services",
                        address=f"District {(c_idx % 12) + 1}, Ho Chi Minh City",
                        is_active=(c_idx % 10 != 0),  # 2 clients inactive
                    )
                )
            Client.objects.bulk_create(client_objs, batch_size=50)
            client_list = list(Client.objects.all().order_by("id"))

            # 250 Jobs: Distributed across 100 Managers (2-3 jobs each)
            job_objs = []
            total_jobs = 250
            today = date.today()
            job_statuses = [Job.Status.ACTIVE, Job.Status.ACTIVE, Job.Status.ACTIVE, Job.Status.PLANNING, Job.Status.ON_HOLD, Job.Status.COMPLETED]

            for j_idx in range(1, total_jobs + 1):
                mgr = manager_list[j_idx % len(manager_list)]
                cli = client_list[j_idx % len(client_list)]
                st = job_statuses[j_idx % len(job_statuses)]

                job_objs.append(
                    Job(
                        job_code=f"JOB-STR-{j_idx:03d}",
                        job_name=f"System Modernization Initiative #{j_idx:03d}",
                        client=cli,
                        manager=mgr,
                        status=st,
                        priority=Job.Priority.HIGH if j_idx % 2 == 0 else Job.Priority.MEDIUM,
                        start_date=today - timedelta(days=60),
                        deadline=today + timedelta(days=30 * ((j_idx % 4) + 1)),
                        description=f"Automated benchmark high-volume project package #{j_idx:03d}.",
                    )
                )
            Job.objects.bulk_create(job_objs, batch_size=100)
            job_list = list(Job.objects.all().order_by("id"))
            self.stdout.write(f"   -> {len(job_list)} Jobs created.")

            # -----------------------------------------------------------------
            # 5. SEED 5,000 TASKS (20 TASKS PER JOB)
            # -----------------------------------------------------------------
            self.stdout.write("5. Bulk creating 5,000 Tasks across 250 Jobs...")
            task_objs = []
            task_status_pool = [Task.Status.TODO, Task.Status.IN_PROGRESS, Task.Status.REVIEWING, Task.Status.COMPLETED]

            for j_idx, job in enumerate(job_list):
                mgr_id = job.manager_id
                assignable_staff = employees_by_manager.get(mgr_id, employee_list[:50])

                prev_key = None
                for t_idx in range(1, 21):
                    new_lexo = key_between(prev_key, None)
                    prev_key = new_lexo
                    assignee = assignable_staff[t_idx % len(assignable_staff)]
                    st = task_status_pool[(j_idx + t_idx) % len(task_status_pool)]

                    task_objs.append(
                        Task(
                            title=f"Sprint Module Workload #{job.id}.{t_idx:02d}",
                            job=job,
                            creator=job.manager,
                            assignee=assignee,
                            status=st,
                            priority=Task.Priority.HIGH if t_idx % 3 == 0 else Task.Priority.MEDIUM,
                            deadline=min(job.deadline, today + timedelta(days=(t_idx - 5) * 3)) if job.deadline else today + timedelta(days=(t_idx - 5) * 3),
                            order_index=new_lexo,
                            description=f"Detailed specifications for workload #{job.id}.{t_idx:02d}.",
                        )
                    )

            Task.objects.bulk_create(task_objs, batch_size=1000)
            all_created_tasks = list(Task.objects.all().only("id", "assignee_id", "job_id", "title").order_by("id"))
            self.stdout.write(f"   -> {len(all_created_tasks)} Tasks inserted.")

            # 5.1. Bulk creating Task Followers, Comments & Attachments
            self.stdout.write("5.1. Bulk creating Task Followers, Comments & Attachments...")
            follower_objs = []
            comment_objs = []
            attachment_objs = []

            tasks_with_meta = list(
                Task.objects.all()
                .select_related("job")
                .only("id", "assignee_id", "status", "title", "job__manager_id")
            )

            for idx, t in enumerate(tasks_with_meta):
                if t.job and t.job.manager_id:
                    follower_objs.append(TaskFollower(task_id=t.id, user_id=t.job.manager_id))
                if t.assignee_id:
                    follower_objs.append(TaskFollower(task_id=t.id, user_id=t.assignee_id))

                if t.assignee_id and idx % 2 == 0:
                    comment_objs.append(
                        TaskComment(
                            task_id=t.id,
                            user_id=t.assignee_id,
                            content=f"Workload implementation on '{t.title}' is actively progressing according to milestone specifications.",
                            comment_type=TaskComment.CommentType.NORMAL,
                        )
                    )
                if t.status == Task.Status.REVIEWING and t.job and t.job.manager_id:
                    comment_objs.append(
                        TaskComment(
                            task_id=t.id,
                            user_id=t.job.manager_id,
                            content="Reviewing deliverable package. Please verify integration test results before sign-off.",
                            comment_type=TaskComment.CommentType.NORMAL,
                        )
                    )
                    attachment_objs.append(
                        TaskAttachment(
                            task_id=t.id,
                            user_id=t.assignee_id or t.job.manager_id,
                            file_name=f"deliverable_spec_{t.id}.pdf",
                            file_url=f"https://storage.worktracker.vn/deliverables/task_{t.id}.pdf",
                            file_size=2048576,
                        )
                    )

            TaskFollower.objects.bulk_create(follower_objs, batch_size=2000, ignore_conflicts=True)
            TaskComment.objects.bulk_create(comment_objs, batch_size=2000)
            TaskAttachment.objects.bulk_create(attachment_objs, batch_size=2000)
            self.stdout.write(f"   -> {len(follower_objs)} Followers, {len(comment_objs)} Comments, {len(attachment_objs)} Attachments created.")

            # -----------------------------------------------------------------
            # 6. SEED 15,000 LOGWORKS & DAILY TIMESHEETS
            # -----------------------------------------------------------------
            self.stdout.write("6. Bulk creating 15,000 LogWorks and Daily User Totals...")

            logwork_objs = []
            daily_totals_map = {}  # (user_id, work_date) -> total_hours

            # Distribute logworks on recent dates
            work_dates = [
                today - timedelta(days=7),
                today - timedelta(days=6),
                today - timedelta(days=2),
                today - timedelta(days=1),
            ]

            # Create logworks evenly across ALL 250 jobs (take first 8 tasks of each job)
            active_tasks_for_logging = [t for idx, t in enumerate(all_created_tasks) if (idx % 20) < 8]
            for idx, t in enumerate(active_tasks_for_logging):
                if not t.assignee_id:
                    continue

                for d_offset, w_date in enumerate(work_dates):
                    h = Decimal("4.0") if d_offset % 2 == 0 else Decimal("8.0")
                    status_choice = LogWork.ReviewStatus.PENDING if d_offset == 3 else (
                        LogWork.ReviewStatus.APPROVED if d_offset < 2 else LogWork.ReviewStatus.REJECTED
                    )

                    logwork_objs.append(
                        LogWork(
                            task_id=t.id,
                            user_id=t.assignee_id,
                            work_date=w_date,
                            hours_spent=h,
                            description=f"Executed workload module for task: {t.title}",
                            review_status=status_choice,
                        )
                    )

                    key = (t.assignee_id, w_date)
                    daily_totals_map[key] = daily_totals_map.get(key, Decimal("0.0")) + h

            LogWork.objects.bulk_create(logwork_objs, batch_size=2000)
            self.stdout.write(f"   -> {len(logwork_objs)} LogWork records created.")

            # Bulk create DailyUserTimesheet records
            daily_timesheet_objs = []
            for (u_id, w_date), total_h in daily_totals_map.items():
                capped_h = min(total_h, Decimal("8.0"))
                daily_timesheet_objs.append(
                    DailyUserTimesheet(
                        user_id=u_id,
                        work_date=w_date,
                        total_hours=capped_h,
                    )
                )
            DailyUserTimesheet.objects.bulk_create(daily_timesheet_objs, batch_size=2000)
            self.stdout.write(f"   -> {len(daily_timesheet_objs)} DailyUserTimesheet records compiled.")

            # -----------------------------------------------------------------
            # 7. TIMELOCKS (GLOBAL LOCK AUGUST)
            # -----------------------------------------------------------------
            self.stdout.write("7. Seeding Period TimeLocks...")
            TimeLock.objects.get_or_create(
                job=None,
                lock_scope=TimeLock.LockScope.GLOBAL,
                lock_year=2026,
                lock_month=8,
                defaults={
                    "is_locked": True,
                    "locked_by": admin_user,
                    "lock_reason": "High-volume stress test: Global fiscal period August 2026 locked.",
                }
            )

            # -----------------------------------------------------------------
            # 8. SEED NOTIFICATIONS & CHAT CHANNELS
            # -----------------------------------------------------------------
            self.stdout.write("8. Bulk creating Notifications & Chat Channels...")
            notif_objs = []
            for mgr in manager_list:
                notif_objs.append(
                    Notification(
                        user_id=mgr.id,
                        type=Notification.ChannelType.SYSTEM_ONLY,
                        event_type=Notification.EventType.LOG_WORK_SUBMITTED,
                        title="New Timesheets Awaiting Review",
                        content="Your team members submitted work logs for review.",
                        related_url="/manager/timesheets/review",
                        is_read=False,
                    )
                )
                notif_objs.append(
                    Notification(
                        user_id=mgr.id,
                        type=Notification.ChannelType.SYSTEM_ONLY,
                        event_type=Notification.EventType.TASK_ASSIGNED,
                        title="Project Deliverables Updated",
                        content="Sprint workload modules have been refreshed.",
                        related_url="/manager/tasks/review",
                        is_read=True,
                    )
                )

            for emp in employee_list[:500]:
                notif_objs.append(
                    Notification(
                        user_id=emp.id,
                        type=Notification.ChannelType.SYSTEM_ONLY,
                        event_type=Notification.EventType.TASK_ASSIGNED,
                        title="New Sprint Task Assigned",
                        content="You have been assigned a workload task in your project.",
                        related_url="/employee/tasks",
                        is_read=False,
                    )
                )

            Notification.objects.bulk_create(notif_objs, batch_size=2000)
            self.stdout.write(f"   -> {len(notif_objs)} Notifications created.")

            chat_room_objs = []
            for j in job_list[:50]:
                chat_room_objs.append(
                    ChatRoom(
                        room_type=ChatRoom.RoomType.JOB,
                        job=j,
                        name=f"Project Room - {j.job_name}",
                    )
                )
            for mgr in manager_list[:20]:
                chat_room_objs.append(
                    ChatRoom(
                        room_type=ChatRoom.RoomType.DIRECT,
                        name=f"Direct: {mgr.email} & Support",
                    )
                )

            created_rooms = ChatRoom.objects.bulk_create(chat_room_objs)
            participant_objs = []
            message_objs = []

            for room in created_rooms:
                if room.room_type == ChatRoom.RoomType.JOB and room.job:
                    mgr_id = room.job.manager_id
                    participant_objs.append(ChatParticipant(room=room, user_id=mgr_id))
                    participant_objs.append(ChatParticipant(room=room, user_id=admin_user.id))
                    message_objs.append(
                        ChatMessage(
                            room=room,
                            sender_id=mgr_id,
                            content=f"Welcome to {room.job.job_name} sprint channel. Please coordinate deliverable handovers here.",
                        )
                    )
                elif room.room_type == ChatRoom.RoomType.DIRECT:
                    mgr_id = manager_list[0].id
                    participant_objs.append(ChatParticipant(room=room, user_id=mgr_id))
                    participant_objs.append(ChatParticipant(room=room, user_id=admin_user.id))
                    message_objs.append(
                        ChatMessage(
                            room=room,
                            sender_id=mgr_id,
                            content="Hello, checking project resource allocation status.",
                        )
                    )

            ChatParticipant.objects.bulk_create(participant_objs, batch_size=2000, ignore_conflicts=True)
            ChatMessage.objects.bulk_create(message_objs, batch_size=2000)
            self.stdout.write(f"   -> {len(created_rooms)} Chat Rooms, {len(participant_objs)} Participants, {len(message_objs)} Messages created.")

        duration = time.time() - start_time
        self.stdout.write(self.style.SUCCESS(f"=== STRESS TEST DATASET SEEDED IN {duration:.2f} SECONDS! ==="))
        self.stdout.write("Summary:")
        self.stdout.write("  - 1 Admin: admin@worktracker.vn / Admin12345!")
        self.stdout.write("  - 100 Managers: manager1@worktracker.vn ... manager100@worktracker.vn / Manager12345!")
        self.stdout.write("  - 5,000 Employees: emp1@worktracker.vn ... emp5000@worktracker.vn / Emp12345! (50 per manager)")
        self.stdout.write("  - 20 Clients, 250 Jobs, 5,000 Tasks, 8,000 LogWorks")
        self.stdout.write("  - Task Followers, Task Comments, Task Attachments, Notifications & Chat populated across 100% tables!")
        self.stdout.write("You can now benchmark UI performance, table responsiveness, and API pagination!")
