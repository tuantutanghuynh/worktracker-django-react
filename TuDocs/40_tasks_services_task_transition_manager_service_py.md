# Executive Code Annotation: `backend/tasks/services/task_transition_manager_service.py`

**Package / Module:** `backend.tasks.services.task_transition_manager_service` · Task State Machine & Transition Service

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Ma Trận Chuyển Trạng Thái Task (Task State Machine Diagram)

```
                       ┌─────────────────────────┐
                       │          TODO           │
                       └────────────┬────────────┘
                                    │ (Assignee / Manager)
                                    ▼
┌──────────────┐       ┌─────────────────────────┐
│   CANCELLED  │◄──────┤       IN_PROGRESS       │
└──────▲───────┘       └────────────┬────────────┘
       │                            │ (Assignee)
       │                            ▼
       │               ┌─────────────────────────┐
       └───────────────┤        REVIEWING        │
                       └────────────┬────────────┘
                                    │ (Job Manager Only)
                                    ▼
                       ┌─────────────────────────┐
                       │        COMPLETED        │
                       └─────────────────────────┘
```

> **Vì sao phải khóa dòng dữ liệu (`select_for_update()`) trước khi thực thi chuyển đổi trạng thái Task?**
> Trong môi trường nhiều người dùng cùng thao tác (VD: Nhân viên vừa bấm Submit duyệt Task trong khi Manager cũng vừa bấm Hủy Task đó), việc không khóa dữ liệu sẽ dẫn tới hiện tượng **Race Condition** (Tranh chấp dữ liệu). `select_for_update()` phát ra câu lệnh SQL `SELECT ... FOR UPDATE` nhằm khóa bản ghi Task trong CSDL lại cho đến khi giao dịch `transaction.atomic()` kết thúc, đảm bảo tính toàn vẹn tuyệt đối cho State Machine.

> **Vì sao chỉ có `ACTOR_JOB_MANAGER` mới được phép duyệt Task (`REVIEWING` -> `COMPLETED`)?**
> Đây là nguyên tắc phân định trách nhiệm nghiêm ngặt: Nhân viên (`ASSIGNEE`) chỉ được phép nộp bài (`REVIEWING`), không được tự mình công nhận hoàn thành công việc. Việc nghiệm thu kết quả và xác nhận hoàn thành công việc bắt buộc phải do Quản lý dự án (`JOB_MANAGER`) đánh giá và ký duyệt.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Thư Viện, Hằng Số & Custom Exceptions (Imports & Constants)

```python
from django.db import transaction
# "from django.db import transaction" = quản lý giao dịch CSDL nguyên tử.

from django.utils import timezone
# "from django.utils import timezone" = lấy thời gian hiện tại chuẩn múi giờ hệ thống (Asia/Ho_Chi_Minh).

from rest_framework.exceptions import APIException, PermissionDenied
# Import ngoại lệ API để ném lỗi chuẩn DRF khi vi phạm State Machine hoặc phân quyền.

from tasks.models import Task, TaskComment
# Import model `Task` và `TaskComment`.

from system.models import Notification
# Import model `Notification` phục vụ thông báo hệ thống.

from system.services.audit_manager_service import snapshot, log_action
# Import service chụp snapshot dữ liệu và ghi nhật ký Audit Log.

from system.services.notification_manager_service import (
    notify,
    resolve_task_recipients,
)
# Service giải mã danh sách người nhận và phát thông báo.

ACTOR_ASSIGNEE = "ASSIGNEE"       # Người được giao việc
ACTOR_JOB_MANAGER = "JOB_MANAGER" # Quản lý dự án
ACTOR_ADMIN = "ADMIN"             # Quản trị viên hệ thống

ADMIN_ROLE_CODE = "ADMIN"
MANAGER_ROLE_CODE = "MANAGER"
EMPLOYEE_ROLE_CODE = "EMPLOYEE"

class InvalidTaskTransition(APIException):
# "class InvalidTaskTransition(APIException):" = Lỗi 400 khi cố tình chuyển trạng thái không hợp lệ (VD: TODO -> COMPLETED).
    status_code = 400
    default_detail = "Invalid task status transition."
    default_code = "invalid_task_transition"

class BusinessRuleError(APIException):
# "class BusinessRuleError(APIException):" = Lỗi 400 khi vi phạm quy tắc nghiệp vụ (VD: Từ chối mà không có lý do).
    status_code = 400
    default_detail = "Business rule violation."
    default_code = "business_rule_error"
```

