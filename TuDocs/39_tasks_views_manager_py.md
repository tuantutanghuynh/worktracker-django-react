# Executive Code Annotation: `backend/tasks/views_manager.py`

**Package / Module:** `backend.tasks.views_manager` · Manager ViewSets & API Views for Task & Kanban Management

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm vị von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Task & Kanban Manager (System Diagram)

```
                            ┌─────────────────────────────────────────┐
                            │       HTTP Request (Manager User)       │
                            └────────────────────┬────────────────────┘
                                                 │
                                                 ▼
                            ┌─────────────────────────────────────────┐
                            │    Permission & Scoping Validation      │
                            │   scoped_tasks(user) -> job.manager_id  │
                            └────────────────────┬────────────────────┘
                                                 │
        ┌───────────────────────┬────────────────┴────────────────────────┬───────────────────────┐
        │ ViewSet Actions       │ Status & Review Actions                 │ Social/Media Actions  │ Specialized View
        ▼                       ▼                                         ▼                       ▼
┌───────────────┐       ┌───────────────────────────────┐         ┌───────────────┐       ┌────────────────────────┐
│ list          │       │ change_status                 │         │ comments      │       │ ManagerJobKanbanView   │
│ retrieve      │       │ approve_task                  │         │ attachments   │       │ Group tasks into       │
│ create        │       │ reject_task                   │         │ followers     │       │ Kanban columns         │
│ partial_update│       │ cancel_task                   │         │ follow        │       │ (TODO, IN_PROGRESS,    │
│ (destroy ->   │       │ move_task (Kanban Drag-Drop)  │         │ unfollow      │       │ REVIEWING, COMPLETED)  │
│ 405 Blocked)  │       └───────────────┬───────────────┘         └───────────────┘       └────────────────────────┘
└───────────────┘                       │
                                        ▼
                        ┌───────────────────────────────┐
                        │ apply_transition() / Svc      │
                        │ (Task State Machine Engine)   │
                        └───────────────────────────────┘
```

> **Vì sao hàm `destroy()` lại chủ động tung lỗi `MethodNotAllowed("DELETE")` (HTTP 405)?**
> Trong quản lý dự án và chấm công, Task chứa toàn bộ lịch sử thảo luận, tệp đính kèm và đặc biệt là các **LogWork (dữ liệu chấm công)** do nhân viên ghi nhận. Nếu xóa cứng Task, toàn bộ giờ công của nhân viên sẽ bị mất liên kết FK hoặc bị xóa theo (Cascade Delete), dẫn tới sai lệch dữ liệu bảng lương. Khi không sử dụng Task nữa, Manager bắt buộc phải gọi API `cancel_task` để chuyển Task về trạng thái `CANCELLED` (Soft Delete).

> **Vì sao thao tác `reject_task` lại bắt buộc truyền tham số `reason` (Lý do từ chối)?**
> Khi Manager từ chối một công việc đã nộp duyệt (`REVIEWING` -> `IN_PROGRESS`), nhân viên cần biết chính xác điểm chưa đạt yêu cầu để sửa đổi. Hệ thống sẽ tự động tạo một `TaskComment` loại đặc biệt là `REJECTION_NOTE` chứa lý do từ chối để lưu lại lịch sử nghiệm thu công việc.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Thư Viện, Model & Services Liên Quan (Imports)

