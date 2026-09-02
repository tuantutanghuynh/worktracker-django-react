from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Q, Sum, Max
from django.utils import timezone

from accounts.models import CustomUser, EmployeeProfile
from timesheets.models import DailyUserTimesheet, LogWork, TimeLock
from timesheets.services.manager_employee_utilization_service import calculate_working_days


def decimal_to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return value


def get_month_range(month, year):
    start_date = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end_date = date(year, month, last_day)
    return start_date, end_date


def _daily_working_hours():
    return getattr(settings, "DAILY_WORKING_HOURS", 8)


def _warning_threshold():
    """Tỷ lệ giờ tối thiểu so với chỉ tiêu trước khi bị gắn WARNING."""
    return getattr(settings, "TIMESHEET_WARNING_THRESHOLD", 0.8)


def get_elapsed_working_days(start_date, end_date, joined_date=None):
    """
    Số ngày làm việc đã THỰC SỰ trôi qua tính tới hôm nay.

    Khi đang xem tháng hiện tại, không được so với cả tháng: ngày mai và
    những ngày còn lại chưa tới thì chưa thể coi là "chưa chấm công". Nếu
    lấy cả tháng thì giữa tháng ai cũng bị tính thiếu vài ngày và luôn hiện
    MISSING dù đã log đầy đủ. Với tháng đã qua thì mốc vẫn là cuối tháng.

    `joined_date` dời mốc BẮT ĐẦU đếm về ngày nhân viên vào làm. Người vào
    ngày 20 không thể bị tính thiếu công từ mùng 1 — họ chưa thuộc công ty.
    Không truyền thì đếm từ đầu tháng như cũ (dùng cho chỉ số toàn công ty).
    """
    today = timezone.now().date()
    if today < start_date:
        return 0  # tháng ở tương lai — chưa có ngày nào phải chấm công

    effective_start = start_date
    if joined_date and joined_date > start_date:
        effective_start = joined_date

    effective_end = min(end_date, today)
    if effective_start > effective_end:
        # Vào làm sau khoảng đang xem (hoặc sau hôm nay) — chưa có ngày công nào
        return 0
    return calculate_working_days(effective_start, effective_end)


def get_admin_timesheet_summary(month, year):
    """
    5 KPI card cho trang Timesheet Control.

    "Violation" và "Missing" ở đây dùng đúng cấu hình/ràng buộc THẬT đã có
    sẵn trong hệ thống (settings.DAILY_WORKING_HOURS, DailyUserTimesheet,
    calculate_working_days) — không bịa ra ngưỡng 10h/12h như bản mockup
    tĩnh, vì hệ thống chưa từng định nghĩa 2 mốc đó ở bất kỳ đâu.
    """
    start_date, end_date = get_month_range(month, year)
    daily_hours = _daily_working_hours()

    # Cùng luật vòng đời với get_admin_employee_timesheet_list(): người vào
    # làm sau ngày cuối kỳ không thuộc kỳ này. Hai hàm phải dùng chung một
    # tập nhân viên, nếu không thẻ KPI sẽ nói một đằng còn bảng bên dưới
    # hiện một nẻo.
    employee_ids = list(
        CustomUser.objects.filter(role__code="EMPLOYEE", is_active=True)
        .filter(Q(profile__joined_date__isnull=True) | Q(profile__joined_date__lte=end_date))
        .values_list("id", flat=True)
    )

    logs_in_range = LogWork.objects.filter(
        user_id__in=employee_ids,
        work_date__range=(start_date, end_date),
    ).exclude(review_status=LogWork.ReviewStatus.VOIDED)

    total_logged_hours = decimal_to_float(logs_in_range.aggregate(total=Sum("hours_spent"))["total"])
    active_employees = logs_in_range.values("user_id").distinct().count()

    # Historical total across the whole system, not just the selected
    # month — matches "Immutable records" wording in the design (a
    # locked period stays locked regardless of which month you're viewing).
    locked_periods_count = TimeLock.objects.filter(is_locked=True).count()

    timesheet_violations = DailyUserTimesheet.objects.filter(
        user_id__in=employee_ids,
        work_date__range=(start_date, end_date),
        total_hours__gt=daily_hours,
    ).count()

    # So với số ngày làm việc ĐÃ TRÔI QUA, không phải cả tháng — xem
    # get_elapsed_working_days().
    elapsed_working_days = get_elapsed_working_days(start_date, end_date)
    logged_days_by_user = dict(
        DailyUserTimesheet.objects.filter(
            user_id__in=employee_ids,
            work_date__range=(start_date, end_date),
            total_hours__gt=0,
        )
        .values("user_id")
        .annotate(days=Count("id"))
        .values_list("user_id", "days")
    )
    # Mốc riêng cho từng người theo ngày vào làm — cộng dồn con số của mỗi
    # nhân viên chứ không nhân chung một mốc, nếu không nhân viên mới sẽ đội
    # số "thiếu chấm công" của toàn công ty lên.
    joined_by_user = dict(
        EmployeeProfile.objects.filter(user_id__in=employee_ids)
        .values_list("user_id", "joined_date")
    )
    missing_timesheets = 0
    for uid in employee_ids:
        joined = joined_by_user.get(uid)
        days = (
            get_elapsed_working_days(start_date, end_date, joined)
            if joined
            else elapsed_working_days
        )
        missing_timesheets += max(days - logged_days_by_user.get(uid, 0), 0)

    return {
        "total_logged_hours": round(total_logged_hours, 1),
        "active_employees": active_employees,
        "locked_periods_count": locked_periods_count,
        "timesheet_violations": timesheet_violations,
        "missing_timesheets": missing_timesheets,
    }