---

### 2. Khai Báo Ma Trận Chuyển Trạng Thái (`TASK_TRANSITIONS`)

```python
TASK_TRANSITIONS = {
# Dictionary định nghĩa ma trận các bước chuyển trạng thái hợp lệ và Actor được phép thực hiện:
    (Task.Status.TODO, Task.Status.IN_PROGRESS): [
        ACTOR_ASSIGNEE,
        ACTOR_JOB_MANAGER,
    ],
    # Từ TODO sang IN_PROGRESS: Assignee hoặc Manager được phép làm.

    (Task.Status.IN_PROGRESS, Task.Status.REVIEWING): [
        ACTOR_ASSIGNEE,
    ],
    # Từ IN_PROGRESS sang REVIEWING (Nộp bài): CHỈ ASSIGNEE được làm.

    (Task.Status.IN_PROGRESS, Task.Status.TODO): [
        ACTOR_ASSIGNEE,
        ACTOR_JOB_MANAGER,
    ],
    # Trả về TODO: Assignee hoặc Manager được làm.

    (Task.Status.REVIEWING, Task.Status.COMPLETED): [
        ACTOR_JOB_MANAGER,
    ],
    # Duyệt bài (COMPLETED): CHỈ MANAGER quản lý dự án mới được làm.

    (Task.Status.REVIEWING, Task.Status.IN_PROGRESS): [
        ACTOR_JOB_MANAGER,
    ],
    # Từ chối bài (REJECT): CHỈ MANAGER mới được làm.

    (Task.Status.TODO, Task.Status.CANCELLED): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.IN_PROGRESS, Task.Status.CANCELLED): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.REVIEWING, Task.Status.CANCELLED): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    # Hủy Task: CHỈ Manager hoặc Admin mới được phép hủy.
}
```

---

### 3. Kiểm Tra Actor & Validation Nghiệp Vụ

```python
def assert_actor(user, task, allowed_actors):
# "def assert_actor(...):" = Hàm kiểm tra xem `user` có vai trò phù hợp với danh sách `allowed_actors` hay không:
    role_code = get_user_role_code(user)

    if ACTOR_ADMIN in allowed_actors and role_code == ADMIN_ROLE_CODE:
        return # Hợp lệ nếu là Admin

    if (
        ACTOR_JOB_MANAGER in allowed_actors
        and role_code == MANAGER_ROLE_CODE
        and task.job.manager_id == user.id
    ):
        return # Hợp lệ nếu là Manager của chính Job chứa Task này

    if (
        ACTOR_ASSIGNEE in allowed_actors
        and task.assignee_id == user.id
    ):
        return # Hợp lệ nếu là Nhân viên được giao Task này

    raise PermissionDenied("USER_NOT_ALLOWED_FOR_THIS_TASK_TRANSITION")
    # Từ chối nếu không thuộc bất kỳ vai trò hợp lệ nào.

def validate_transition(task, to_status, reason=None):
# Kiểm tra bước chuyển trạng thái có nằm trong ma trận không và xác minh lý do bắt buộc:
    transition_key = (task.status, to_status)
    allowed_actors = TASK_TRANSITIONS.get(transition_key)

    if allowed_actors is None:
        raise InvalidTaskTransition("INVALID_TASK_STATUS_TRANSITION")

    if (
        task.status == Task.Status.REVIEWING
        and to_status == Task.Status.IN_PROGRESS
        and not reason
    ):
        raise BusinessRuleError("REJECTION_REASON_REQUIRED") # Bắt buộc có lý do khi Reject

    if to_status == Task.Status.CANCELLED and not reason:
        raise BusinessRuleError("CANCELLATION_REASON_REQUIRED") # Bắt buộc có lý do khi Cancel

    return allowed_actors
```