```python
from django.db import transaction
# "from django.db import transaction" = quản lý giao dịch CSDL nguyên tử (Atomic Transactions).

from django.db.models import Count
# "from django.db.models import Count" = hàm đếm số lượng bản ghi liên quan (Comment, Attachment).

from rest_framework import status, viewsets
# Import bộ mã trạng thái HTTP chuẩn và class `ModelViewSet`.

from rest_framework.decorators import action
# Decorator tạo các custom action cho ViewSet (như `/approve/`, `/move/`).

from rest_framework.exceptions import MethodNotAllowed, ValidationError
# Import các exception chuẩn của DRF để trả về lỗi 405 Method Not Allowed hoặc 400 Bad Request.

from rest_framework.response import Response
# Lớp đóng gói HTTP Response JSON.

from rest_framework.views import APIView
# Lớp APIView cơ bản để xây dựng màn hình Bảng Kanban (`ManagerJobKanbanView`).

from tasks.models import Task, TaskComment, TaskFollower
# Import các model lõi của ứng dụng Task: Task, Bình luận, Người theo dõi Task.

from tasks.serializers_manager import (
    ManagerKanbanMoveSerializer,
    ManagerTaskAttachmentSerializer,
    ManagerTaskCommentSerializer,
    ManagerTaskCreateSerializer,
    ManagerTaskDetailSerializer,
    ManagerTaskListSerializer,
    ManagerTaskStatusSerializer,
    ManagerTaskUpdateSerializer,
)
# Import bộ Serializer dành cho Manager xử lý Task.

from tasks.filters_manager import ManagerTaskFilter
# Bộ lọc danh sách Task theo từ khóa, deadline, assignee, priority.

from tasks.services.task_manager_service import (
    create_task,
    move_task_kanban,
    update_task,
)
# Service nghiệp vụ tạo Task, cập nhật Task và di chuyển vị trí Task trên bảng Kanban.

from tasks.services.task_transition_manager_service import apply_transition
# Core Engine kiểm soát luồng chuyển đổi trạng thái Task (State Machine).

from system.models import Notification
# Model lưu thông báo hệ thống.

from system.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
# Bộ 3 quyền an toàn bảo vệ API của Manager.

from system.scoping_manager import (
    get_scoped_object_or_404,
    scoped_jobs,
    scoped_tasks,
)
# Các hàm giới hạn scope dữ liệu chỉ nằm trong các Job do Manager phụ trách.

from system.services.audit_manager_service import log_action, snapshot
# Dịch vụ ghi vết Audit Log.

from system.services.notification_manager_service import (
    notify,
    resolve_task_recipients,
)
# Dịch vụ tự động phân giải danh sách người nhận và gửi thông báo hệ thống khi Task có thay đổi.
```

---

### 2. ViewSet Quản Lý Công Việc (`TaskViewSet`)

```python
class TaskViewSet(viewsets.ModelViewSet):
# "class TaskViewSet(viewsets.ModelViewSet):" = ViewSet chính xử lý toàn bộ vòng đời Task của Manager.

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    # Áp dụng bộ 3 trạm kiểm soát an ninh.

    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]
    # Cố tình CHẶN method `delete` ở cấp độ HTTP Protocol.

    def get_permissions(self):
    # Khai báo mapping mã quyền chi tiết cho 13 action nghiệp vụ:
        action_permissions = {
            "list": "task:view",
            "retrieve": "task:view",
            "create": "task:create",
            "partial_update": "task:update",
            "change_status": "task:change_status",
            "approve_task": "task:review",
            "reject_task": "task:review",
            "cancel_task": "task:cancel",
            "move_task": "task:change_status",
            "comments": "task:comment",
            "attachments": "task:attachment",
            "followers": "task:follow",
            "follow": "task:follow",
            "unfollow": "task:follow",
        }
        self.required_permission = action_permissions.get(self.action)
        return super().get_permissions()

    def get_queryset(self):
    # Queryset gốc luôn được Scope bảo vệ: `task.job.manager_id = request.user.id`
        return (
            scoped_tasks(self.request.user)
            .select_related(
                "job",
                "job__client",
                "assignee",
                "assignee__profile",
                "creator",
                "creator__profile",
            )
            # Join trước các bảng thông tin liên quan để tránh N+1 Query.
            .annotate(
                comment_count=Count("comments", distinct=True),
                attachment_count=Count("attachments", distinct=True),
            )
            # Tính tổng số comment và attachment để hiển thị thẻ Task.
        )
```

---

### 3. Vòng Đời CRUD & State Machine Actions (`TaskViewSet`)