def get_admin_employee_timesheet_list(month, year, department_id=None, manager_id=None, search=None):
    """
    Bảng "theo từng nhân viên" — HIGH-PERFORMANCE SUMMARY: gom nhóm bằng
    GROUP BY thay vì N+1 query, cùng kỹ thuật với
    manager_employee_utilization_service.get_team_workload_summary(), chỉ
    khác là KHÔNG scope theo 1 Manager mà lấy toàn công ty.

    Trả về list dict đã sort theo tên — pagination do view xử lý (dữ liệu
    đã tổng hợp trên RAM, không còn là 1 QuerySet đơn giản để DRF tự
    paginate ở tầng SQL).
    """
    start_date, end_date = get_month_range(month, year)
    daily_hours = _daily_working_hours()

    # working_days = cả tháng, dùng làm MỤC TIÊU của tháng (target_hours,
    # thanh tiến độ). elapsed = phần đã trôi qua, dùng để đánh giá nhân viên
    # có đang theo kịp hay không — mọi so sánh "thiếu / ít giờ" phải dựa vào
    # mốc này, nếu không thì giữa tháng ai cũng bị coi là thiếu.
    working_days = calculate_working_days(start_date, end_date)
    target_hours = working_days * daily_hours
    elapsed_working_days = get_elapsed_working_days(start_date, end_date)

    employees = CustomUser.objects.filter(role__code="EMPLOYEE", is_active=True).select_related(
        "profile", "profile__department"
    )
    # LỌC THEO VÒNG ĐỜI NHÂN SỰ
    #
    # Nhân viên vào làm SAU ngày cuối kỳ thì không thuộc kỳ đó — họ chưa
    # thuộc công ty, không thể chấm công, và không thể "thiếu" gì cả. Trước
    # đây mọi kỳ quá khứ đều liệt kê đủ nhân viên và gắn MISSING cho tất cả,
    # kể cả những tháng hệ thống chưa có một dòng log nào.
    #
    # Cùng nguyên tắc với ManagerTimeLockPage của phần Manager: Job có
    # start_date sau ngày cuối kỳ thì không hiện trong kỳ đó.
    #
    # joined_date NULL nghĩa là KHÔNG BIẾT ngày vào làm — vẫn hiện, vì ẩn đi
    # sẽ giấu mất người thật. Hiện thừa thì Admin còn thấy để sửa dữ liệu;
    # ẩn nhầm thì không ai biết là đang thiếu.
    employees = employees.filter(
        Q(profile__joined_date__isnull=True) | Q(profile__joined_date__lte=end_date)
    )
    if department_id:
        employees = employees.filter(profile__department_id=department_id)
    if manager_id:
        employees = employees.filter(profile__department__manager_id=manager_id)
    if search:
        employees = employees.filter(Q(email__icontains=search) | Q(profile__full_name__icontains=search))
    employees = employees.order_by("profile__full_name", "email")

    employee_ids = list(employees.values_list("id", flat=True))

    hours_by_user = dict(
        LogWork.objects.filter(user_id__in=employee_ids, work_date__range=(start_date, end_date))
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .values("user_id")
        .annotate(total=Sum("hours_spent"))
        .values_list("user_id", "total")
    )
    # Giờ tính TỚI HÔM NAY — dùng riêng cho avg_per_day. Không được lấy
    # month_hours (cả tháng) chia cho elapsed_working_days (chỉ phần đã qua):
    # backend không chặn log ngày tương lai, nên nếu ai đó log trước cho
    # cuối tháng thì tử số có mà mẫu số chưa có, avg vọt lên vô lý
    # (vd 208h / 20 ngày = 10.4h/ngày dù thực tế chỉ làm 8h/ngày).
    elapsed_end = min(end_date, timezone.now().date())
    hours_to_date_by_user = dict(
        LogWork.objects.filter(user_id__in=employee_ids, work_date__range=(start_date, elapsed_end))
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .values("user_id")
        .annotate(total=Sum("hours_spent"))
        .values_list("user_id", "total")
    ) if elapsed_end >= start_date else {}
    last_entry_by_user = dict(
        LogWork.objects.filter(user_id__in=employee_ids, work_date__range=(start_date, end_date))
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .values("user_id")
        .annotate(last_date=Max("work_date"))
        .values_list("user_id", "last_date")
    )
    violations_by_user = dict(
        DailyUserTimesheet.objects.filter(
            user_id__in=employee_ids, work_date__range=(start_date, end_date), total_hours__gt=daily_hours
        )
        .values("user_id")
        .annotate(count=Count("id"))
        .values_list("user_id", "count")
    )
    logged_days_by_user = dict(
        DailyUserTimesheet.objects.filter(
            user_id__in=employee_ids, work_date__range=(start_date, end_date), total_hours__gt=0
        )
        .values("user_id")
        .annotate(days=Count("id"))
        .values_list("user_id", "days")
    )

    results = []
    for emp in employees:
        profile = getattr(emp, "profile", None)
        logged_hours = decimal_to_float(hours_by_user.get(emp.id))
        logged_hours_to_date = decimal_to_float(hours_to_date_by_user.get(emp.id))
        violations = violations_by_user.get(emp.id, 0)

        # Mốc đếm riêng cho từng người: ai vào làm giữa tháng thì chỉ bị tính
        # từ ngày vào làm trở đi. Dùng chung một con số cho cả công ty sẽ báo
        # nhân viên mới thiếu công những ngày họ chưa thuộc công ty — và người
        # quản lý sẽ nhanh chóng học cách bỏ qua cảnh báo của hệ thống.
        joined_date = profile.joined_date if profile else None
        emp_elapsed_days = (
            get_elapsed_working_days(start_date, end_date, joined_date)
            if joined_date
            else elapsed_working_days
        )
        emp_expected_hours = emp_elapsed_days * daily_hours

        missing_days = max(emp_elapsed_days - logged_days_by_user.get(emp.id, 0), 0)

        if violations > 0:
            status = "OVER_LIMIT"
        elif missing_days > 0:
            status = "MISSING"
        elif emp_expected_hours > 0 and logged_hours < emp_expected_hours * _warning_threshold():
            status = "WARNING"
        else:
            status = "NORMAL"

        results.append(
            {
                "user_id": emp.id,
                "full_name": profile.full_name if (profile and profile.full_name) else emp.email,
                "email": emp.email,
                "department_id": profile.department_id if profile else None,
                "department_name": profile.department.name if (profile and profile.department) else None,
                "month_hours": round(logged_hours, 2),
                "target_hours": float(target_hours),
                # Giờ-tới-hôm-nay chia cho ngày-làm-việc-tới-hôm-nay: cùng
                # một khoảng thời gian ở cả tử và mẫu.
                "avg_per_day": (
                    round(logged_hours_to_date / emp_elapsed_days, 2)
                    if emp_elapsed_days
                    else 0.0
                ),
                "violations": violations,
                "missing_days": missing_days,
                "status": status,
                "last_entry": last_entry_by_user.get(emp.id),
            }
        )

    return results


