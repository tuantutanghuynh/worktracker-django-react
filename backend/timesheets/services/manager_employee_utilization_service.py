from datetime import timedelta
from django.conf import settings
from django.db.models import Sum


def calculate_smart_workload_pressure(user):
    """
    Tinh toan Ap luc cong viec thoi gian thuc (Smart Workload Pressure - SWP):
    1. Quet toan bo Task dang mo (TODO, IN_PROGRESS, REVIEWING).
    2. Quy doi Priority thanh gio uoc tinh chuan:
       - HIGH: 8.0 gio (1 ngay cong)
       - MEDIUM: 4.0 gio (nua ngay cong)
       - LOW: 1.5 gio (cong viec phu)
    3. Tinh khung thoi gian lam viec thuc te:
       - Tim Max Deadline cua cac task.
       - Tinh so ngay lam viec tu Hom nay den Max Deadline (toi thieu 6 ngay lam viec de phan bo Backlog).
    4. Tinh ap luc gio lam moi ngay: daily_required_hours = total_effort_hours / horizon_working_days
    5. Phan loai trang thai:
       - < 4.0h/ngay: AVAILABLE (Ranh / San sang nhan them viec)
       - 4.0h - 8.0h/ngay: BALANCED (Vua tai / On dinh)
       - > 8.0h/ngay: OVERLOADED (Qua tai thuc te)
    """
    from tasks.models import Task
    from projects.models import Job
    from django.utils import timezone

    today = timezone.localdate()

    active_tasks = Task.objects.filter(
        assignee=user,
        status__in=[Task.Status.TODO, Task.Status.IN_PROGRESS, Task.Status.REVIEWING]
    ).select_related("job")

    if not active_tasks.exists():
        return {
            "active_tasks_count": 0,
            "active_jobs_count": 0,
            "daily_required_hours": 0.0,
            "workload_status": "AVAILABLE",
        }

    PRIORITY_HOURS = {
        Task.Priority.HIGH: 8.0,
        Task.Priority.MEDIUM: 4.0,
        Task.Priority.LOW: 1.5,
    }

    total_effort_hours = sum(PRIORITY_HOURS.get(task.priority, 4.0) for task in active_tasks)

    # Tim deadline xa nhat cua cac task dang mo
    max_deadline = max(task.deadline for task in active_tasks)

    # Tinh so ngay lam viec tu Hom nay den Max Deadline (toi thieu 6 ngay)
    end_horizon = max(max_deadline, today + timedelta(days=6))
    horizon_working_days = calculate_working_days(today, end_horizon)
    horizon_working_days = max(1, horizon_working_days)

    daily_required_hours = round(total_effort_hours / float(horizon_working_days), 1)

    active_jobs_count = Job.objects.filter(
        tasks__assignee=user,
        status=Job.Status.ACTIVE
    ).distinct().count()

    capacity_pct = round((daily_required_hours / 8.0) * 100.0, 1)

    if daily_required_hours < 4.0:
        workload_status = "AVAILABLE"
    elif daily_required_hours <= 8.0:
        workload_status = "BALANCED"
    else:
        workload_status = "OVERLOADED"

    return {
        "active_tasks_count": active_tasks.count(),
        "active_jobs_count": active_jobs_count,
        "daily_required_hours": daily_required_hours,
        "capacity_pct": capacity_pct,
        "workload_status": workload_status,
    }


def calculate_working_days(start_date, end_date, work_days_per_week=None):
    """
    Calculate the number of working days between two dates.
    Reads default work_days_per_week from Django settings (WORK_DAYS_PER_WEEK).
    - 5 days/week: Mon-Fri
    - 6 days/week: Mon-Sat (Default per system spec)
    """
    if hasattr(start_date, "date"):
        start_date = start_date.date()
    if hasattr(end_date, "date"):
        end_date = end_date.date()

    if start_date > end_date:
        raise ValueError("start_date must be less than or equal to end_date")

    if work_days_per_week is None:
        work_days_per_week = getattr(settings, "WORK_DAYS_PER_WEEK", 6)

    max_weekday = 4 if work_days_per_week == 5 else 5

    working_days = 0
    current_date = start_date

    while current_date <= end_date:
        if current_date.weekday() <= max_weekday:
            working_days += 1
        current_date += timedelta(days=1)

    return working_days


