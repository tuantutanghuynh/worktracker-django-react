from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404

from accounts.models import EmployeeProfile
from projects.models import Job
from tasks.models import Task, TaskComment, TaskAttachment
from timesheets.models import LogWork, TimeLock
from system.models import AuditLog


ADMIN_ROLE_CODE = "ADMIN"
MANAGER_ROLE_CODE = "MANAGER"
EMPLOYEE_ROLE_CODE = "EMPLOYEE"


def get_user_role_code(user):
    """
    Lấy role code an toàn.
    """
    role = getattr(user, "role", None)
    return getattr(role, "code", None)


def is_admin(user):
    return get_user_role_code(user) == ADMIN_ROLE_CODE


def is_manager(user):
    return get_user_role_code(user) == MANAGER_ROLE_CODE


def is_employee(user):
    return get_user_role_code(user) == EMPLOYEE_ROLE_CODE


def manager_job_ids(user):
    """
    Danh sách job id thuộc scope của Manager.

    Scope chính thức:
        jobs.manager_id = current_user.id
    """
    if not is_manager(user):
        return Job.objects.none().values_list("id", flat=True)

    return Job.objects.filter(
        manager_id=user.id
    ).values_list("id", flat=True)


def scoped_jobs(user):
    """
    Job queryset đã được scope.

    Admin: thấy tất cả.
    Manager: chỉ thấy Job do mình quản lý.
    Khác: không thấy gì.
    """
    if is_admin(user):
        return Job.objects.all()

    if is_manager(user):
        return Job.objects.filter(manager_id=user.id)

    return Job.objects.none()


def scoped_tasks(user):
    """
    Task queryset đã được scope.

    Manager thấy task thuộc job do Manager đó quản lý.
    """
    if is_admin(user):
        return Task.objects.all()

    if is_manager(user):
        return Task.objects.filter(job__manager_id=user.id)

    return Task.objects.none()


def scoped_task_comments(user):
    """
    Comment queryset đã được scope theo task -> job -> manager.
    """
    if is_admin(user):
        return TaskComment.objects.all()

    if is_manager(user):
        return TaskComment.objects.filter(
            task__job__manager_id=user.id
        )

    return TaskComment.objects.none()


def scoped_task_attachments(user):
    """
    Attachment queryset đã được scope theo task -> job -> manager.
    """
    if is_admin(user):
        return TaskAttachment.objects.all()

    if is_manager(user):
        return TaskAttachment.objects.filter(
            task__job__manager_id=user.id
        )

    return TaskAttachment.objects.none()


def scoped_logworks(user):
    """
    LogWork queryset đã được scope theo log_work -> task -> job -> manager.
    """
    if is_admin(user):
        return LogWork.objects.all()

    if is_manager(user):
        return LogWork.objects.filter(
            task__job__manager_id=user.id
        )

    return LogWork.objects.none()


def scoped_timelocks(user):
    """
    TimeLock queryset đã được scope.

    Manager xử lý JOB lock thuộc Job do mình quản lý
    đồng thời được phép xem các bản ghi GLOBAL lock của Admin
    để nắm bắt trạng thái khóa sổ toàn hệ thống.
    """
    if is_admin(user):
        return TimeLock.objects.all()

    if is_manager(user):
        return TimeLock.objects.filter(
            Q(lock_scope=TimeLock.LockScope.JOB, job__manager_id=user.id)
            | Q(lock_scope=TimeLock.LockScope.GLOBAL)
        )

    return TimeLock.objects.none()


def scoped_team_user_ids(user):
    """
    Danh sách user id của Employee đang được giao ít nhất 1 task
    trong các job thuộc Manager.

    Dùng cho Team Directory trong scope.
    """
    if not is_manager(user):
        return Task.objects.none().values_list("assignee_id", flat=True)

    return (
        Task.objects.filter(job__manager_id=user.id)
        .values_list("assignee_id", flat=True)
        .distinct()
    )


def employee_job_ids(user):
    """
    Danh sách job id mà Employee đang có ít nhất 1 task được giao.

    Dùng cho "My Team" — Employee xem đồng nghiệp cùng dự án.
    Đối xứng với scoped_team_user_ids() (bản phía Manager).
    """
    if not is_employee(user):
        return Task.objects.none().values_list("job_id", flat=True)

    return (
        Task.objects.filter(assignee_id=user.id)
        .values_list("job_id", flat=True)
        .distinct()
    )


