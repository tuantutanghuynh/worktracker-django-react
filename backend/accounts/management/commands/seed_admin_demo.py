"""
Tạo dữ liệu mẫu cho MỌI mục trong Admin portal để test giao diện.

Mặc định 20 bản ghi mỗi mục (đổi bằng --count). Chạy được nhiều lần:
mọi thứ đều dùng get_or_create theo khoá tự nhiên (tax_code, job_code,
email, name...) nên không tạo trùng.

    python manage.py seed_admin_demo
    python manage.py seed_admin_demo --count 20
    python manage.py seed_admin_demo --clear   # xoá dữ liệu demo cũ trước

Dữ liệu demo được đánh dấu bằng tiền tố DEMO- (job_code / tax_code) và
email @demo.worktracker.vn để --clear biết đường xoá, không đụng vào dữ
liệu thật do seed_data tạo.
"""
import random
from calendar import monthrange
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import CustomUser, Department, EmployeeProfile, Role
from projects.models import Client, Job
from system.models import AuditLog, Notification
from timesheets.models import LogWork, TimeLock
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet
from tasks.models import Task

DEMO_EMAIL_DOMAIN = "demo.worktracker.vn"
DEMO_PREFIX = "DEMO-"

FIRST_NAMES = [
    "An", "Binh", "Chi", "Dung", "Giang", "Hanh", "Khanh", "Lam", "Minh", "Nam",
    "Oanh", "Phuc", "Quan", "Son", "Thao", "Trang", "Tuan", "Vy", "Xuan", "Yen",
]
LAST_NAMES = [
    "Nguyen", "Tran", "Le", "Pham", "Hoang", "Vo", "Dang", "Bui", "Do", "Ho",
]
INDUSTRIES = [
    "Software", "Fintech", "Logistics", "Retail", "Healthcare",
    "Education", "Manufacturing", "Media", "Travel", "Real Estate",
]
DEPARTMENT_NAMES = [
    "Backend Engineering", "Frontend Engineering", "Quality Assurance",
    "Business Analysis", "UI/UX Design", "DevOps", "Data Analytics",
    "Customer Success", "Finance", "Legal", "Procurement", "Security",
    "Mobile Development", "Product Management", "Technical Support",
    "Research & Development", "Training", "Facilities", "Partnerships", "Payroll",
]
JOB_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]
PRIORITIES = ["LOW", "MEDIUM", "HIGH"]
# (action, table_name, severity, old_values, new_values)
# Dùng đúng tên bảng + tên cột THẬT để drawer Audit Log Detail hiển thị ra
# nhãn nghiệp vụ (utils/auditLabels.js), không phải chuỗi kỹ thuật vô nghĩa.
AUDIT_ACTIONS = [
    ("CREATE", "clients", "NORMAL", None, {"client_name": "Acme Corp", "tax_code": "0101234567", "is_active": True}),
    ("UPDATE", "jobs", "NORMAL", {"status": "PLANNING", "priority": "LOW"}, {"status": "ACTIVE", "priority": "HIGH"}),
    ("DELETE", "clients", "WARNING", {"client_name": "Old Partner Ltd", "is_active": True}, {"is_active": False}),
    ("LOCK_ACCOUNT", "users", "WARNING", {"is_active": True}, {"is_active": False}),
    ("UNLOCK_ACCOUNT", "users", "WARNING", {"is_active": False}, {"is_active": True}),
    ("ROLE_CHANGED", "users", "CRITICAL", {"role": "EMPLOYEE"}, {"role": "MANAGER"}),
    ("RESET_PASSWORD", "users", "WARNING", None, {"must_change_password": True}),
    ("EXPORT", "clients", "NORMAL", None, {"filters": {"is_active": "true"}, "row_count": 20}),
    ("LOCK_TIMESHEET", "time_locks", "WARNING", {"is_locked": False}, {"is_locked": True, "lock_reason": "Chot so cuoi thang"}),
    ("UPDATE", "departments", "NORMAL", {"name": "IT", "manager": "old.manager@worktracker.vn"}, {"name": "Information Technology", "manager": "new.manager@worktracker.vn"}),
]


