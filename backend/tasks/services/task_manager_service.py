from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from projects.models import Job
from tasks.models import Task, TaskFollower
from system.models import Notification
from system.security.scoping_manager import scoped_jobs, scoped_tasks, get_scoped_object_or_404
from system.services.audit_manager_service import snapshot, log_action
from system.services.notification_manager_service import notify

from tasks.services.order_index_manager_service import key_between
from tasks.services.task_transition_manager_service import apply_transition


EMPLOYEE_ROLE_CODE = "EMPLOYEE"

JOB_STATUS_ALLOW_CREATE = [
    Job.Status.PLANNING,
    Job.Status.ACTIVE,
]


class BusinessRuleError(APIException):
    status_code = 400
    default_detail = "Business rule violation."
    default_code = "business_rule_error"


def assert_task_in_manager_scope(user, task):
    """
    Manager chỉ được thao tác task thuộc job do mình quản lý.
    """
    if task.job.manager_id != user.id:
        raise PermissionDenied("TASK_OUT_OF_MANAGER_SCOPE")


def get_active_employee_or_error(user_id, manager=None):
    """
    Lấy assignee hợp lệ.

    Theo FR-34, task được giao cho Employee.

    Khi truyền `manager`, hàm còn kiểm tra Employee đó có thuộc tuyến báo cáo
    của Manager này không (EmployeeProfile.manager). Đây là chốt chặn để một
    Manager không giao được việc cho nhân viên của Manager khác — trước đây
    chỉ kiểm role nên ai cũng giao cho ai cũng được.

    Đặt luật ở đây chứ không ở serializer vì đây là điểm nghẽn duy nhất: cả
    create_task lẫn update_task đều đi qua hàm này.
    """
    User = get_user_model()

    try:
        user = User.objects.select_related("role", "profile").get(
            id=user_id,
            is_active=True,
        )
    except User.DoesNotExist:
        raise ValidationError(
            {
                "assignee_id": "Active assignee does not exist."
            }
        )

    role_code = getattr(getattr(user, "role", None), "code", None)

    if role_code != EMPLOYEE_ROLE_CODE:
        raise ValidationError(
            {
                "assignee_id": "Assignee must be an active Employee."
            }
        )

    if manager is not None:
        assignee_manager_id = getattr(getattr(user, "profile", None), "manager_id", None)
        if assignee_manager_id != manager.id:
            raise ValidationError(
                {
                    "assignee_id": (
                        "This employee is not in your reporting line. "
                        "Contact an Admin if they need to be transferred."
                    )
                }
            )

    return user


def validate_task_deadline(job, deadline, is_create=False):
    if not deadline:
        return

    today = timezone.localdate()
    if is_create and deadline < today:
        raise ValidationError(
            {
                "deadline": f"Task deadline cannot be in the past (must be on or after {today})."
            }
        )

    if job and job.deadline and deadline > job.deadline:
        raise ValidationError(
            {
                "deadline": f"Task deadline cannot exceed project deadline ({job.deadline})."
            }
        )


def get_last_order_key(job_id, status):
    last_task = (
        Task.objects.filter(
            job_id=job_id,
            status=status,
        )
        .order_by("-order_index")
        .first()
    )

    return last_task.order_index if last_task else None


def add_default_followers(task, users):
    """
    Thêm follower cho task.

    ignore_conflicts=True để không lỗi nếu user đã follow trước đó.
    """
    follower_rows = []

    for user in users:
        if user and user.id:
            follower_rows.append(
                TaskFollower(
                    task=task,
                    user=user,
                )
            )

    if follower_rows:
        TaskFollower.objects.bulk_create(
            follower_rows,
            ignore_conflicts=True,
        )