def get_admin_employee_timesheet_detail(user_id, month, year):
    """
    Compliance drill-down cho 1 nhân viên — panel bên phải.
    """
    start_date, end_date = get_month_range(month, year)
    daily_hours = _daily_working_hours()
    working_days = calculate_working_days(start_date, end_date)
    joined_date = (
        EmployeeProfile.objects.filter(user_id=user_id)
        .values_list("joined_date", flat=True)
        .first()
    )
    elapsed_working_days = get_elapsed_working_days(start_date, end_date, joined_date)

    logs_in_range = LogWork.objects.filter(user_id=user_id, work_date__range=(start_date, end_date)).exclude(
        review_status=LogWork.ReviewStatus.VOIDED
    )
    month_hours = decimal_to_float(logs_in_range.aggregate(total=Sum("hours_spent"))["total"])
    edited_records = logs_in_range.filter(adjusted_by__isnull=False).count()

    # Cùng lý do với hàm danh sách: avg phải lấy giờ-tới-hôm-nay chia
    # ngày-làm-việc-tới-hôm-nay, không trộn cả tháng với phần đã qua.
    elapsed_end = min(end_date, timezone.now().date())
    hours_to_date = (
        decimal_to_float(
            logs_in_range.filter(work_date__lte=elapsed_end).aggregate(total=Sum("hours_spent"))["total"]
        )
        if elapsed_end >= start_date
        else 0.0
    )

    daily_over_limit = DailyUserTimesheet.objects.filter(
        user_id=user_id, work_date__range=(start_date, end_date), total_hours__gt=daily_hours
    ).count()
    daily_hard_limit = DailyUserTimesheet.objects.filter(
        user_id=user_id, work_date__range=(start_date, end_date), total_hours__gte=24
    ).count()

    logged_days = DailyUserTimesheet.objects.filter(
        user_id=user_id, work_date__range=(start_date, end_date), total_hours__gt=0
    ).count()
    missing_days = max(elapsed_working_days - logged_days, 0)

    # GLOBAL lock covering this period, if any — this page's Lock/Unlock
    # button only ever creates/toggles GLOBAL scope locks (see
    # timelock_manager_service.lock_global_period), so that's the only
    # scope relevant to this Admin-facing panel.
    global_lock = TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL, job__isnull=True, lock_month=month, lock_year=year
    ).select_related("locked_by", "unlocked_by").first()

    locked_period_edits = 0
    if global_lock and global_lock.locked_at:
        locked_period_edits = logs_in_range.filter(updated_at__gt=global_lock.locked_at).count()

    return {
        "month_hours": round(month_hours, 2),
        "working_days": working_days,
        "elapsed_working_days": elapsed_working_days,
        "avg_per_day": (
            round(hours_to_date / elapsed_working_days, 2) if elapsed_working_days else 0.0
        ),
        "edited_records": edited_records,
        "daily_over_limit_count": daily_over_limit,
        "daily_hard_limit_count": daily_hard_limit,
        "locked_period_edits": locked_period_edits,
        "missing_days": missing_days,
        "global_lock": (
            {
                "id": global_lock.id,
                "is_locked": global_lock.is_locked,
                "locked_by": global_lock.locked_by.email if global_lock.locked_by else None,
                "locked_at": global_lock.locked_at,
                "lock_reason": global_lock.lock_reason,
                "unlocked_by": global_lock.unlocked_by.email if global_lock.unlocked_by else None,
                "unlocked_at": global_lock.unlocked_at,
                "unlock_reason": global_lock.unlock_reason,
            }
            if global_lock
            else None
        ),
    }