```python
    def create(self, request, *args, **kwargs):
    # POST /api/manager/tasks/ — Manager khởi tạo Task mới trong Job của mình.
        serializer = ManagerTaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = create_task(user=request.user, data=serializer.validated_data, request=request)
        output_serializer = ManagerTaskDetailSerializer(task)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
    # PATCH /api/manager/tasks/{id}/ — Sửa tiêu đề, mô tả, ưu tiên, người thực hiện.
        task = self.get_object()
        serializer = ManagerTaskUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_task = update_task(user=request.user, task=task, data=serializer.validated_data, request=request)
        output_serializer = ManagerTaskDetailSerializer(updated_task)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
    # DELETE /api/manager/tasks/{id}/ — BỊ CHẶN NGHIỆP VỤ.
        raise MethodNotAllowed("DELETE") # Trả về lỗi 405

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
    # POST /api/manager/tasks/{id}/status/ — Đổi trạng thái tổng quát qua State Machine Engine.
        task = self.get_object()
        serializer = ManagerTaskStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=serializer.validated_data["to_status"],
            reason=serializer.validated_data.get("reason"),
            request=request,
        )
        return Response(ManagerTaskDetailSerializer(updated_task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve_task(self, request, pk=None):
    # POST /api/manager/tasks/{id}/approve/ — Shortcut Duyệt hoàn thành Task (REVIEWING -> COMPLETED).
        task = self.get_object()
        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=Task.Status.COMPLETED,
            reason=None,
            request=request,
        )
        return Response(ManagerTaskDetailSerializer(updated_task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject_task(self, request, pk=None):
    # POST /api/manager/tasks/{id}/reject/ — Shortcut Từ chối duyệt Task (REVIEWING -> IN_PROGRESS).
        task = self.get_object()
        reason = request.data.get("reason") or request.data.get("rejection_reason")
        if not reason or not str(reason).strip():
            raise ValidationError({"reason": "Rejection reason is required."}) # Bắt buộc có lý do
        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=Task.Status.IN_PROGRESS,
            reason=str(reason).strip(),
            request=request,
        )
        return Response(ManagerTaskDetailSerializer(updated_task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_task(self, request, pk=None):
    # POST /api/manager/tasks/{id}/cancel/ — Hủy bỏ Task (Soft Delete).
        task = self.get_object()
        reason = request.data.get("reason")
        if not reason or not str(reason).strip():
            raise ValidationError({"reason": "Cancellation reason is required."})
        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=Task.Status.CANCELLED,
            reason=str(reason).strip(),
            request=request,
        )
        return Response(ManagerTaskDetailSerializer(updated_task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="move")
    def move_task(self, request, pk=None):
    # POST /api/manager/tasks/{id}/move/ — Xử lý Kéo thả thẻ trên Bảng Kanban (FR-39).
        task = self.get_object()
        serializer = ManagerKanbanMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        moved_task = move_task_kanban(
            user=request.user,
            task=task,
            to_status=serializer.validated_data.get("to_status"),
            prev_task_id=serializer.validated_data.get("prev_task_id"),
            next_task_id=serializer.validated_data.get("next_task_id"),
            reason=serializer.validated_data.get("reason"),
            request=request,
        )
        return Response(ManagerTaskDetailSerializer(moved_task).data, status=status.HTTP_200_OK)
```

---

### 4. Tương Tác Xã Hội: Bình Luận, File Đính Kèm & Followers

```python
    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
    # Quản lý bình luận trong Task: GET lấy danh sách, POST tạo bình luận mới và gửi thông báo.
        task = self.get_object()
        if request.method == "GET":
            comments = task.comments.select_related("user", "user__profile").order_by("created_at")
            return Response(ManagerTaskCommentSerializer(comments, many=True).data, status=status.HTTP_200_OK)

        serializer = ManagerTaskCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            comment = serializer.save(task=task, user=request.user, comment_type=TaskComment.CommentType.NORMAL)
            recipients = resolve_task_recipients(task, exclude_user=request.user)
            notify(recipients=recipients, event_type=Notification.EventType.TASK_COMMENT, title="New task comment", content=f"New comment on task: {task.title}", related_url=f"/manager/tasks/{task.id}", channel=Notification.ChannelType.SYSTEM_ONLY)
        return Response(ManagerTaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
    # Lưu và hiển thị file đính kèm của Task:
        task = self.get_object()
        if request.method == "GET":
            attachments = task.attachments.select_related("user", "user__profile").order_by("-uploaded_at")
            return Response(ManagerTaskAttachmentSerializer(attachments, many=True).data, status=status.HTTP_200_OK)

        serializer = ManagerTaskAttachmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            attachment = serializer.save(task=task, user=request.user)
            log_action(user=request.user, action="UPLOAD_TASK_ATTACHMENT", table_name="task_attachments", record_id=attachment.id, old_values=None, new_values=snapshot(attachment), request=request)
            recipients = resolve_task_recipients(task, exclude_user=request.user)
            notify(recipients=recipients, event_type=Notification.EventType.TASK_ATTACHMENT, title="New task attachment", content=f"New attachment uploaded to task: {task.title}", related_url=f"/manager/tasks/{task.id}", channel=Notification.ChannelType.SYSTEM_ONLY)
        return Response(ManagerTaskAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="follow")
    def follow(self, request, pk=None):
    # Theo dõi Task để nhận thông báo.
        task = self.get_object()
        follower, created = TaskFollower.objects.get_or_create(task=task, user=request.user)
        return Response({"followed": True, "created": created, "task_id": task.id}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="unfollow")
    def unfollow(self, request, pk=None):
    # Bỏ theo dõi Task (Dùng POST để tránh mở method DELETE).
        task = self.get_object()
        deleted_count, _ = TaskFollower.objects.filter(task=task, user=request.user).delete()
        return Response({"followed": False, "deleted": deleted_count > 0, "task_id": task.id}, status=status.HTTP_200_OK)
```