def create_task(*, user, data, request=None):
    """
    Manager tạo Task.

    data dự kiến gồm:
        job_id
        assignee_id
        title
        description
        priority
        deadline
    """
    job_id = data.get("job_id")
    assignee_id = data.get("assignee_id")
    title = data.get("title")
    description = data.get("description")
    priority = data.get("priority", Task.Priority.MEDIUM)
    deadline = data.get("deadline")

    if not job_id:
        raise ValidationError(
            {
                "job_id": "job_id is required."
            }
        )

    if not title:
        raise ValidationError(
            {
                "title": "title is required."
            }
        )

    with transaction.atomic():
        job = get_scoped_object_or_404(
            scoped_jobs(user).select_related("client").select_for_update(),
            pk=job_id,
        )

        # 🛡️ DEFENSIVE GUARD: Khóa tạo Task nếu Client bị Admin vô hiệu hóa
        if job.client and not job.client.is_active:
            raise BusinessRuleError(
                f"Cannot create task because client '{job.client.client_name}' is deactivated by Admin. "
                "The project is frozen."
            )

        if job.status not in JOB_STATUS_ALLOW_CREATE:
            raise BusinessRuleError("JOB_STATUS_DOES_NOT_ALLOW_TASK_CREATE")

        if assignee_id:
            assignee = get_active_employee_or_error(assignee_id, manager=user)
        else:
            # Nếu chưa chọn nhân viên: Mặc định tạm gán cho chính Manager tạo task (Unassigned draft)
            assignee = user

        last_key = get_last_order_key(
            job_id=job.id,
            status=Task.Status.TODO,
        )

        task = Task.objects.create(
            job=job,
            assignee=assignee,
            creator=user,
            title=title,
            description=description,
            priority=priority,
            status=Task.Status.TODO,
            deadline=deadline,
            order_index=key_between(last_key, None),
        )

        add_default_followers(
            task=task,
            users=list(set([assignee, user])),
        )

        # Tự động cập nhật thành viên dự án (ChatParticipant) nếu là nhân viên
        if assignee.id != user.id:
            from chat.models import ChatRoom, ChatParticipant
            room = ChatRoom.objects.filter(job=job, room_type=ChatRoom.RoomType.JOB).first()
            if room:
                ChatParticipant.objects.get_or_create(room=room, user=assignee)

        log_action(
            user=user,
            action="CREATE_TASK",
            table_name="tasks",
            record_id=task.id,
            old_values=None,
            new_values=snapshot(
                task,
                fields=[
                    "job",
                    "assignee",
                    "creator",
                    "title",
                    "description",
                    "priority",
                    "status",
                    "deadline",
                    "order_index",
                ],
            ),
            request=request,
        )

        if assignee.id != user.id:
            notify(
                recipients=[assignee],
                event_type=Notification.EventType.TASK_ASSIGNED,
                title="New task assigned",
                content=f"You have been assigned to task: {task.title}",
                related_url="/employee/my-tasks",
                channel=Notification.ChannelType.SYSTEM_ONLY,
            )

    return task


def update_task(*, user, task, data, request=None):
    """
    Manager cập nhật Task.

    Cho phép:
    - title
    - description
    - priority
    - deadline
    - assignee_id
    """
    allowed_fields = {
        "title",
        "description",
        "priority",
        "deadline",
        "assignee_id",
    }

    invalid_fields = set(data.keys()) - allowed_fields

    if invalid_fields:
        raise ValidationError(
            {
                "forbidden_fields": sorted(invalid_fields)
            }
        )

    with transaction.atomic():
        locked_task = (
            scoped_tasks(user)
            .select_for_update()
            .select_related("job", "job__client", "assignee", "creator")
            .get(pk=task.pk)
        )

        assert_task_in_manager_scope(user, locked_task)

        # 🛡️ DEFENSIVE GUARD: Khóa cập nhật Task nếu Client bị Admin vô hiệu hóa
        if locked_task.job.client and not locked_task.job.client.is_active:
            raise BusinessRuleError(
                f"Cannot update task because client '{locked_task.job.client.client_name}' is deactivated by Admin. "
                "The project is frozen."
            )

        old_values = snapshot(
            locked_task,
            fields=[
                "title",
                "description",
                "priority",
                "deadline",
                "assignee",
            ],
        )

        assignee_changed = False
        new_assignee = None

        if "title" in data:
            locked_task.title = data["title"]

        if "description" in data:
            locked_task.description = data["description"]

        if "priority" in data:
            locked_task.priority = data["priority"]

        if "deadline" in data:
            validate_task_deadline(
                job=locked_task.job,
                deadline=data["deadline"],
            )
            locked_task.deadline = data["deadline"]

        if "assignee_id" in data:
            new_assignee = get_active_employee_or_error(data["assignee_id"], manager=user)

            if locked_task.assignee_id != new_assignee.id:
                locked_task.assignee = new_assignee
                assignee_changed = True

        locked_task.save(
            update_fields=[
                "title",
                "description",
                "priority",
                "deadline",
                "assignee",
                "updated_at",
            ]
        )

        if assignee_changed:
            add_default_followers(
                task=locked_task,
                users=[
                    new_assignee,
                    user,
                ],
            )

            # Tự động cập nhật thành viên dự án (ChatParticipant) nếu là nhân viên
            if new_assignee and new_assignee.id != user.id:
                from chat.models import ChatRoom, ChatParticipant
                room = ChatRoom.objects.filter(job=locked_task.job, room_type=ChatRoom.RoomType.JOB).first()
                if room:
                    ChatParticipant.objects.get_or_create(room=room, user=new_assignee)

            notify(
                recipients=[new_assignee],
                event_type=Notification.EventType.TASK_ASSIGNED,
                title="Task assigned",
                content=f"You have been assigned to task: {locked_task.title}",
                related_url="/employee/my-tasks",
                channel=Notification.ChannelType.SYSTEM_ONLY,
            )

        log_action(
            user=user,
            action="UPDATE_TASK",
            table_name="tasks",
            record_id=locked_task.id,
            old_values=old_values,
            new_values=snapshot(
                locked_task,
                fields=[
                    "title",
                    "description",
                    "priority",
                    "deadline",
                    "assignee",
                ],
            ),
            request=request,
        )

    return locked_task