class Command(BaseCommand):
    help = "Tao du lieu mau cho toan bo cac muc cua Admin portal."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=20, help="So ban ghi moi muc (mac dinh 20).")
        parser.add_argument("--clear", action="store_true", help="Xoa du lieu demo cu truoc khi tao moi.")

    @transaction.atomic
    def handle(self, *args, **options):
        count = options["count"]
        random.seed(42)  # cùng seed -> chạy lại ra cùng dữ liệu, dễ đối chiếu

        if options["clear"]:
            self._clear_demo()

        admin_user = CustomUser.objects.filter(role__code="ADMIN").first()
        if not admin_user:
            self.stderr.write("Khong tim thay tai khoan ADMIN. Chay `seed_roles` va tao admin truoc.")
            return

        departments = self._seed_departments(count)
        clients = self._seed_clients(count)
        managers = self._seed_users(count, "MANAGER", departments)
        employees = self._seed_users(count, "EMPLOYEE", departments)
        self._assign_department_managers(departments, managers)
        jobs = self._seed_jobs(count, clients, managers)
        self._seed_logworks(employees, jobs)
        self._seed_timelocks(count, admin_user, jobs)
        self._seed_audit_logs(count, admin_user)
        self._seed_notifications(count, admin_user)

        self.stdout.write(self.style.SUCCESS("\n=== DA TAO XONG DU LIEU MAU ==="))
        self._print_totals()

    # ── clear ────────────────────────────────────────────────────────────
    def _clear_demo(self):
        from timesheets.models import DailyUserTimesheet

        demo_users = CustomUser.objects.filter(email__endswith=f"@{DEMO_EMAIL_DOMAIN}")
        LogWork.objects.filter(user__in=demo_users).delete()
        # DailyUserTimesheet.user la on_delete=RESTRICT -> phai xoa truoc user,
        # neu khong demo_users.delete() se nem RestrictedError.
        DailyUserTimesheet.objects.filter(user__in=demo_users).delete()
        Notification.objects.filter(title__startswith=DEMO_PREFIX).delete()
        AuditLog.objects.filter(table_name__startswith="demo_").delete()
        Job.objects.filter(job_code__startswith=DEMO_PREFIX).delete()
        Client.objects.filter(tax_code__startswith=DEMO_PREFIX).delete()
        EmployeeProfile.objects.filter(user__in=demo_users).delete()
        Department.objects.filter(manager__in=demo_users).update(manager=None)
        demo_users.delete()
        self.stdout.write(self.style.WARNING("Da xoa du lieu demo cu."))

    # ── departments ──────────────────────────────────────────────────────
    def _seed_departments(self, count):
        created = []
        for name in DEPARTMENT_NAMES[:count]:
            dept, _ = Department.objects.get_or_create(
                name=name, defaults={"description": f"{name} department"}
            )
            created.append(dept)
        self.stdout.write(f"Departments : {len(created)}")
        return created

    # ── clients ──────────────────────────────────────────────────────────
    def _seed_clients(self, count):
        created = []
        for i in range(1, count + 1):
            tax_code = f"{DEMO_PREFIX}TAX{i:04d}"
            client, _ = Client.objects.get_or_create(
                tax_code=tax_code,
                defaults={
                    "client_name": f"{random.choice(INDUSTRIES)} Corp {i:02d}",
                    "contact_person": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                    "contact_email": f"contact{i:02d}@{DEMO_EMAIL_DOMAIN}",
                    "contact_phone": f"09{random.randint(10000000, 99999999)}",
                    # ~1/5 để inactive cho có dữ liệu test filter Status
                    "is_active": i % 5 != 0,
                },
            )
            created.append(client)
        self.stdout.write(f"Clients     : {len(created)}")
        return created

    # ── users ────────────────────────────────────────────────────────────
    def _seed_users(self, count, role_code, departments):
        role = Role.objects.filter(code=role_code).first()
        if not role:
            self.stderr.write(f"Khong co role {role_code}, bo qua.")
            return []

        created = []
        password = make_password("Demo@1234")
        for i in range(1, count + 1):
            first, last = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
            email = f"{role_code.lower()}{i:02d}@{DEMO_EMAIL_DOMAIN}"
            user, was_created = CustomUser.objects.get_or_create(
                email=email,
                defaults={
                    "password": password,
                    "role": role,
                    # ~1/8 khoá tài khoản để test filter Status + KPI Locked
                    "is_active": i % 8 != 0,
                    "must_change_password": False,
                },
            )
            if was_created:
                EmployeeProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "full_name": f"{last} {first}",
                        "phone_number": f"09{random.randint(10000000, 99999999)}",
                        "department": random.choice(departments) if departments else None,
                        "joined_date": timezone.now().date() - timedelta(days=random.randint(30, 900)),
                    },
                )
            created.append(user)
        self.stdout.write(f"{role_code:12}: {len(created)}")
        return created

    def _assign_department_managers(self, departments, managers):
        """Chừa 2 phòng ban không có manager để Data Quality Alerts có dữ liệu."""
        if not managers:
            return
        for idx, dept in enumerate(departments):
            if dept.manager_id is None and idx < len(departments) - 2:
                dept.manager = managers[idx % len(managers)]
                dept.save(update_fields=["manager"])

    # ── jobs ─────────────────────────────────────────────────────────────
    def _seed_jobs(self, count, clients, managers):
        if not clients or not managers:
            return []
        created = []
        today = timezone.now().date()
        for i in range(1, count + 1):
            start = today - timedelta(days=random.randint(10, 200))
            job, _ = Job.objects.get_or_create(
                job_code=f"{DEMO_PREFIX}JOB{i:03d}",
                defaults={
                    "job_name": f"{random.choice(INDUSTRIES)} Platform Phase {i}",
                    "client": random.choice(clients),
                    "manager": random.choice(managers),
                    "description": f"Demo project #{i} for admin UI testing.",
                    "priority": random.choice(PRIORITIES),
                    "status": JOB_STATUSES[i % len(JOB_STATUSES)],
                    "start_date": start,
                    # vài job quá hạn để KPI "Overdue Jobs" khác 0
                    "deadline": start + timedelta(days=random.randint(20, 120)),
                },
            )
            created.append(job)
        self.stdout.write(f"Jobs        : {len(created)}")
        return created

    # ── log works ────────────────────────────────────────────────────────
    def _seed_logworks(self, employees, jobs):
        """
        Tạo log giờ cho tháng hiện tại, CỐ Ý phân bố lệch nhau để mỗi
        status trên trang Timesheet Control đều có dữ liệu thật:
          - 1/4 nhân viên log > 8h/ngày  -> OVER_LIMIT
          - 1/4 log rất ít ngày          -> MISSING
          - 1/4 log đủ ngày nhưng ít giờ -> WARNING
          - còn lại log đủ 8h            -> NORMAL
        """
        tasks = list(Task.objects.filter(job__in=jobs)[:200]) if jobs else []
        if not tasks:
            tasks = list(Task.objects.all()[:200])
        if not tasks or not employees:
            self.stdout.write(self.style.WARNING("LogWork    : bo qua (chua co Task)."))
            return

        # Phải khớp ĐÚNG định nghĩa ngày làm việc của hệ thống
        # (settings.WORK_DAYS_PER_WEEK = 6 -> T2..T7) và trải hết cả tháng,
        # vì missing_days = working_days(cả tháng) - số ngày đã log. Nếu chỉ
        # log T2..T6 hoặc chỉ log tới hôm nay thì mọi nhân viên đều MISSING
        # và không bao giờ thấy được status NORMAL/WARNING.
        from django.conf import settings as dj_settings

        today = timezone.now().date()
        month_start = today.replace(day=1)
        last_day = monthrange(today.year, today.month)[1]
        max_weekday = 4 if getattr(dj_settings, "WORK_DAYS_PER_WEEK", 6) == 5 else 5
        work_days = [
            month_start + timedelta(days=d)
            for d in range(last_day)
            if (month_start + timedelta(days=d)).weekday() <= max_weekday
        ]
        if not work_days:
            work_days = [today]

        touched = set()
        created_count = 0
        for idx, emp in enumerate(employees):
            bucket = idx % 4
            if bucket == 0:      # OVER_LIMIT — vượt 8h/ngày
                days, hours = work_days, Decimal("9.50")
            elif bucket == 1:    # MISSING — chỉ log vài ngày
                days, hours = work_days[:2], Decimal("8.00")
            elif bucket == 2:    # WARNING — đủ ngày, ít giờ (<80% target)
                days, hours = work_days, Decimal("4.00")
            else:                # NORMAL — đủ 8h
                days, hours = work_days, Decimal("8.00")

            for day in days:
                _, was_created = LogWork.objects.get_or_create(
                    user=emp,
                    task=random.choice(tasks),
                    work_date=day,
                    defaults={
                        "hours_spent": hours,
                        "description": f"Demo work log {day:%d/%m}",
                        "review_status": LogWork.ReviewStatus.APPROVED,
                    },
                )
                if was_created:
                    created_count += 1
                touched.add((emp.id, day))

        # Bảng tổng hợp theo ngày — Violations & Missing days của trang
        # Timesheet Control đọc từ đây, không đọc thẳng LogWork.
        for user_id, day in touched:
            rebuild_daily_user_timesheet(user_id=user_id, work_date=day)

        self.stdout.write(f"LogWorks    : {created_count} (da rebuild {len(touched)} dong DailyUserTimesheet)")

    # ── time locks ───────────────────────────────────────────────────────
    def _seed_timelocks(self, count, admin_user, jobs):
        # BUG THẬT đã tìm ra (xem accounts/test_seed_admin_demo_timelocks.py):
        # công thức modulo-12 cũ `((today.month - 2 - i) % 12) + 1` chỉ đúng
        # với tối đa 11 vòng lặp — count (mặc định 20, dùng chung với mọi
        # loại demo data khác) khiến i chạy vượt 11, vòng lại trúng đúng
        # THÁNG HIỆN TẠI (và lặp lại các tháng cũ ở i cao hơn) — Employee bị
        # khoá Log Work ngay tháng đang làm việc. Thay bằng lùi ngày thật
        # từng tháng một (không có trần 11 tháng), luôn xuất phát từ "tháng
        # liền trước hôm nay" nên không bao giờ chạm tới tháng hiện tại/
        # tương lai dù count lớn tuỳ ý.
        today = timezone.now().date()
        created = 0
        year, month = today.year, today.month
        for _ in range(count):
            month -= 1
            if month == 0:
                month = 12
                year -= 1
            _, was_created = TimeLock.objects.get_or_create(
                lock_scope=TimeLock.LockScope.GLOBAL,
                job=None,
                lock_month=month,
                lock_year=year,
                defaults={
                    "is_locked": True,
                    "locked_by": admin_user,
                    "locked_at": timezone.now(),
                    "lock_reason": f"Demo: chot so ky {month:02d}/{year}",
                },
            )
            if was_created:
                created += 1
        self.stdout.write(f"TimeLocks   : {created} moi (GLOBAL)")

    # ── audit logs ───────────────────────────────────────────────────────
    def _seed_audit_logs(self, count, admin_user):
        created = 0
        for i in range(count):
            action, table, severity, old_values, new_values = AUDIT_ACTIONS[i % len(AUDIT_ACTIONS)]
            AuditLog.objects.create(
                user=admin_user,
                action=action,
                table_name=table,
                record_id=i + 1,
                old_values=old_values,
                new_values=new_values,
                severity=severity,
                ip_address=f"192.168.1.{(i % 250) + 1}",
            )
            created += 1
        self.stdout.write(f"AuditLogs   : {created}")

    # ── notifications ────────────────────────────────────────────────────
    def _seed_notifications(self, count, admin_user):
        created = 0
        for i in range(count):
            Notification.objects.create(
                user=admin_user,
                event_type=Notification.EventType.ACCOUNT_OR_PERMISSION_CHANGED,
                type="SYSTEM_ONLY",
                title=f"{DEMO_PREFIX}Thong bao mau #{i + 1}",
                content=f"Noi dung thong bao mau so {i + 1} de test giao dien.",
                related_url="/admin/audit-logs",
                is_read=i % 3 == 0,
            )
            created += 1
        self.stdout.write(f"Notifications: {created}")

    # ── tổng kết ─────────────────────────────────────────────────────────
    def _print_totals(self):
        from timesheets.models import DailyUserTimesheet

        rows = [
            ("Clients", Client.objects.count()),
            ("Jobs", Job.objects.count()),
            ("Departments", Department.objects.count()),
            ("Users", CustomUser.objects.count()),
            ("  - Employees", CustomUser.objects.filter(role__code="EMPLOYEE").count()),
            ("  - Managers", CustomUser.objects.filter(role__code="MANAGER").count()),
            ("LogWorks", LogWork.objects.count()),
            ("DailyUserTimesheets", DailyUserTimesheet.objects.count()),
            ("TimeLocks", TimeLock.objects.count()),
            ("AuditLogs", AuditLog.objects.count()),
            ("Notifications", Notification.objects.count()),
        ]
        for name, total in rows:
            self.stdout.write(f"  {name:22} {total}")