def scoped_team_profiles(user):
    """
    Profile Employee thuộc Team Directory của Manager.

    Chỉ gồm Employee đã từng/có task trong job thuộc Manager.
    """
    if is_admin(user):
        return EmployeeProfile.objects.select_related(
            "user",
            "department",
        ).all()

    if is_manager(user):
        return EmployeeProfile.objects.filter(
            user_id__in=scoped_team_user_ids(user)
        ).select_related(
            "user",
            "department",
        )

    return EmployeeProfile.objects.none()


def assignment_search_employees_queryset(job_id=None):
    """
    Queryset dung rieng cho man hinh tim Employee de giao task (Project Team Scope).

    Theo Quy trinh moi:
    - Khi Manager giao Task trong 1 Job (co job_id):
      Chi lay nhung Employee da duoc phan bo vao Project Team cua Job do.
    - Neu Job moi khoi tao hoac khong truyen job_id:
      Tra ve danh sach Active Employee hop le.
    """
    User = get_user_model()

    qs = User.objects.filter(
        is_active=True,
        role__code=EMPLOYEE_ROLE_CODE,
    ).select_related(
        "role",
        "profile",
        "profile__department",
    )

    if job_id:
        from chat.models import ChatParticipant
        task_assignee_ids = set(Task.objects.filter(job_id=job_id).values_list("assignee_id", flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job_id=job_id, room__room_type='JOB')
            .values_list('user_id', flat=True)
            .distinct()
        )
        team_user_ids = task_assignee_ids | team_participant_ids
        if team_user_ids:
            qs = qs.filter(id__in=team_user_ids)
        else:
            qs = qs.none()

    return qs


def get_scoped_object_or_404(scoped_queryset, **lookup):
    """
    Lấy object bên trong queryset đã scope.

    Nếu record không tồn tại hoặc nằm ngoài scope:
        trả 404.

    Cách này tránh lộ thông tin rằng record ngoài scope có tồn tại.
    """
    return get_object_or_404(scoped_queryset, **lookup)


def assert_job_in_manager_scope(user, job):
    """
    Dùng trong service khi đã có object Job.

    Nếu job không thuộc Manager hiện tại thì raise PermissionError.
    """
    if not is_manager(user):
        raise PermissionError("USER_IS_NOT_MANAGER")

    if job.manager_id != user.id:
        raise PermissionError("JOB_OUT_OF_MANAGER_SCOPE")


def scoped_audit_logs(user):
    """
    AuditLog queryset được bảo vệ chặt chẽ theo Scope của Manager:
    1. Các hành động do chính Manager đó thực hiện (user=user).
    2. Các hành động của nhân viên trên các đối tượng (Jobs, Tasks, LogWorks, TimeLocks)
       thuộc Job do Manager đó phụ trách (job.manager_id = user.id).

    CHẶN HOÀN TOÀN:
    - Không thể xem hành động của Manager khác.
    - Không thể xem hành động của Admin.
    - Không thể xem hành động của Employee trên các Job thuộc Manager khác.
    """
    if is_admin(user):
        return AuditLog.objects.all()

    if not is_manager(user):
        return AuditLog.objects.none()

    job_ids = list(Job.objects.filter(manager_id=user.id).values_list("id", flat=True))
    task_ids = list(Task.objects.filter(job_id__in=job_ids).values_list("id", flat=True))
    logwork_ids = list(LogWork.objects.filter(task_id__in=task_ids).values_list("id", flat=True))
    timelock_ids = list(TimeLock.objects.filter(job_id__in=job_ids).values_list("id", flat=True))

    scope_condition = (
        Q(user=user)
        | (Q(table_name="jobs") & Q(record_id__in=job_ids))
        | (Q(table_name="tasks") & Q(record_id__in=task_ids))
        | (Q(table_name="log_works") & Q(record_id__in=logwork_ids))
        | (Q(table_name="timesheets") & Q(record_id__in=logwork_ids))
        | (Q(table_name="time_locks") & Q(record_id__in=timelock_ids))
        | (Q(table_name="timelocks") & Q(record_id__in=timelock_ids))
    )

    return AuditLog.objects.filter(scope_condition).distinct()