def get_neighbor_task(user, task_id, job_id, status):
    if not task_id:
        return None

    return get_scoped_object_or_404(
        scoped_tasks(user).filter(
            job_id=job_id,
            status=status,
        ),
        pk=task_id,
    )


def move_task_kanban(
    *,
    user,
    task,
    to_status=None,
    prev_task_id=None,
    next_task_id=None,
    reason=None,
    request=None,
):
    """
    Kanban drag-and-drop.

    FR-39 chia làm 2 trường hợp:
    1. Reorder cùng cột:
       - Chỉ đổi order_index.
       - Không validate transition.
    2. Kéo sang cột khác:
       - Phải gọi state machine apply_transition().
       - Transition sai phải bị backend reject.
    """
    with transaction.atomic():
        locked_task = (
            scoped_tasks(user)
            .select_for_update()
            .select_related("job", "job__client", "assignee", "creator")
            .get(pk=task.pk)
        )

        assert_task_in_manager_scope(user, locked_task)

        # 🛡️ DEFENSIVE GUARD: Khóa kéo thả Kanban nếu Client bị Admin vô hiệu hóa
        if locked_task.job.client and not locked_task.job.client.is_active:
            raise BusinessRuleError(
                f"Cannot move or reorder task '{locked_task.title}' because client '{locked_task.job.client.client_name}' is deactivated by Admin. The project is frozen."
            )

        target_status = to_status or locked_task.status

        valid_statuses = {
            value
            for value, label in Task.Status.choices
        }

        if target_status not in valid_statuses:
            raise ValidationError(
                {
                    "to_status": "Invalid task status."
                }
            )

        prev_task = get_neighbor_task(
            user=user,
            task_id=prev_task_id,
            job_id=locked_task.job_id,
            status=target_status,
        )

        next_task = get_neighbor_task(
            user=user,
            task_id=next_task_id,
            job_id=locked_task.job_id,
            status=target_status,
        )

        prev_key = prev_task.order_index if prev_task else None
        next_key = next_task.order_index if next_task else None

        new_order_index = key_between(prev_key, next_key)

        if target_status == locked_task.status:
            old_values = snapshot(
                locked_task,
                fields=["order_index"],
            )

            locked_task.order_index = new_order_index
            locked_task.save(
                update_fields=[
                    "order_index",
                    "updated_at",
                ]
            )

            log_action(
                user=user,
                action="REORDER_TASK",
                table_name="tasks",
                record_id=locked_task.id,
                old_values=old_values,
                new_values=snapshot(
                    locked_task,
                    fields=["order_index"],
                ),
                request=request,
            )

            return locked_task

        transitioned_task = apply_transition(
            user=user,
            task=locked_task,
            to_status=target_status,
            reason=reason,
            request=request,
        )

        transitioned_task.order_index = new_order_index
        transitioned_task.save(
            update_fields=[
                "order_index",
                "updated_at",
            ]
        )

    return transitioned_task