def calculate_employee_utilization(user_id, start_date, end_date):
    """
    Calculate the workload utilization rate (%) and workload status for a single employee.
    Used when fetching individual employee stats.
    """
    from timesheets.models import LogWork

    daily_hours = getattr(settings, "DAILY_WORKING_HOURS", 8)
    working_days = calculate_working_days(start_date, end_date)
    max_capacity_hours = working_days * daily_hours

    if max_capacity_hours == 0:
        return {
            "user_id": user_id,
            "logged_hours": 0.0,
            "capacity_hours": 0.0,
            "utilization_rate": 0.0,
            "workload_status": "Normal",
        }

    result = (
        LogWork.objects.filter(user_id=user_id, work_date__range=(start_date, end_date))
        .exclude(review_status="VOIDED")
        .aggregate(total=Sum("hours_spent"))
    )

    logged_hours = float(result["total"] or 0.0)
    rate = round((logged_hours / max_capacity_hours) * 100, 1)

    if rate < 70.0:
        status = "Normal"
    elif rate < 90.0:
        status = "High"
    else:
        status = "Overloaded"

    return {
        "user_id": user_id,
        "logged_hours": logged_hours,
        "capacity_hours": float(max_capacity_hours),
        "utilization_rate": rate,
        "workload_status": status,
    }


def get_team_workload_summary(manager_user, start_date, end_date):
    """
    HIGH-PERFORMANCE SUMMARY SERVICE:
    Summarize workload utilization for all active employees using Bulk Aggregation (Group By).
    Executes ONLY 2 SQL queries regardless of team size (Resolves N+1 query problem).
    """
    from accounts.models import CustomUser
    from timesheets.models import LogWork

    from system.security.scoping_manager import scoped_team_user_ids

    team_user_ids = scoped_team_user_ids(manager_user)
    employees = (
        CustomUser.objects.filter(
            id__in=team_user_ids, role__code="EMPLOYEE", is_active=True
        )
        .select_related("profile", "profile__department")
        .order_by("profile__full_name")
    )

    # 2. Tính số giờ tiêu chuẩn tối đa (dùng chung trên RAM cho tất cả nhân viên)
    daily_hours = getattr(settings, "DAILY_WORKING_HOURS", 8)
    working_days = calculate_working_days(start_date, end_date)
    max_capacity_hours = working_days * daily_hours

    # 3. HIGH PERFORMANCE: Gom nhóm tính tổng giờ của TẤT CẢ nhân viên trong 1 câu SQL duy nhất (Query #2)
    logs_summary = (
        LogWork.objects.filter(
            user_id__in=team_user_ids,
            work_date__range=(start_date, end_date),
            user__role__code="EMPLOYEE",
            user__is_active=True,
        )
        .exclude(review_status="VOIDED")
        .values("user_id")
        .annotate(total_hours=Sum("hours_spent"))
    )

    # Chuyển kết quả SQL thành Dictionary dạng Lookup Table trên RAM: {user_id: total_hours}
    user_hours_map = {
        item["user_id"]: float(item["total_hours"] or 0.0) for item in logs_summary
    }

    # 4. Tổng hợp dữ liệu trên RAM
    total_team_logged_hours = 0.0
    overloaded_count = 0
    employee_stats_list = []

    for emp in employees:
        # Lấy tổng giờ từ Map trên RAM (nếu không có thì mặc định là 0.0)
        logged_hours = user_hours_map.get(emp.id, 0.0)

        # Tính % Utilization
        if max_capacity_hours > 0:
            rate = round((logged_hours / max_capacity_hours) * 100, 1)
        else:
            rate = 0.0

        # Phân loại trạng thái
        if rate < 70.0:
            status = "Normal"
        elif rate < 90.0:
            status = "High"
        else:
            status = "Overloaded"

        # Đếm thống kê
        total_team_logged_hours += logged_hours
        if status == "Overloaded":
            overloaded_count += 1

        profile = getattr(emp, "profile", None)
        employee_stats_list.append(
            {
                "user_id": emp.id,
                "full_name": (
                    profile.full_name if (profile and profile.full_name) else emp.email
                ),
                "email": emp.email,
                "department_name": (
                    profile.department.name
                    if (profile and profile.department)
                    else None
                ),
                "logged_hours": logged_hours,
                "capacity_hours": float(max_capacity_hours),
                "utilization_rate": rate,
                "workload_status": status,
            }
        )
    return {
        "total_team_logged_hours": round(total_team_logged_hours, 1),
        "overloaded_count": overloaded_count,
        "team_members_count": len(employee_stats_list),
        "employees": employee_stats_list,
    }