---

### 5. Giao Diện Bảng Kanban Dạng Cột (`ManagerJobKanbanView`)

```python
class ManagerJobKanbanView(APIView):
# "class ManagerJobKanbanView(APIView):" = APIView chuyên biệt gom nhóm Task thành các cột trên Bảng Kanban.

    permission_classes = [IsActiveAuthenticated, IsManagerRole, HasPermissionCode]
    required_permission = "task:view"

    def get(self, request, job_id):
    # GET /api/manager/jobs/{job_id}/kanban/ — Trả về dữ liệu Kanban phân theo các cột trạng thái.
        job = get_scoped_object_or_404(scoped_jobs(request.user), pk=job_id)
        # Kiểm tra Job có thuộc scope Manager quản lý không.

        tasks = (
            scoped_tasks(request.user)
            .filter(job_id=job.id)
            .select_related("job", "assignee", "assignee__profile", "creator", "creator__profile")
            .annotate(comment_count=Count("comments", distinct=True), attachment_count=Count("attachments", distinct=True))
            .order_by("status", "order_index") # Sắp xếp theo thứ tự hiển thị Kanban
        )

        grouped = {status_value: [] for status_value, status_label in Task.Status.choices}
        # Khởi tạo dictionary rỗng cho từng cột (TODO, IN_PROGRESS, REVIEWING, COMPLETED, CANCELLED).

        for status_value, status_label in Task.Status.choices:
            status_tasks = [task for task in tasks if task.status == status_value]
            grouped[status_value] = ManagerTaskListSerializer(status_tasks, many=True).data
            # Phân loại Task vào đúng cột tương ứng.

        return Response({
            "job": {"id": job.id, "job_name": job.job_name, "status": job.status, "deadline": job.deadline},
            "columns": grouped, # Trả về mảng các cột cho Frontend render UI Kanban
        }, status=status.HTTP_200_OK)
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Endpoint | HTTP Method | Permission Code | Purpose & Business Logic |
|----------|-------------|-----------------|--------------------------|
| `/api/manager/tasks/` | `GET` / `POST` | `task:view` / `task:create` | Danh sách Task trong scope & Tạo Task mới |
| `/api/manager/tasks/{id}/` | `GET` / `PATCH` / `DELETE` | `task:view` / `task:update` | Xem/sửa Task. `DELETE` bị chặn 405 |
| `/api/manager/tasks/{id}/approve/` | `POST` | `task:review` | Duyệt Task hoàn thành (`REVIEWING` -> `COMPLETED`) |
| `/api/manager/tasks/{id}/reject/` | `POST` | `task:review` | Từ chối duyệt Task, yêu cầu có `reason`, tạo `REJECTION_NOTE` |
| `/api/manager/tasks/{id}/cancel/` | `POST` | `task:cancel` | Hủy bỏ Task (Soft Delete), yêu cầu có `reason` |
| `/api/manager/tasks/{id}/move/` | `POST` | `task:change_status` | Kéo thả thẻ trên Bảng Kanban (đổi vị trí / đổi cột) |
| `/api/manager/jobs/{job_id}/kanban/` | `GET` | `task:view` | Trả về cấu trúc Bảng Kanban gom nhóm theo 5 cột trạng thái |
