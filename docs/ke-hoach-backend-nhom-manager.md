# KẾ HOẠCH CÔNG VIỆC BACKEND — NHÓM MANAGER (WorkTracker)

> Tài liệu tham chiếu: WORKTRACKER SYSTEM DESIGN DOCUMENT (update lần 2).
> Trạng thái hiện tại: models.py của 5 app nghiệp vụ (accounts, projects, system, tasks, timesheets) đã hoàn thành theo tài liệu thiết kế.
> Dự án có package cấu hình chính là worktracker_core, chứa settings.py, urls.py, asgi.py, wsgi.py.
> Lưu ý: worktracker_core không phải app nghiệp vụ và không dùng để đặt logic API/Service của nhóm Manager, ngoại trừ file worktracker_core/urls.py dùng làm trạm định tuyến trung tâm.
> Giai đoạn tiếp theo: xây dựng tầng API/Service cho các chức năng thuộc phạm vi Manager.
> Quy ước: chưa viết code thật — tài liệu này chỉ liệt kê file cần tạo + nội dung dạng pseudo-code.

---

## 0. PHẠM VI TRÁCH NHIỆM CỦA NHÓM MANAGER

Nhóm Manager chịu trách nhiệm backend cho các nhóm chức năng sau (mapping theo FR trong tài liệu):

| Nhóm chức năng | FR liên quan | App |
|---|---|---|
| Quản lý Job trong scope của Manager | FR-26, FR-27, FR-28, FR-29, FR-30, FR-31 | projects |
| Tạo / giao / cập nhật Task, Kanban | FR-32 → FR-40, bảng chuyển trạng thái §8.1 | tasks |
| Review Task (approve/reject) | FR-41, FR-42, FR-43, BR-15, BR-16 | tasks |
| Comment / Follower / Attachment (phần thuộc luồng Manager) | FR-44 → FR-54 | tasks |
| Xem & duyệt timesheet, correct/void log work | FR-63, FR-124, FR-57→62, FR-120, §6.7.6 | timesheets |
| Time lock phạm vi JOB | FR-64 → FR-68, BR-21, BR-22, CS-10 | timesheets |
| Manager Dashboard | FR-83, FR-85 | reports  |
| Báo cáo Manager + export | FR-87, FR-88, FR-122, FR-123, FR-89, FR-90, FR-91 | reports |
| Lịch sử hoạt động trong scope (activity history) | FR-97 (endpoint §8.10) | system |
| Team Directory + tìm nhân viên để giao việc | FR-20 | accounts |
| Quy tắc scope xuyên suốt | FR-99, FR-117, FR-121, FR-101, FR-102, BR-26, BR-28 | system |

Ghi chú về app:
- accounts, projects, system, tasks, timesheets là các app nghiệp vụ hiện có.
- worktracker_core là package cấu hình Django project, chỉ dùng cho settings.py, urls.py, asgi.py, wsgi.py.
- Project sử dụng `worktracker_core/` làm package cấu hình Django project.
- Không đặt logic API/Service của nhóm Manager vào `worktracker_core/`.
- Logic Manager API/Service được đặt trong các app nghiệp vụ hiện có: `accounts`, `projects`, `system`, `tasks`, `timesheets`.
- `worktracker_core/urls.py` chỉ dùng để include route trung tâm theo từng nhóm.
- App `reports` được tạo riêng cho Dashboard, Reporting và Export của nhóm Manager, dùng các file `views_manager.py`, `serializers_manager.py`, `urls_manager.py`.

**Không thuộc nhóm Manager** (để tránh giẫm chân): auth/login/reset password (FR-01→07), quản lý user/role/permission (FR-08→16), department CRUD (FR-17→19), client CRUD (FR-21→25), GLOBAL time lock (Admin), luồng Employee log work create/update (FR-55→62 phía Employee — tuy nhiên service dùng chung, xem mục 11), audit log toàn cục cho Admin (FR-95, FR-96).

---

## 1. NGUYÊN TẮC XƯƠNG SỐNG — ÁP DỤNG CHO MỌI API CỦA NHÓM

Đây là 4 quy tắc bắt buộc, mọi endpoint đều phải qua đủ, không có ngoại lệ:

**(1) Ủy quyền 2 lớp độc lập (FR-121, BR-28).**
- Lớp action-level (RBAC): user có role/permission được phép làm loại hành động này không (qua roles / permissions / role_permissions).
- Lớp row-level (scope): bản ghi cụ thể có thuộc scope của user không.
- Phải pass **cả hai**. Pass RBAC không bao giờ đủ để đụng vào 1 record cụ thể.

**(2) Scope của Manager chỉ có một định nghĩa duy nhất (FR-99, FR-117, BR-26).**
```
scope = { jobs WHERE jobs.manager_id = current_user.id }
        + mở rộng bắc cầu sang: tasks, log_works, task_comments,
          task_attachments, time_locks, notifications thuộc các job đó
```
- TUYỆT ĐỐI không dùng `departments.manager_id` để tính scope (chỉ là thông tin tổ chức).
- Filter scope phải nằm **ngay trong queryset (WHERE clause)**, không được fetch hết rồi lọc sau (FR-121).
- Ngoài scope → trả 403/404 chuẩn (FR-102).

**(3) Mọi hành động nhạy cảm phải ghi audit_logs (FR-43, FR-92, BR-24)** — trong **cùng transaction** với thao tác chính: tạo/sửa job, đổi status job, tạo/giao/đổi status/approve/reject/cancel task, đổi deadline, lock/unlock timesheet, approve/reject/correct/void log work, export report.

**(4) Mọi sự kiện nghiệp vụ phát notification theo event_type (FR-69, FR-119, BR-30)** — persist DB trước (FR-71), realtime & email là best-effort (Celery), không được làm hỏng transaction chính nếu gửi thất bại.

---
## 2. CẤU TRÚC FILE TỔNG QUÁT CẦN TẠO / CHỈNH SỬA

Nguyên tắc áp dụng:
- `worktracker_core/` là package cấu hình dự án, không đặt logic nghiệp vụ vào đây.
- Mọi file thuộc nhóm Manager phải dùng hậu tố `_manager.py` hoặc tên class có tiền tố `Manager`.
- Các file mặc định như `views.py`, `serializers.py`, `urls.py` để trống hoặc không dùng trực tiếp, trừ khi cả nhóm đã thống nhất.

Cấu trúc phù hợp với project hiện tại:

```text
backend/
├── worktracker_core/
│   ├── settings.py
│   ├── urls.py                 # Trạm định tuyến trung tâm, chỉ include urls_manager tại khu vực MANAGER
│   ├── asgi.py
│   └── wsgi.py
│
├── accounts/
│   ├── models.py               # Đã hoàn thành
│   ├── serializers_manager.py   # Tạo mới nếu chưa có
│   ├── views_manager.py         # Tạo mới nếu chưa có
│   └── urls_manager.py          # Tạo mới nếu chưa có
│
├── projects/
│   ├── models.py               # Đã hoàn thành
│   ├── serializers_manager.py   # Tạo mới
│   ├── filters_manager.py       # Tạo mới nếu cần filter riêng
│   ├── views_manager.py         # Tạo mới
│   ├── urls_manager.py          # Tạo mới
│   └── services/
│       └── job_status_manager_service.py
│
├── tasks/
│   ├── models.py               # Đã hoàn thành
│   ├── serializers_manager.py   # Đã có / chỉnh tiếp trong file này
│   ├── filters_manager.py       # Tạo mới nếu cần
│   ├── views_manager.py         # Đã có / chỉnh tiếp trong file này
│   ├── urls_manager.py          # Đã có / chỉnh tiếp trong file này
│   └── services/
│       ├── order_index_manager_service.py
│       ├── task_transition_manager_service.py
│       └── task_manager_service.py
│
├── timesheets/
│   ├── models.py               # Đã hoàn thành
│   ├── serializers_manager.py   # Đã có / chỉnh tiếp trong file này
│   ├── filters_manager.py       # Tạo mới nếu cần
│   ├── views_manager.py         # Đã có / chỉnh tiếp trong file này
│   ├── urls_manager.py          # Đã có / chỉnh tiếp trong file này
│   └── services/
│       ├── timelock_manager_service.py
│       ├── daily_total_manager_service.py
│       └── logwork_review_manager_service.py
│
├── system/
│   ├── models.py               # Đã hoàn thành
│   ├── permissions_manager.py   # Đã có / dùng cho permission của Manager
│   ├── scoping_manager.py       # Tạo mới
│   ├── serializers_manager.py   # Tạo mới nếu cần scoped activity history response
│   ├── views_manager.py         # Tạo mới nếu cần scoped activity history
│   ├── urls_manager.py          # Tạo mới nếu cần
│   └── services/
│       ├── audit_manager_service.py
│       └── notification_manager_service.py
│
└── reports/                    
    ├── serializers_manager.py
    ├── views_manager.py
    ├── urls_manager.py
    └── services/
          ├── manager_dashboard_service.py
          ├── timesheet_report_manager_service.py
          ├── task_summary_manager_service.py
          ├── employee_performance_manager_service.py
          └── export_manager_service.py
```