---

### 4. Thực Thi Chuyển Trạng Thái Nguyên Tử (`apply_transition`)

```python
def apply_transition(*, user, task, to_status, reason=None, request=None):
# "def apply_transition(...):" = Hàm thực thi chuyển đổi trạng thái Task chính thức toàn hệ thống:
    clean_reason = reason.strip() if isinstance(reason, str) else reason

    with transaction.atomic():
    # 1. Bắt đầu Giao dịch CSDL Nguyên tử.

        locked_task = (
            Task.objects.select_for_update()
            .select_related("job", "assignee", "creator")
            .get(pk=task.pk)
        )
        # 2. KHÓA BẢN GHI TASK TRONG SQL (`select_for_update`) để chống Race Condition.

        from_status = locked_task.status

        allowed_actors = validate_transition(
            task=locked_task,
            to_status=to_status,
            reason=clean_reason,
        )
        # 3. Kiểm tra tính hợp lệ của State Machine.

        assert_actor(
            user=user,
            task=locked_task,
            allowed_actors=allowed_actors,
        )
        # 4. Kiểm tra quyền của Actor.

        old_values = snapshot(locked_task, fields=["status", "completed_at"])

        if to_status == Task.Status.COMPLETED:
            locked_task.completed_at = timezone.now() # Đánh dấu thời điểm hoàn thành
        else:
            locked_task.completed_at = None # Đặt lại None nếu không ở trạng thái Completed

        locked_task.status = to_status
        locked_task.save(update_fields=["status", "completed_at", "updated_at"])
        # 5. Lưu trạng thái mới vào CSDL.

        if (
            from_status == Task.Status.REVIEWING
            and to_status == Task.Status.IN_PROGRESS
        ):
            TaskComment.objects.create(
                task=locked_task,
                user=user,
                content=clean_reason,
                comment_type=TaskComment.CommentType.REJECTION_NOTE,
            )
            # 6. Tự động ghi Bình luận loại REJECTION_NOTE khi Từ chối Task.

        action_name = get_action_name(from_status=from_status, to_status=to_status)

        log_action(
            user=user,
            action=action_name,
            table_name="tasks",
            record_id=locked_task.id,
            old_values=old_values,
            new_values={
                "status": locked_task.status,
                "completed_at": locked_task.completed_at,
                "reason": clean_reason,
            },
            request=request,
        )
        # 7. Ghi nhật ký vết Audit Log.

        recipients = resolve_task_recipients(locked_task, exclude_user=user)
        notify(
            recipients=recipients,
            event_type=get_event_type(from_status, to_status),
            title=get_transition_title(from_status, to_status, locked_task),
            content=f"Task status changed from {from_status} to {to_status}: {locked_task.title}",
            related_url=f"/manager/tasks/{locked_task.id}",
            channel=Notification.ChannelType.SYSTEM_ONLY,
        )
        # 8. Phát thông báo tự động tới Assignee, Creator và Manager.

    return locked_task
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Status Transition | Allowed Actors | Required Conditions / Reason | Automatic Secondary Actions |
|-------------------|----------------|------------------------------|-----------------------------|
| `TODO` -> `IN_PROGRESS` | `ASSIGNEE`, `JOB_MANAGER` | None | Reset `completed_at = None`, notify users |
| `IN_PROGRESS` -> `REVIEWING` | `ASSIGNEE` | None | Notify `TASK_SUBMITTED` to Job Manager |
| `REVIEWING` -> `COMPLETED` | `JOB_MANAGER` | None | Set `completed_at = now()`, notify `TASK_APPROVED` |
| `REVIEWING` -> `IN_PROGRESS` | `JOB_MANAGER` | `reason` is required | Create `REJECTION_NOTE` comment, notify `TASK_REJECTED` |
| Any -> `CANCELLED` | `JOB_MANAGER`, `ADMIN` | `reason` is required | Reset `completed_at = None`, notify `TASK_CANCELLED` |