Quy ước URL: mọi endpoint của nhóm đặt dưới prefix **`/api/manager/...`** (thống nhất với 2 nhóm còn lại dùng `/api/admin/...` và `/api/employee/...`;.

---

## 3. GIAI ĐOẠN 0 — NỀN TẢNG MANAGER TRONG `system` (làm TRƯỚC TIÊN)

> Lý do làm trước: mọi endpoint phía sau đều cần permission, scoping, audit và notification.

> Nếu sau này cả 3 nhóm thống nhất viết helper dùng chung, phải chốt owner file trước khi đổi thành helper dùng chung.

### 3.1. `system/permissions_manager.py` — RBAC lớp 1 cho Manager

```
class IsActiveAuthenticated(BasePermission):
    # user đã đăng nhập + is_active = True (BR-03)
    has_permission(request):
        return request.user.is_authenticated AND request.user.is_active

class IsManagerRole(BasePermission):
    # role code = 'MANAGER' (hoặc ADMIN nếu endpoint cho phép cả 2)
    has_permission(request):
        return request.user.role.code == 'MANAGER'

class HasPermissionCode(BasePermission):
    # Action-level RBAC theo FR-04, FR-121 lớp 1
    # View khai báo: required_permission = 'TASK_APPROVE' (ví dụ)
    has_permission(request, view):
        code = view.required_permission
        return RolePermission.objects.filter(
            role = request.user.role,
            permission__code = code
        ).exists()
    # Gợi ý: cache kết quả theo role vào Redis để đỡ query lặp
```

### 3.2. `system/scoping_manager.py` — Row-level scope lớp 2 cho Manager

```
# Tất cả hàm trả về QUERYSET đã filter sẵn (WHERE clause) — FR-121

def manager_job_ids(user):
    return Job.objects.filter(manager_id=user.id).values_list('id', flat=True)

def scoped_jobs(user):
    if user.role.code == 'ADMIN':   return Job.objects.all()
    if user.role.code == 'MANAGER': return Job.objects.filter(manager_id=user.id)   # FR-31
    return Job.objects.none()

def scoped_tasks(user):
    if MANAGER: return Task.objects.filter(job__manager_id=user.id)                 # FR-40, FR-99

def scoped_logworks(user):
    if MANAGER: return LogWork.objects.filter(task__job__manager_id=user.id)        # FR-63

def scoped_timelocks(user):
    if MANAGER: return TimeLock.objects.filter(lock_scope='JOB', job__manager_id=user.id)

def scoped_team_user_ids(user):
    # Employee là assignee của ít nhất 1 task trong scope (FR-20, FR-123)
    return Task.objects.filter(job__manager_id=user.id)
                       .values_list('assignee_id', flat=True).distinct()

def get_scoped_object_or_404(scoped_queryset, pk):
    # Lấy object TRONG queryset đã scope → ngoài scope tự nhiên ra 404
    # (không lộ thông tin record tồn tại — an toàn hơn 403)
```

### 3.3. `system/services/audit_manager_service.py`

```
def snapshot(instance, fields: list) -> dict:
    # Chụp giá trị hiện tại của các field quan tâm → dict JSON-able

def log_action(user, action: str, table_name: str, record_id: int,
               old_values: dict|None, new_values: dict|None, request=None):
    ip = extract_ip(request) if request else None    # nullable — §6.3.11
    AuditLog.objects.create(...)
    # LƯU Ý: luôn gọi bên trong transaction.atomic của thao tác chính
    # action naming thống nhất: 'CREATE_JOB', 'UPDATE_JOB_STATUS', 'CREATE_TASK',
    # 'APPROVE_TASK', 'REJECT_TASK', 'LOCK_TIMESHEET', 'UNLOCK_TIMESHEET',
    # 'APPROVE_LOG_WORK', 'REJECT_LOG_WORK', 'CORRECT_LOG_WORK', 'VOID_LOG_WORK',
    # 'EXPORT_REPORT', ...
    # table_name phải là TÊN BẢNG VẬT LÝ: 'jobs', 'tasks', 'log_works', 'time_locks'
```

### 3.4. `system/services/notification_manager_service.py`

```
def notify(recipients: list[User], event_type, title, content,
           related_url=None, channel='SYSTEM_ONLY'):
    # B1. PERSIST TRƯỚC (FR-71): bulk_create Notification cho từng recipient
    # B2. Realtime best-effort (FR-72): đẩy payload qua Django Channels
    #     (group theo user_id) — lỗi thì bỏ qua, KHÔNG raise
    # B3. Nếu channel in ('EMAIL_ONLY','ALL'): enqueue Celery task gửi mail (FR-73)
    #     Worker cập nhật is_sent_email=True, sent_at khi gửi thành công (FR-74)

def resolve_task_recipients(task, exclude_user=None) -> set[User]:
    # FR-50, FR-70: assignee + creator + followers + manager của job
    # exclude_user = người thực hiện hành động (không tự thông báo cho mình)
```

### 3.5. `system/pagination_manager.py` + `system/exceptions_manager.py` hoặc để sau

```
# pagination.py
class DefaultPagination(PageNumberPagination):
    page_size = 20, max_page_size = 100

# exceptions.py — custom_exception_handler đăng ký vào DRF settings
# Chuẩn hoá body lỗi (§8.11):
# { "success": false, "error": { "code": "FORBIDDEN" | "VALIDATION_ERROR" | ...,
#     "message": "...", "details": {...} } }
# 403 khi vi phạm RBAC/scope (FR-102), 404 khi record ngoài scope (tuỳ chiến lược),
# 409/400 khi vi phạm business rule (transition không hợp lệ, kỳ đã khoá, quá 24h...)
```

---

## 4. GIAI ĐOẠN 1 — QUẢN LÝ JOB TRONG SCOPE MANAGER (`projects`)

Mục tiêu của giai đoạn này là xây dựng API để Manager quản lý các Job nằm trong phạm vi của chính Manager đó.

Nguyên tắc bắt buộc:
- Manager chỉ được xem và thao tác với Job có `jobs.manager_id = request.user.id`.
- Không dùng `departments.manager_id` để tính scope.
- Không dùng file chung `projects/views.py`, `projects/serializers.py`, `projects/urls.py`.
- Toàn bộ file của nhóm Manager đặt trong:
  - `projects/serializers_manager.py`
  - `projects/filters_manager.py`
  - `projects/views_manager.py`
  - `projects/urls_manager.py`
  - `projects/services/job_status_manager_service.py`
- Tên class phải có tiền tố `Manager`.

---

### 4.1. `projects/serializers_manager.py`

```pseudo
class ManagerJobListSerializer:
    fields:
        - id
        - job_name
        - client:
            - id
            - client_name
        - status
        - start_date
        - deadline
        - task_counts:
            - total_tasks
            - todo_count
            - in_progress_count
            - reviewing_count
            - completed_count
            - cancelled_count
        - is_overdue

    computed fields:
        task_counts:
            lấy từ annotate/count theo trạng thái task

        is_overdue:
            true nếu:
                deadline < today
                AND status NOT IN (COMPLETED, CANCELLED)


class ManagerJobDetailSerializer(ManagerJobListSerializer):
    additional fields:
        - description
        - manager:
            - id
            - full_name
        - created_at
        - updated_at


class ManagerJobCreateSerializer:                     # FR-26, FR-27
    input fields:
        - client_id
        - job_name
        - description
        - start_date
        - deadline

    forbidden input fields:
        - manager_id
        - status

    validate:
        - client_id phải tồn tại
        - client phải đang active
        - deadline không được nhỏ hơn start_date

    note:
        - Manager không được truyền manager_id từ request body.
        - Khi Manager tạo Job, hệ thống tự gán:
              job.manager = request.user
        - Trạng thái khởi tạo có thể dùng default theo model, ví dụ PLANNING.


class ManagerJobUpdateSerializer:                     # FR-28
    allowed update fields:
        - job_name
        - description
        - deadline

    forbidden update fields:
        - manager_id
        - client_id 
        - status

    validate:
        - deadline mới không được nhỏ hơn start_date của Job
        - nếu deadline mới nhỏ hơn deadline của các task con đang mở:
              reject hoặc cảnh báo theo rule nhóm thống nhất

    note:
        - Không xử lý đổi status trong serializer này.
        - Đổi status dùng endpoint riêng:
              POST /api/manager/jobs/{id}/status/
        - Manager tuyệt đối không được đổi `jobs.manager_id`.
        - Chỉ Admin mới được reassign manager cho Job.


class ManagerJobStatusChangeSerializer:               # FR-29
    input fields:
        - new_status
        - reason

    choices for new_status:
        - PLANNING
        - ACTIVE
        - COMPLETED
        - ON_HOLD
        - CANCELLED

    validate:
        - new_status phải nằm trong danh sách trạng thái hợp lệ.
        - reason bắt buộc khi:
              new_status = CANCELLED
              OR new_status = ON_HOLD
        - transition cụ thể không validate tại serializer.
        - transition phải được xử lý tại:
              projects/services/job_status_manager_service.py
```
### 4.2. projects/services/job_status_manager_service.py — State machine Job
# File này xử lý business rule đổi trạng thái Job cho Manager.
# Đây là nguồn kiểm tra transition Job của nhóm Manager.
```
JOB_TRANSITIONS = {
    ('PLANNING', 'ACTIVE'): {
        actors: [OWNER_MANAGER],
        reason_required: False
    },

    ('PLANNING', 'CANCELLED'): {
        actors: [OWNER_MANAGER],
        reason_required: True
    },

    ('ACTIVE', 'ON_HOLD'): {
        actors: [OWNER_MANAGER],
        reason_required: True
    },

    ('ON_HOLD', 'ACTIVE'): {
        actors: [OWNER_MANAGER],
        reason_required: False
    },

    ('ACTIVE', 'COMPLETED'): {
        actors: [OWNER_MANAGER],
        reason_required: False,
        condition: manager_check_job_completable
    },

    ('ACTIVE', 'CANCELLED'): {
        actors: [OWNER_MANAGER],
        reason_required: True
    },

    ('ON_HOLD', 'CANCELLED'): {
        actors: [OWNER_MANAGER],
        reason_required: True
    }
}

# Các transition sau thuộc Admin, không cho Manager thực hiện:
# - COMPLETED -> ACTIVE
# - CANCELLED -> ACTIVE
# Vì đây là thao tác reopen/restore có rủi ro cao và theo tài liệu chỉ Admin được phép.


def manager_check_job_completable(job):
    # FR-29:
    # Job không được chuyển sang COMPLETED nếu còn task chưa hoàn tất.

    if job.tasks.filter(
        status__in=['TODO', 'IN_PROGRESS', 'REVIEWING']
    ).exists():
        raise BusinessRuleError('JOB_HAS_OPEN_TASKS')

    # Job không được COMPLETED nếu còn log work PENDING.
    if LogWork.objects.filter(
        task__job=job,
        review_status='PENDING'
    ).exists():
        raise BusinessRuleError('JOB_HAS_PENDING_LOGWORK')


def manager_assert_job_owner(user, job):
    # Manager chỉ được thao tác Job do chính họ quản lý.

    if job.manager_id != user.id:
        raise PermissionDenied('JOB_OUT_OF_MANAGER_SCOPE')


def manager_change_job_status(user, job, new_status, reason, request):
    with transaction.atomic():

        # 1. Lock record để tránh double request đổi status cùng lúc.
        job = Job.objects.select_for_update().get(id=job.id)

        # 2. Check scope.
        manager_assert_job_owner(user, job)

        # 3. Lấy rule transition.
        transition_key = (job.status, new_status)
        rule = JOB_TRANSITIONS.get(transition_key)

        if rule is None:
            raise InvalidTransition('INVALID_JOB_STATUS_TRANSITION')

        # 4. Check reason nếu transition yêu cầu.
        if rule.reason_required and not reason:
            raise BusinessRuleError('REASON_REQUIRED')

        # 5. Check điều kiện đặc biệt.
        if rule.condition:
            rule.condition(job)

        # 6. Snapshot old values để audit.
        old_values = snapshot(job, fields=['status'])

        # 7. Update status.
        job.status = new_status
        job.save(update_fields=['status', 'updated_at'])

        # 8. Ghi audit log trong cùng transaction.
        audit_manager_service.log_action(
            user=user,
            action='UPDATE_JOB_STATUS',
            table_name='jobs',
            record_id=job.id,
            old_values=old_values,
            new_values={
                'status': new_status,
                'reason': reason
            },
            request=request
        )

        # 9. Gửi notification nếu cần.
        # Ví dụ: thông báo cho các Employee đang có task trong Job này.
        # Optional:
        # Chỉ triển khai notification cho Job status nếu tài liệu gốc bổ sung event_type tương ứng,
        # ví dụ JOB_STATUS_CHANGED.
        # Mặc định giai đoạn Job bắt buộc audit log, notification là phần cần chốt thêm.

    return job
```

### 4.3. projects/filters_manager.py
```
class ManagerJobFilter:
    filters:
        - status
        - status__in
        - client_id
        - deadline_from
        - deadline_to
        - search
        - is_overdue

    search:
        apply icontains on:
            - job_name
            - description nếu cần

    is_overdue:
        true:
            deadline < today
            AND status NOT IN (COMPLETED, CANCELLED)

        false:
            còn lại

    ordering:
        - deadline
        - created_at
        - updated_at
        - job_name
        - status

    note:
        - Filter này chỉ áp dụng sau khi queryset đã được scope.
        - Không bao giờ filter trên toàn bộ Job rồi mới kiểm tra scope sau.
```
### 4.4. projects/views_manager.py
# Tất cả Manager Job view phải dùng:
# - IsActiveAuthenticated
# - IsManagerRole
# - HasPermissionCode nếu RBAC đã có permission code
# - scoped_jobs(request.user) để giới hạn dữ liệu theo jobs.manager_id
```
class ManagerJobViewSet:
    permission_classes:
        - IsActiveAuthenticated
        - IsManagerRole
        - HasPermissionCode

    pagination_class:
        - Default hoặc Manager pagination nếu có

    filter_class:
        - ManagerJobFilter

    def get_queryset(request):
        return scoped_jobs(request.user)
            .select_related('client', 'manager')
            .annotate(task_counts)
            .annotate(is_overdue)

    def list(request):
        # GET /api/manager/jobs/

        queryset = get_queryset(request)
        queryset = apply ManagerJobFilter
        queryset = paginate queryset

        serializer = ManagerJobListSerializer(queryset, many=True)

        return response(serializer.data)

    def retrieve(request, id):
        # GET /api/manager/jobs/{id}/

        job = get_object_or_404(get_queryset(request), id=id)

        serializer = ManagerJobDetailSerializer(job)

        return response(serializer.data)

    def create(request):
        # POST /api/manager/jobs/

        serializer = ManagerJobCreateSerializer(data=request.data)
        serializer.validate()

        with transaction.atomic():
            job = serializer.save(
                manager=request.user,
                # Không truyền status từ request body.
                # Status dùng default của model.
            )

            audit_manager_service.log_action(
                user=request.user,
                action='CREATE_JOB',
                table_name='jobs',
                record_id=job.id,
                old_values=None,
                new_values=snapshot(job),
                request=request
            )

        return response(ManagerJobDetailSerializer(job).data)

    def partial_update(request, id):
        # PATCH /api/manager/jobs/{id}/

        job = get_object_or_404(get_queryset(request), id=id)

        old_values = snapshot(
            job,
            fields=['job_name', 'description', 'deadline']
        )

        serializer = ManagerJobUpdateSerializer(
            instance=job,
            data=request.data,
            partial=True
        )
        serializer.validate()

        with transaction.atomic():
            job = serializer.save()

            audit_manager_service.log_action(
                user=request.user,
                action='UPDATE_JOB',
                table_name='jobs',
                record_id=job.id,
                old_values=old_values,
                new_values=snapshot(
                    job,
                    fields=['job_name', 'description', 'deadline']
                ),
                request=request
            )

        return response(ManagerJobDetailSerializer(job).data)

    def change_status(request, id):
        # POST /api/manager/jobs/{id}/status/

        job = get_object_or_404(get_queryset(request), id=id)

        serializer = ManagerJobStatusChangeSerializer(data=request.data)
        serializer.validate()

        job = manager_change_job_status(
            user=request.user,
            job=job,
            new_status=serializer.validated_data['new_status'],
            reason=serializer.validated_data.get('reason'),
            request=request
        )

        return response(ManagerJobDetailSerializer(job).data)
```

# Không khai báo destroy/delete.
# Job không được xoá vật lý theo FR-30.
# Nếu Job không còn dùng, đổi status sang CANCELLED hoặc trạng thái phù hợp.

### 4.5. projects/urls_manager.py
# Prefix tổng được include tại worktracker_core/urls.py:
# path("api/manager/", include("projects.urls_manager"))
```
urlpatterns:
    GET    /jobs/                -> ManagerJobViewSet.list
    POST   /jobs/                -> ManagerJobViewSet.create
    GET    /jobs/{id}/           -> ManagerJobViewSet.retrieve
    PATCH  /jobs/{id}/           -> ManagerJobViewSet.partial_update
    POST   /jobs/{id}/status/    -> ManagerJobViewSet.change_status

Không khai báo:
    DELETE /jobs/{id}/

### 4.6. Quy tắc kiểm tra bắt buộc cho giai đoạn Job
Test Manager scope:
    Manager A gọi GET/PATCH/status với job của Manager B
    -> phải trả 403 hoặc 404
    -> không được trả dữ liệu Job ngoài scope

Test create Job:
    client_id không tồn tại -> reject
    client inactive -> reject
    deadline < start_date -> reject
    request body có manager_id -> ignore hoặc reject
    tạo thành công -> manager_id = request.user.id
    tạo thành công -> có audit CREATE_JOB

Test update Job:
    Manager update job trong scope -> success
    Manager gửi manager_id -> reject hoặc field bị bỏ qua theo serializer
    Manager gửi status trong PATCH /jobs/{id}/ -> reject
    deadline invalid -> reject
    update thành công -> có audit UPDATE_JOB

Test status transition:
    PLANNING -> ACTIVE -> success
    PLANNING -> CANCELLED không reason -> reject
    ACTIVE -> ON_HOLD không reason -> reject
    ACTIVE -> COMPLETED khi còn task mở -> reject
    ACTIVE -> COMPLETED khi còn log work PENDING -> reject
    COMPLETED -> ACTIVE bởi Manager -> reject
    CANCELLED -> ACTIVE bởi Manager -> reject
    transition không có trong bảng -> reject

Test delete:
    DELETE /api/manager/jobs/{id}/ không tồn tại route
    hoặc trả 405 Method Not Allowed

```
## 5. GIAI ĐOẠN 2 — TASK, KANBAN, REVIEW (`tasks`)

### 5.1. `tasks/services/order_index_manager_service.py` — thứ tự Kanban (FR-39, CS-12)
ALPHABET = '0123456789ABCDEF...z' # base62 hoặc tương tự

def initial_key() -> 'U' # điểm giữa bảng chữ cái
def key_between(prev_key|None, next_key|None) -> str:
# Sinh chuỗi nằm giữa 2 key theo thứ tự từ điển (kiểu LexoRank giản lược)
# prev=None → sinh key nhỏ hơn next (đầu cột)
# next=None → sinh key lớn hơn prev (cuối cột)
# cả 2 = None → initial_key()
# Không bao giờ hết chỗ: khi 2 key sát nhau thì kéo dài chuỗi ('U' → 'UU')


### 5.2. `tasks/services/task_transition_manager_service.py` — state machine §8.1

> **QUAN TRỌNG:** file này là NGUỒN SỰ THẬT DUY NHẤT cho chuyển trạng thái task,
> dùng chung cho cả nhóm Employee (Todo→InProgress, InProgress→Reviewing...)
> và nhóm Manager (approve/reject/cancel). Nếu dùng chung với nhóm Employee, cần thống nhất owner file trước khi merge.

Actor keys: ASSIGNEE (task.assignee_id == user.id)
JOB_MANAGER (task.job.manager_id == user.id)
ADMIN

TASK_TRANSITIONS = { # bảng §8.1 — khớp 1-1
('TODO','IN_PROGRESS') : [ASSIGNEE, JOB_MANAGER],
('IN_PROGRESS','REVIEWING') : [ASSIGNEE], # chỉ Employee submit
('IN_PROGRESS','TODO') : [ASSIGNEE, JOB_MANAGER],
('REVIEWING','COMPLETED') : [JOB_MANAGER], # approve
('REVIEWING','IN_PROGRESS') : [JOB_MANAGER], # reject → cần reason
('TODO','CANCELLED') : [JOB_MANAGER, ADMIN],
('IN_PROGRESS','CANCELLED') : [JOB_MANAGER, ADMIN],
('REVIEWING','CANCELLED') : [JOB_MANAGER, ADMIN],

COMPLETED, CANCELLED: terminal — không có transition đi ra (FR-36)

}

EVENT_MAP = { # FR-42, FR-69
('REVIEWING','COMPLETED') : 'TASK_APPROVED',
('REVIEWING','IN_PROGRESS') : 'TASK_REJECTED',
('IN_PROGRESS','REVIEWING') : 'TASK_SUBMITTED',
default : 'TASK_STATUS_CHANGED',
}

def apply_transition(user, task, to_status, reason=None, request=None):
with transaction.atomic():
task = Task.objects.select_for_update().get(pk=task.pk) # chống double-click
allowed_actors = TASK_TRANSITIONS.get((task.status, to_status))
or raise InvalidTransition(400)
assert_actor(user, task, allowed_actors) # 403 nếu sai vai
old = snapshot(task, ['status','completed_at'])

    if to_status == 'COMPLETED':
        task.completed_at = now()                              # FR-41
    if (task.status, to_status) == ('REVIEWING','IN_PROGRESS'):
        if not reason: raise ReasonRequired                    # FR-41, BR-16
        TaskComment.objects.create(task=task, user=user,
            content=reason, comment_type='REJECTION_NOTE')     # duy nhất nơi tạo REJECTION_NOTE

    task.status = to_status; task.save()
    audit_manager_service.log_action(user, f'TASK_STATUS_{to_status}', 'tasks',
                                     task.id, old, {...}, request)     # FR-43
    recipients = resolve_task_recipients(task, exclude_user=user)
    notification_manager_service.notify(recipients, EVENT_MAP[...],
                                        title=..., related_url=f'/tasks/{task.id}')
return task

### 5.3. `tasks/services/task_manager_service.py` — nghiệp vụ tạo/giao/cập nhật


JOB_STATUS_ALLOW_CREATE = ['PLANNING', 'ACTIVE'] # bảng trong FR-32

def create_task(user, data, request):
with transaction.atomic():
job = get_scoped_object_or_404(scoped_jobs(user), data.job_id) # FR-32 scope check
if job.status not in JOB_STATUS_ALLOW_CREATE:
raise BusinessRuleError('JOB_STATUS_NOT_ALLOW_TASK') # ON_HOLD/COMPLETED/CANCELLED
if data.deadline > job.deadline: raise ... # FR-33, BR-13
assignee = User.objects.get(pk=data.assignee_id, is_active=True)
last_key = max order_index trong cột TODO của job
task = Task.create(job, assignee, creator=user, status='TODO',
order_index=key_between(last_key, None), ...)
TaskFollower.bulk_create([assignee, user], ignore_conflicts=True) # FR-34, FR-49
audit 'CREATE_TASK' (FR-43)
notify([assignee], 'TASK_ASSIGNED', ...) # FR-42/69
return task

def update_task(user, task, data, request):
# task lấy từ scoped_tasks(user) → đã đảm bảo scope
# cho phép: title, description, priority (FR-35), deadline (re-check FR-33), assignee
with transaction.atomic():
old = snapshot(...)
if 'assignee' thay đổi:
add follower mới (ignore_conflicts) + notify assignee mới 'TASK_ASSIGNED'
if 'deadline' thay đổi: audit riêng biệt (FR-43 nhấn mạnh deadline change)
save + audit 'UPDATE_TASK'

def move_task_kanban(user, task, to_status|None, prev_task_id|None, next_task_id|None):
# FR-39: phân biệt 2 loại drag-drop
with transaction.atomic():
task = select_for_update(task)
new_key = key_between(order_index của prev, order_index của next)
if to_status is None OR to_status == task.status:
# (a) reorder cùng cột → CHỈ đổi order_index, không validate transition
task.order_index = new_key; save()
else:
# (b) kéo sang cột khác → BẮT BUỘC qua state machine §8.1
apply_transition(user, task, to_status, reason=body.reason)
task.order_index = new_key; save()
# Backend là điểm enforce cuối cùng — kể cả frontend đã chặn UI


### 5.4. `tasks/serializers_manager.py`


ManagerTaskListSerializer : id, title, priority, status, deadline, assignee(mini),
order_index, is_overdue, comment_count, attachment_count
ManagerTaskDetailSerializer : + description, job(mini), creator(mini), completed_at, timestamps
ManagerTaskCreateSerializer : job_id, assignee_id, title, description, priority, deadline
(validate như task_manager_service.create_task)
ManagerTaskUpdateSerializer : title, description, priority, deadline, assignee_id
ManagerTaskStatusSerializer : to_status, reason(optional — bắt buộc khi reject/cancel)
ManagerKanbanMoveSerializer : to_status(optional), prev_task_id(optional), next_task_id(optional)
ManagerTaskCommentSerializer : content (non-empty — FR-44)
# comment_type KHÔNG nhận từ input — API user luôn ép NORMAL;
# REJECTION_NOTE chỉ do transition service tạo (FR-44)
ManagerTaskAttachmentSerializer: file_name, file_url, file_size (metadata — FR-51, FR-53)


### 5.5. `tasks/filters_manager.py` (FR-40)


ManagerTaskFilter: status(in), priority(in), job_id, assignee_id,
deadline_from/to, is_overdue, search(title)
ordering: deadline, priority, created_at, order_index


### 5.6. `tasks/views_manager.py` + `tasks/urls_manager.py`

get_queryset() luôn = scoped_tasks(request.user) — FR-40, FR-99

tasks/views_manager.py
GET /api/manager/tasks/ list + filter
POST /api/manager/tasks/ task_manager_service.create_task FR-32→34
GET /api/manager/tasks/{id}/ detail
PATCH /api/manager/tasks/{id}/ task_manager_service.update_task FR-35
POST /api/manager/tasks/{id}/status/ apply_transition FR-36
POST /api/manager/tasks/{id}/approve/ shortcut REVIEWING→COMPLETED FR-41
POST /api/manager/tasks/{id}/reject/ body {reason: required}
REVIEWING→IN_PROGRESS FR-41
POST /api/manager/tasks/{id}/cancel/ body {reason} → CANCELLED

KHÔNG có DELETE task (bảo toàn lịch sử — FR-109)

kanban trong tasks/views_manager.py
GET /api/manager/jobs/{job_id}/kanban/ job trong scope → tasks group theo
status, sort order_index FR-38
POST /api/manager/tasks/{id}/move/ move_task_kanban FR-39

comment trong tasks/views_manager.py
GET /api/manager/tasks/{task_id}/comments/ order by created_at ASC FR-45
POST /api/manager/tasks/{task_id}/comments/ ép comment_type=NORMAL;
notify TASK_COMMENT FR-44, FR-46

Không có API xoá/sửa comment (FR-47 preserve history)
Quyền xem/ghi: user thuộc task (assignee/creator/follower/job manager/admin)

follower trong tasks/views_manager.py
GET /api/manager/tasks/{task_id}/followers/
POST /api/manager/tasks/{task_id}/follow/ get_or_create FR-49
DELETE /api/manager/tasks/{task_id}/follow/ bỏ theo dõi

attachment trong tasks/views_manager.py
POST /api/manager/tasks/{task_id}/attachments/ B1 validate task tồn tại + user có quyền (FR-52)
B2 đẩy file lên File Storage Service (FR-53, CS-14)
B3 lưu metadata vào task_attachments
B4 notify TASK_ATTACHMENT + audit (FR-54)
GET /api/manager/tasks/{task_id}/attachments/
---

## 6. GIAI ĐOẠN 3 — TIMESHEET REVIEW & TIME LOCK (`timesheets`)

### 6.1. `timesheets/services/timelock_manager_service.py` (FR-57, FR-64→68)

```
def is_period_locked(job_id, month, year) -> bool:
    # FR-57: kỳ bị khoá nếu tồn tại MỘT TRONG HAI:
    return TimeLock.objects.filter(
        is_locked=True, lock_month=month, lock_year=year
    ).filter(
        Q(lock_scope='GLOBAL', job__isnull=True) | Q(lock_scope='JOB', job_id=job_id)
    ).exists()

def lock_period(user, job, month, year, reason, request):
    with transaction.atomic():
        # Manager chỉ lock được job trong scope (FR-64, CS-10); Admin lock mọi job
        assert job.manager_id == user.id OR user is ADMIN
        existing = TimeLock.objects.select_for_update().filter(
                       lock_scope='JOB', job=job, lock_month=month, lock_year=year).first()
        if existing:
            # FR-66: CẬP NHẬT bản ghi cũ, không tạo dòng mới
            if existing.is_locked: raise AlreadyLocked
            old = snapshot(existing)
            existing.is_locked=True; existing.locked_by=user
            existing.locked_at=now(); existing.lock_reason=reason; save()
        else:
            existing = TimeLock.create(scope='JOB', job=job, month, year,
                                       locked_by=user, lock_reason=reason)
        audit_manager_service.log_action('LOCK_TIMESHEET', old/new)       # FR-67, FR-68
        recipients = employees có log work / là assignee dưới job trong kỳ đó
        notification_manager_service.notify(recipients, 'TIMESHEET_LOCK', ...)  # FR-68
    return existing

def unlock_period(user, timelock, reason, request):
    with transaction.atomic():
        # timelock lấy từ scoped_timelocks(user) → đảm bảo scope
        if not reason: raise ReasonRequired                                # FR-65
        old = snapshot(timelock)
        timelock.is_locked=False; unlocked_by=user; unlocked_at=now()
        timelock.unlock_reason=reason; save()      # update record cũ, không tạo mới
        audit_manager_service.log_action('UNLOCK_TIMESHEET', actor, old, new, reason, timestamp)  # FR-65
        notification_manager_service.notify(recipients, 'TIMESHEET_UNLOCK', ...)                  # FR-68
```

### 6.2. `timesheets/services/daily_total_manager_service.py` (FR-58, FR-59, §6.7.6)

```
def recalc_daily_total(user_id, work_date):
    # LUÔN gọi bên trong transaction.atomic của caller
    row = DailyUserTimesheet.objects.select_for_update()       # §6.7.6 chống race
              .get_or_create(user_id=user_id, work_date=work_date)
    total = LogWork.objects.filter(user_id=user_id, work_date=work_date)
              .exclude(review_status='VOIDED')                 # VOIDED không tính
              .aggregate(Sum('hours_spent'))
    if total > 24: raise BusinessRuleError('EXCEED_24H')       # FR-58 → rollback
    row.total_hours = total; row.save()
```

### 6.3. `timesheets/services/logwork_review_manager_service.py` (FR-124 — trọng tâm của nhóm)

```
def _assert_scope(user, logwork):
    assert logwork.task.job.manager_id == user.id              # FR-124, FR-99

def approve(user, logwork, note=None, request=None):
    with transaction.atomic():
        logwork = select_for_update(logwork); _assert_scope(...)
        assert logwork.review_status == 'PENDING'              # chỉ duyệt bản PENDING
        old = snapshot(logwork, review fields)
        logwork.review_status='APPROVED'; reviewed_by=user
        logwork.reviewed_at=now(); review_note=note; save()
        audit_manager_service.log_action('APPROVE_LOG_WORK', old/new)
        notification_manager_service.notify([logwork.user], 'LOG_WORK_APPROVED')  # FR-69
        # ⚠ Xem câu hỏi mở Q-01: approve/reject có bị chặn bởi time lock không

def reject(user, logwork, note, request):
    # note BẮT BUỘC; tương tự approve nhưng review_status='REJECTED'
    # notify 'LOG_WORK_REJECTED' → Employee sửa lại bản ghi

def correct(user, logwork, new_data{hours_spent?, work_date?, task_id?}, reason, request):
    with transaction.atomic():
        logwork = select_for_update(logwork); _assert_scope(user, logwork)
        if not reason: raise ReasonRequired                    # FR-124
        # 1. Lock check cho CẢ kỳ cũ và kỳ mới (nếu đổi work_date/task) — FR-57
        if timelock_manager_service.is_period_locked(old_job, old_month, old_year) OR
           timelock_manager_service.is_period_locked(new_job, new_month, new_year): raise PeriodLocked
        # 2. FR-120 cho giá trị mới: work_date không tương lai;
        #    task/job đích không CANCELLED; COMPLETED chỉ khi config flag bật
        # 3. Nếu đổi task_id: task mới phải thuộc scope của chính Manager này
        old = snapshot(logwork, ['hours_spent','work_date','task_id'])
        apply new_data; adjusted_by=user; adjusted_at=now(); adjustment_reason=reason
        save()
        # 4. Recalc daily totals TRONG CÙNG TRANSACTION (FR-124):
        daily_total_manager_service.recalc_daily_total(logwork.user_id, old_work_date)
        if work_date đổi: daily_total_manager_service.recalc_daily_total(logwork.user_id, new_work_date)
        #    (recalc raise nếu vượt 24h → toàn bộ rollback)
        audit_manager_service.log_action('CORRECT_LOG_WORK', old_values/new_values)  # FR-124
        notification_manager_service.notify([logwork.user], 'LOG_WORK_REJECTED'? → dùng event phù hợp; xem Q-02)

def void(user, logwork, reason, request):
    with transaction.atomic():
        logwork = select_for_update(logwork); _assert_scope(...)
        if not reason: raise ReasonRequired
        # FR-62: CHỈ check time lock; KHÔNG check job/task status
        # (void được phép cả khi job/task đã Completed/Cancelled)
        if timelock_manager_service.is_period_locked(...): raise PeriodLocked
        old = snapshot(logwork)
        logwork.review_status='VOIDED'; adjusted_by=user
        logwork.adjusted_at=now(); adjustment_reason=reason; save()
        daily_total_manager_service.recalc_daily_total(logwork.user_id, logwork.work_date)   # trừ giờ đã void
        audit_manager_service.log_action('VOID_LOG_WORK', old/new)
        notification_manager_service.notify([logwork.user], 'LOG_WORK_VOIDED')
        # KHÔNG BAO GIỜ delete() vật lý (FR-124, CS-09)
```

### 6.4. `timesheets/serializers_manager.py` + `timesheets/filters_manager.py`

```
ManagerLogWorkReviewSerializer  : id, task(mini + job mini), user(mini), work_date,
                                  hours_spent, description, review_status,
                                  reviewed_by/at, review_note, adjusted_by/at, adjustment_reason
ManagerLogWorkCorrectSerializer : hours_spent?, work_date?, task_id?, reason(required)
ManagerLogWorkNoteSerializer    : note (required cho reject, optional cho approve)
ManagerTimeLockSerializer       : job(mini), month, year, is_locked, locked_by/at,
                                  lock_reason, unlocked_by/at, unlock_reason
ManagerTimeLockCreateSerializer : job_id, lock_month(1-12), lock_year, lock_reason

ManagerTimesheetFilter (FR-63):
    date_from, date_to (work_date range), user_id (employee), job_id, task_id,
    review_status(in), include_voided (default False)
```

### 6.5. `timesheets/views_manager.py` + `timesheets/urls_manager.py`

```
# queryset gốc = scoped_logworks(request.user)  — FR-63

GET  /api/manager/timesheets/                       list log work + filter    FR-63
GET  /api/manager/timesheets/summary/               group theo employee/ngày:
                                                    tổng giờ (exclude VOIDED),
                                                    số bản ghi PENDING
POST /api/manager/logworks/{id}/approve/            logwork_review_manager_service.approve    FR-124
POST /api/manager/logworks/{id}/reject/             body {note: required}
POST /api/manager/logworks/{id}/correct/            body ManagerLogWorkCorrectSerializer
POST /api/manager/logworks/{id}/void/               body {reason: required}
# KHÔNG có DELETE /logworks/ — void thay cho xoá (FR-62, FR-124)

GET  /api/manager/time-locks/                       scoped_timelocks + filter month/year/job
POST /api/manager/time-locks/                       timelock_manager_service.lock_period   FR-64
POST /api/manager/time-locks/{id}/unlock/           body {reason: required}                FR-65
```

---
## 7. GIAI ĐOẠN 4 — DASHBOARD & BÁO CÁO MANAGER

> Toàn bộ module này READ-ONLY (FR-90, CS-13): chỉ SELECT + aggregate, tuyệt đối không ghi
> vào bảng nghiệp vụ. Chỉ có 1 thao tác ghi duy nhất: audit log khi export (FR-91).
> Nếu nhóm thống nhất tạo app `reports`, app này không cần model và vẫn phải dùng `views_manager.py`, `serializers_manager.py`, `urls_manager.py`.
> Tuyệt đối không đặt vào `worktracker_core`.

### 7.1. `reports/services/manager_dashboard_service.py` (FR-83)

```
def build_dashboard(user, month, year):
    jobs  = scoped_jobs(user)                       # chỉ job của Manager (FR-83, FR-85)
    tasks = scoped_tasks(user)
    logs  = scoped_logworks(user).exclude(review_status='VOIDED')
                                 .filter(work_date trong month/year)
    return {
      task_status_summary   : tasks.values('status').annotate(Count),
      overdue_task_rate     : count(deadline < today, status not in
                              [COMPLETED,CANCELLED]) / count(active tasks),
      team_total_hours      : logs.aggregate(Sum(hours_spent)),
      workload_per_employee : group theo assignee: số task đang mở +
                              tổng giờ đã log trong kỳ,
      productivity_heatmap  : matrix [employee × ngày trong tháng] = Sum(hours),
    }
    # Tối ưu: dùng annotate/aggregate của ORM, tránh loop Python;
    # cân nhắc cache Redis 1-5 phút (NFR-11)
```

### 7.2. `reports/services/timesheet_report_manager_service.py` (FR-88)

```
def timesheet_detail_report(user, filters):
    qs = scoped_logworks(user)                      # chặn cứng scope trước tiên (FR-87)
    apply filters: date range, employee, job, task, task status,
                   review_status, locked-period status
    if not filters.include_voided: qs = qs.exclude(review_status='VOIDED')  # default
    if filters.department_id:
        # Department CHỈ THU HẸP kết quả trong scope, không bao giờ mở rộng (FR-88):
        qs = qs.filter(user__profile__department_id=filters.department_id)
        # scope theo job__manager_id vẫn giữ nguyên phía trên → an toàn
    return qs + tổng hợp (tổng giờ theo employee/job/ngày)
```

### 7.3. `reports/services/task_summary_manager_service.py` (FR-122)

```
def task_summary_report(user, filters{date_range(created_at|completed_at),
                                      job, assignee, priority, status}):
    qs = scoped_tasks(user) + apply filters
    return {
      total_tasks, tasks_by_status,
      overdue_count           : deadline < today & status open,
      avg_time_to_completion  : AVG(completed_at - created_at)
                                WHERE status=COMPLETED,
      rejection_count         : COUNT(task có >= 1 comment
                                comment_type='REJECTION_NOTE'),
    }
```

### 7.4. `reports/services/employee_performance_manager_service.py` (FR-123)

```
def employee_performance_report(user, filters{date_range, employee_id, job_id?}):
    # Manager chỉ xem employee là assignee trong scope:
    assert filters.employee_id in scoped_team_user_ids(user)   # nếu không → 403
    tasks = scoped_tasks(user).filter(assignee_id=employee_id, in date_range)
    logs  = scoped_logworks(user).filter(user_id=employee_id)
                                 .exclude(review_status='VOIDED')
    return {
      total_completed        : tasks.filter(status='COMPLETED').count(),
      total_rejected_once    : tasks có >=1 REJECTION_NOTE comment,
      total_logged_hours     : Sum(hours_spent),
      avg_daily_logged_hours : total / số ngày có log,
      on_time_rate           : completed_at <= deadline / total completed,
    }
    # Lưu ý chú thích FR-123: chỉ là visibility vận hành,
    # không dùng cho payroll/HR review (Functional Boundary §22)
```

### 7.5. `reports/services/export_manager_service.py` (FR-89, FR-91)

```
def export_report(user, report_type, filters, file_format in ('xlsx','pdf')):
    data = gọi service tương ứng (read-only)
    file = render:
        xlsx → openpyxl
        pdf  → weasyprint / reportlab
    lưu file tạm (hoặc File Storage) → trả temporary download URL       # FR-89
    audit 'EXPORT_REPORT' (actor, thời điểm, filter conditions,
                           report_type, file_format)                    # FR-91
    notify chính user 'REPORT_EXPORTED' khi file sẵn sàng               # FR-69
    # Report lớn: chạy qua Celery, trả job_id + endpoint poll (NFR-14, NFR-34)
```

### 7.6. `reports/views_manager.py` + `reports/urls_manager.py`

```
GET  /api/manager/dashboard/?month=&year=                      FR-83
GET  /api/manager/reports/timesheet-detail/?...                FR-88
GET  /api/manager/reports/task-summary/?...                    FR-122
GET  /api/manager/reports/employee-performance/?...            FR-123
POST /api/manager/reports/export/  body {report_type, filters, format}  FR-89
GET  /api/manager/reports/export/{export_id}/                  poll trạng thái (nếu async)
```
```
---

```
## 8. GIAI ĐOẠN 5 — SCOPED ACTIVITY HISTORY (`system`, FR-97)

### 8.1. `system/views_manager.py`

```
GET /api/manager/activity-history/?table_name=&action=&date_from=&date_to=

def get_queryset(user):
    job_ids      = manager_job_ids(user)
    task_ids     = Task.filter(job_id__in=job_ids).values('id')
    logwork_ids  = LogWork.filter(task__job_id__in=job_ids).values('id')
    timelock_ids = TimeLock.filter(job_id__in=job_ids).values('id')
    return AuditLog.objects.filter(
        Q(table_name='jobs',       record_id__in=job_ids)      |
        Q(table_name='tasks',      record_id__in=task_ids)     |
        Q(table_name='log_works',  record_id__in=logwork_ids)  |
        Q(table_name='time_locks', record_id__in=timelock_ids)
    ).order_by('-created_at')
    # TUYỆT ĐỐI KHÔNG trả các bảng: users, roles, permissions, clients,
    # employee_profiles — kể cả liên quan gián tiếp (Admin-only theo FR-97)

# Hiệu năng: bắt buộc date range (mặc định 30 ngày gần nhất),
# tận dụng index (table_name, record_id) đã có trong model AuditLog
# Serializer: hiển thị old_values/new_values CHỈ cho record trong scope
```
### 8.2. `accounts/views_manager.py`
```
GET /api/manager/team/
    # Employee đang là assignee của >=1 task thuộc job trong scope
    queryset = EmployeeProfile.filter(user_id__in=scoped_team_user_ids(user))
    fields đầy đủ: full_name, email, phone, department, avatar

GET /api/manager/employees/search/?q=
    # Mở rộng cho MỤC ĐÍCH GIAO VIỆC: mọi Employee active
    # NHƯNG chỉ trả field định danh cơ bản: full_name, email, department
    # (không timesheet/performance — phần đó vẫn bó trong scope FR-99)
```

---

## 9. ⚠ PHÁT HIỆN LỆCH GIỮA MODELS HIỆN TẠI VÀ TÀI LIỆU (cần sửa sớm)

| # | Vấn đề | Vị trí | Việc cần làm |
|---|---|---|---|
| M-01 | `Notification.EventType` trong `system/models.py` **thiếu 3 giá trị** `LOG_WORK_APPROVED`, `LOG_WORK_REJECTED`, `LOG_WORK_VOIDED` mà FR-69 (bản update) yêu cầu cho luồng review log work của Manager | system/models.py | Thêm 3 choices + migration. Nếu thiếu, notification ở mục 6.3 không phát đúng event_type |
| M-02 | FR-29 yêu cầu reason khi cancel/hold job nhưng model `Job` không có cột reason | projects/models.py | Không cần thêm cột — thống nhất lưu reason vào `audit_logs.new_values` (như pseudo-code 4.2). Ghi rõ quyết định này vào README nhóm |
| M-03 | `CustomUser.role` đang `null=True` trong khi BR-01 nói mỗi user phải có đúng 1 role | accounts/models.py | Xác nhận với nhóm Admin: null chỉ là tạm thời cho createsuperuser hay cần siết lại |

---
```
## 10. CÂU HỎI MỞ — CẦN CHỐT VỚI CẢ 3 NHÓM TRƯỚC KHI CODE

| # | Câu hỏi | Đề xuất của nhóm Manager |
|---|---|---|
| Q-01 | Approve/Reject log work (chỉ đổi review_status) có bị chặn bởi time lock không? FR-57 chặn "create/update/delete" — đổi review_status về mặt kỹ thuật là update | Đề xuất: cho phép approve/reject cả khi đã lock (vì lock thường xảy ra SAU khi duyệt xong), nhưng **correct/void luôn bị chặn bởi lock**. Cần Admin team xác nhận |
| Q-02 | Correct log work phát event_type gì? FR-69 chỉ có LOG_WORK_APPROVED/REJECTED/VOIDED | Đề xuất: dùng LOG_WORK_REJECTED kèm content nêu rõ "đã được Manager điều chỉnh", hoặc đề xuất bổ sung LOG_WORK_CORRECTED vào FR-69 (cần cập nhật tài liệu + M-01) |
| Q-03 | Manager có được tạo Job không, hay chỉ Admin? FR-26 ghi "Admin or authorized Manager" | Đề xuất: cho Manager tạo với `manager = chính họ` (không chọn manager khác — nhất quán FR-28 cấm Manager đổi manager_id). Endpoint POST /api/manager/jobs/ ở mục 4.4 theo phương án này |
| Q-04 | Config flag "cho phép log work vào task/job COMPLETED" (FR-120) đặt ở đâu? | Đề xuất: `settings.ALLOW_LOGWORK_ON_COMPLETED = False` (env var), đọc trong logwork validation service — dùng chung với nhóm Employee |
| Q-05 | Ai own file `task_transition_manager_service.py`? Cả nhóm Employee và Manager đều dùng | Đề xuất: nhóm Manager viết (vì chứa logic approve/reject phức tạp hơn), nhóm Employee review + dùng chung. Chỉ tồn tại 1 file duy nhất |

```

## 11. RANH GIỚI PHỐI HỢP VỚI 2 NHÓM CÒN LẠI

DÙNG CHUNG / CẦN THỐNG NHẤT OWNER TRƯỚC KHI 3 NHÓM CÙNG IMPORT:
system/permissions_manager.py,
system/scoping_manager.py,
system/services/audit_manager_service.py,
system/services/notification_manager_service.py,
tasks/services/task_transition_manager_service.py (§8.1),
timesheets/services/timelock_manager_service.py::is_period_locked (FR-57),
timesheets/services/daily_total_manager_service.py (FR-58/59)

NHÓM EMPLOYEE cung cấp — nhóm Manager PHỤ THUỘC:
Luồng create/update/void log work của chính Employee (FR-55→62)
→ correct() của Manager (mục 6.3) phải tái sử dụng đúng chuỗi validate
FR-57 → FR-120 → SELECT FOR UPDATE → check 24h (§6.7.6), không viết lại

NHÓM ADMIN cung cấp — nhóm Manager PHỤ THUỘC:
Seed roles/permissions (RBAC codes), user management, client CRUD,
GLOBAL time lock, reassign jobs.manager_id (FR-28), full audit log API

---

Ghi chú:
- `worktracker_core/` chỉ là package cấu hình Django project.
- Không đặt logic permission, scoping, audit, notification, task transition, timelock hoặc daily total vào `worktracker_core/`.
- Nếu các file trên được dùng chung cho cả 3 nhóm, cần thống nhất rõ người sở hữu file trước khi merge code.

---

## 12. THỨ TỰ THỰC HIỆN ĐỀ XUẤT & CHECKLIST TEST

**Thứ tự (mỗi giai đoạn ~1 sprint):**
1. Giai đoạn 0 (`system`) — chốt chung 3 nhóm, có unit test cho scoping trước tiên
2. Giai đoạn 1 (`projects` / jobs) — nhỏ, dùng để "chạy thử" toàn bộ pipeline permission → scope → audit → notification
3. Giai đoạn 2 (`tasks` / kanban / review) — khối lượng lớn nhất
4. Giai đoạn 3 (`timesheets` / time lock) — rủi ro data integrity cao nhất, làm khi đã quen pattern
5. Giai đoạn 4 (`reports` / dashboard / reports) — phụ thuộc dữ liệu từ 1-3
6. Giai đoạn 5 (`system` / activity history, `accounts` / directory) — độc lập, có thể làm song song giai đoạn 4

**Checklist test bắt buộc (viết ngay cùng mỗi giai đoạn):**
- [ ] Scope isolation: Manager A gọi mọi endpoint với id thuộc Manager B → 403/404, kể cả qua filter (FR-31, FR-99)
- [ ] Job transition: kiểm tra các nhánh Manager được phép + các nhánh Admin-only bị Manager reject; ACTIVE→COMPLETED bị chặn khi còn task mở / log PENDING (FR-29)
- [ ] Task transition: toàn bộ bảng §8.1 — mỗi (from, to, actor) hợp lệ và không hợp lệ; Employee không thể tự COMPLETED (FR-37)
- [ ] Reject task không kèm reason → 400; reject thành công tạo đúng 1 comment REJECTION_NOTE (FR-41)
- [ ] Kanban: reorder cùng cột không đụng status; kéo chéo cột sai transition → 400 (FR-39)
- [ ] Lock rồi thì correct/void log work trong kỳ → bị chặn; unlock không reason → 400 (FR-57, FR-65)
- [ ] Lock/unlock lặp lại cùng (job, month, year) → update record cũ, đếm số dòng không tăng (FR-66)
- [ ] Correct hours khiến tổng ngày > 24h → rollback toàn bộ, daily total không đổi (FR-58, FR-124)
- [ ] Concurrency: 2 request correct song song cùng user/ngày → SELECT FOR UPDATE serialize đúng (§6.7.6, FR-111)
- [ ] Void không xoá vật lý; VOIDED không tính vào daily total và report mặc định (FR-62, FR-88)
- [ ] Report: mọi filter combination (kể cả department) không lộ dữ liệu ngoài scope (FR-87, FR-88)
- [ ] Export tạo đúng 1 audit log kèm filter conditions (FR-91)
- [ ] Activity history không trả bảng users/roles/clients (FR-97)
- [ ] Mọi hành động nhạy cảm ở trên xuất hiện trong audit_logs với old/new values (FR-43, FR-92)

---

## 13. BẢNG MAP FILE → FR (tra cứu nhanh khi review)

| File | FR chính |
|---|---|
| system/permissions_manager.py | FR-04, FR-101, FR-121 (lớp 1) |
| system/scoping_manager.py | FR-31, FR-99, FR-117, FR-121 (lớp 2), BR-26, BR-28 |
| system/services/audit_manager_service.py | FR-92, FR-93, BR-24 |
| system/services/notification_manager_service.py | FR-69→74, FR-119, BR-23, BR-30 |
| projects/services/job_status_manager_service.py | FR-29 |
| projects/views_manager.py | FR-26, FR-27, FR-28, FR-30, FR-31, FR-43 |
| projects/serializers_manager.py | FR-26, FR-27, FR-28, FR-29 |
| projects/filters_manager.py | FR-31 |
| projects/urls_manager.py | Route Manager cho Job APIs |
| tasks/services/order_index_manager_service.py | FR-39, CS-12 |
| tasks/services/task_transition_manager_service.py | §8.1, FR-36, FR-37, FR-41, FR-42, FR-43, BR-14/15/16 |
| tasks/services/task_manager_service.py | FR-32, FR-33, FR-34, FR-35 |
| tasks/views_manager.py | FR-32→43, FR-44→54 |
| tasks/serializers_manager.py | FR-32→43, FR-44→54 |
| tasks/filters_manager.py | FR-40 |
| tasks/urls_manager.py | Route Manager cho Task, Kanban, Comment, Follower, Attachment APIs |
| timesheets/services/timelock_manager_service.py | FR-57, FR-64→68, BR-21/22, CS-10 |
| timesheets/services/daily_total_manager_service.py | FR-58, FR-59, FR-111, §6.7.6 |
| timesheets/services/logwork_review_manager_service.py | FR-62, FR-120, FR-124, CS-09 |
| timesheets/views_manager.py | FR-63, FR-64→68, FR-124 |
| timesheets/serializers_manager.py | FR-63, FR-64→68, FR-124 |
| timesheets/filters_manager.py | FR-63, FR-88 |
| timesheets/urls_manager.py | Route Manager cho Timesheet Review, Log Work Review, Time Lock APIs |
| reports/services/manager_dashboard_service.py | FR-83, FR-85 |
| reports/services/timesheet_report_manager_service.py | FR-87, FR-88 |
| reports/services/task_summary_manager_service.py | FR-122 |
| reports/services/employee_performance_manager_service.py | FR-123 |
| reports/services/export_manager_service.py | FR-89, FR-90, FR-91, CS-13 |
| reports/views_manager.py | FR-83, FR-85, FR-87, FR-88, FR-89, FR-91, FR-122, FR-123 |
| reports/serializers_manager.py | FR-83, FR-85, FR-87, FR-88, FR-89, FR-122, FR-123 |
| reports/urls_manager.py | Route Manager cho Dashboard, Reports, Export APIs |
| system/views_manager.py | FR-97 |
| system/serializers_manager.py | FR-97 |
| system/urls_manager.py | Route Manager cho scoped activity history |
| accounts/views_manager.py | FR-20 |
| accounts/serializers_manager.py | FR-20 |
| accounts/urls_manager.py | Route Manager cho team directory và employee search |
| worktracker_core/urls.py | Trạm định tuyến trung tâm, include các `urls_manager.py` trong khu vực Manager |