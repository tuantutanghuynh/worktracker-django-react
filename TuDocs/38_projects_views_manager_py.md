# Executive Code Annotation: `backend/projects/views_manager.py`

**Package / Module:** `backend.projects.views_manager` · Manager ViewSets for Job & Project Management

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Manager Projects (System Diagram)

```
                            ┌───────────────────────────────────────┐
                            │      HTTP Request (Manager User)      │
                            └───────────────────┬───────────────────┘
                                                │
                                                ▼
                            ┌───────────────────────────────────────┐
                            │      IsActiveAuthenticated            │
                            │      IsManagerRole                    │
                            │      HasPermissionCode                │
                            └───────────────────┬───────────────────┘
                                                │ (Phân quyền & Scope Check)
                                                ▼
                            ┌───────────────────────────────────────┐
                            │           ManagerJobViewSet           │
                            │   get_queryset() -> scoped_jobs()     │
                            │  (FILTER: jobs.manager_id = user.id)  │
                            └───────────────────┬───────────────────┘
                                                │
       ┌──────────────────────────────┬─────────┴────────────┬─────────────────────────────┐
       │ (GET list/retrieve)          │ (POST create)        │ (PATCH update)              │ (POST status)
       ▼                              ▼                      ▼                             ▼
┌───────────────┐              ┌──────────────┐       ┌──────────────┐              ┌──────────────────────┐
│  Annotate     │              │ transaction. │       │ transaction. │              │ manager_change_job_  │
│ Task Statistics│             │   atomic()   │       │   atomic()   │              │     status()         │
│ (TODO,        │              │  log_action  │       │  log_action  │              │ (State Machine Svc)  │
│ COMPLETED...) │              └──────────────┘       └──────────────┘              └──────────────────────┘
└───────────────┘
```

> **Vì sao Scope của Manager Job được tính bằng `jobs.manager_id = request.user.id` chứ không tính theo `departments.manager_id`?**
> Trong quy trình quản lý dự án thực tế, một Trưởng phòng (Manager) có thể phụ trách trực tiếp các Dự án (Job) được giao cho cá nhân mình quản lý, bất kể Dự án đó gồm các nhân sự thuộc nhiều Phòng ban khác nhau. Nếu scope theo `departments.manager_id`, Manager sẽ không thể xem được các Job do mình trực tiếp làm Quản trị dự án nếu Job đó nằm ngoài phạm vi phòng ban chính của họ.

> **Vì sao thao tác chỉnh sửa thông tin Job (`partial_update`) lại tách riêng endpoint chuyển đổi trạng thái (`change_status`)?**
> Việc cập nhật thông tin mô tả (tên, deadline) chỉ đơn thuần là chỉnh sửa văn bản. Trong khi đó, việc chuyển đổi trạng thái Dự án (VD: từ `PLANNING` sang `IN_PROGRESS`, hay từ `IN_PROGRESS` sang `COMPLETED`) liên quan trực tiếp đến **State Machine** của hệ thống, đòi hỏi phải thực hiện các quy tắc nghiệp vụ khắt khe (như kiểm tra điều kiện tất cả Task đã hoàn thành chưa) và gửi thông báo tới các bên liên quan.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Các Khái Niệm Lõi (Imports)

```python
from django.db import transaction
# "from django.db import transaction" = mượn module quản lý giao dịch CSDL (Database Transaction).
# Dùng `transaction.atomic()` đảm bảo nhóm các thao tác ghi DB và ghi AuditLog được thực thi nguyên tử (All or Nothing).

from django.db.models import Count, Q
# "from django.db.models import Count, Q" = import hàm đếm (`Count`) và truy vấn điều kiện phức tạp (`Q`).
# `Count` dùng để đếm số lượng Task; `Q` dùng để lọc đếm theo từng trạng thái Task riêng biệt trong một câu SQL duy nhất.

from rest_framework import status, viewsets
# "from rest_framework import status, viewsets" = mượn mã trạng thái HTTP chuẩn (200 OK, 201 Created) và bộ ViewSet.

from rest_framework.decorators import action
# "from rest_framework.decorators import action" = decorator biến một method thành endpoint API tùy chỉnh (VD: `/status/`).

from rest_framework.response import Response
# "from rest_framework.response import Response" = lớp đóng gói dữ liệu trả về cho Frontend dưới dạng JSON.

from projects.models import Job
# Import model `Job` đại diện cho dự án.

from projects.serializers_manager import (
    ManagerJobCreateSerializer,
    ManagerJobDetailSerializer,
    ManagerJobListSerializer,
    ManagerJobStatusChangeSerializer,
    ManagerJobUpdateSerializer,
)
# Import bộ serializer chuyên biệt dành cho màn hình Quản lý Dự án của Manager.

from projects.filters_manager import ManagerJobFilter
# Import bộ lọc tìm kiếm Dự án theo từ khóa, ngày tháng, trạng thái.

from projects.services.job_status_manager_service import manager_change_job_status
# Import Service layer chịu trách nhiệm thực thi State Machine đổi trạng thái Dự án của Manager.

from tasks.models import Task
# Import model `Task` để phục vụ lọc đếm số lượng Task theo trạng thái.

from system.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
# Import bộ 3 trạm gác bảo mật cho Manager: (1) Đã login & active, (2) Có role Manager, (3) Có Permission Code hợp lệ.

from system.scoping_manager import scoped_jobs
# Import hàm giới hạn phạm vi truy vấn (`scoped_jobs`), đảm bảo Manager chỉ thấy đúng dữ liệu thuộc quyền phụ trách.

from system.services.audit_manager_service import snapshot, log_action
# Import service hỗ trợ chụp lại ảnh dữ liệu (`snapshot`) và ghi lịch sử vết thao tác Manager (`log_action`).
```

---

### 2. Cấu Hình Lớp ViewSet & Phân Quyền (`ManagerJobViewSet`)

```python
class ManagerJobViewSet(viewsets.ModelViewSet):
# "class ManagerJobViewSet(viewsets.ModelViewSet):" = ViewSet xử lý toàn bộ các thao tác nghiệp vụ Dự án của Manager.

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    # "permission_classes = [...]" = Bộ 3 lớp kiểm soát an ninh bắt buộc đối với Manager.

    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]
    # "http_method_names = [...]" = CHỈ CHO PHÉP các method này. Cố tình chặn `delete` và `put` để tuân thủ nghiệp vụ Soft-Delete & Update từng phần.

    def get_permissions(self):
    # Hàm gán mã quyền tương ứng với từng action để `HasPermissionCode` kiểm tra:
        action_permissions = {
            "list": "job:view",            # Xem danh sách dự án
            "retrieve": "job:view",        # Xem chi tiết dự án
            "create": "job:create",        # Tạo dự án mới
            "partial_update": "job:update",# Sửa thông tin dự án
            "change_status": "job:change_status", # Đổi trạng thái dự án
        }
        
        self.required_permission = action_permissions.get(self.action)
        # Gán mã quyền bắt buộc vào biến `required_permission` của instance View.
        
        return super().get_permissions()
```

---

### 3. Tối Ưu Truy Vấn & Scope Dữ Liệu (`get_queryset`)

```python
    def get_queryset(self):
    # "def get_queryset(self):" = định nghĩa câu truy vấn cơ sở dữ liệu có tính toán sẵn chỉ số thống kê (Aggregation).
        return (
            scoped_jobs(self.request.user)
            # 1. SCOPE: Tự động thêm điều kiện `WHERE manager_id = request.user.id`. Chặn triệt để lộ dữ liệu dự án của Manager khác.

            .select_related("client", "manager", "manager__profile")
            # 2. OPTIMIZATION: Join trước các bảng `Client`, `User`, `EmployeeProfile` để tránh lỗi N+1 Query.

            .annotate(
            # 3. STATISTICAL ANNOTATION: Tính toán luôn số lượng công việc theo từng trạng thái bằng 1 câu lệnh SQL duy nhất:
                total_tasks=Count("tasks", distinct=True),
                # Tổng số Task thuộc Job.

                todo_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.TODO),
                    distinct=True,
                ),
                # Số Task ở trạng thái Chờ làm (TODO).

                in_progress_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.IN_PROGRESS),
                    distinct=True,
                ),
                # Số Task đang Đang thực hiện (IN_PROGRESS).

                reviewing_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.REVIEWING),
                    distinct=True,
                ),
                # Số Task đang Đang duyệt (REVIEWING).

                completed_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.COMPLETED),
                    distinct=True,
                ),
                # Số Task đã Hoàn thành (COMPLETED).

                cancelled_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.CANCELLED),
                    distinct=True,
                ),
                # Số Task đã Hủy (CANCELLED).
            )
            .order_by("-created_at")
            # Sắp xếp các Dự án mới tạo lên đầu tiên.
        )
```

---

### 4. Chọn Serializer Động & Các API Endpoints CRUD

```python
    def get_serializer_class(self):
    # Chọn Serializer phù hợp với mục đích của từng request để tối ưu dung lượng JSON trả về:
        if self.action == "list":
            return ManagerJobListSerializer # Dạng gọn nhẹ cho danh sách
        if self.action == "create":
            return ManagerJobCreateSerializer # Chỉ chứa trường dữ liệu khi khởi tạo
        if self.action in ["partial_update"]:
            return ManagerJobUpdateSerializer # Chỉ cho sửa name, description, deadline
        if self.action == "change_status":
            return ManagerJobStatusChangeSerializer # Chỉ chứa new_status và reason
        return ManagerJobDetailSerializer # Dạng đầy đủ kèm thông tin Client và Task stats

    def list(self, request, *args, **kwargs):
    # GET /api/manager/jobs/ — Lấy danh sách dự án có phân trang & bộ lọc.
        queryset = self.get_queryset()
        queryset = ManagerJobFilter.apply(queryset, request.query_params)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ManagerJobListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = ManagerJobListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
    # GET /api/manager/jobs/{id}/ — Lấy thông tin chi tiết của 1 Dự án.
        job = self.get_object() # Tự động áp dụng get_queryset() và kiểm tra 404
        serializer = ManagerJobDetailSerializer(job)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
    # POST /api/manager/jobs/ — Manager khởi tạo Dự án mới.
        serializer = ManagerJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
        # Đảm bảo lưu Job và lưu Audit Log diễn ra đồng thời:
            job = serializer.save(
                manager=request.user,
                # NGUYÊN TẮC NGHIỆP VỤ: Tự động gán Manager phụ trách là chính user đang đăng nhập.
            )
            log_action(
                user=request.user,
                action="CREATE_JOB",
                table_name="jobs",
                record_id=job.id,
                old_values=None,
                new_values=snapshot(job),
                request=request,
            )

        output_serializer = ManagerJobDetailSerializer(job)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
    # PATCH /api/manager/jobs/{id}/ — Sửa thông tin Dự án (tên, mô tả, deadline).
        job = self.get_object()
        old_values = snapshot(
            job,
            fields=["job_name", "description", "deadline"],
        )
        serializer = ManagerJobUpdateSerializer(instance=job, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            updated_job = serializer.save()
            log_action(
                user=request.user,
                action="UPDATE_JOB",
                table_name="jobs",
                record_id=updated_job.id,
                old_values=old_values,
                new_values=snapshot(updated_job, fields=["job_name", "description", "deadline"]),
                request=request,
            )

        output_serializer = ManagerJobDetailSerializer(updated_job)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
    # POST /api/manager/jobs/{id}/status/ — Chuyển đổi trạng thái Dự án qua Service Layer.
        job = self.get_object()
        serializer = ManagerJobStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_job = manager_change_job_status(
        # Ủy quyền toàn bộ việc kiểm tra State Machine cho Service layer:
            user=request.user,
            job=job,
            new_status=serializer.validated_data["new_status"],
            reason=serializer.validated_data.get("reason"),
            request=request,
        )

        output_serializer = ManagerJobDetailSerializer(updated_job)
        return Response(output_serializer.data, status=status.HTTP_200_OK)
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| API Endpoint | HTTP Method | Serializer Used | Permission Code | Scope Rule & Key Action |
|--------------|-------------|-----------------|-----------------|-------------------------|
| `/api/manager/jobs/` | `GET` | `ManagerJobListSerializer` | `job:view` | Lọc `manager_id = user.id`, annotate 5 trạng thái Task |
| `/api/manager/jobs/{id}/` | `GET` | `ManagerJobDetailSerializer` | `job:view` | Xem chi tiết 1 Job trong scope của Manager |
| `/api/manager/jobs/` | `POST` | `ManagerJobCreateSerializer` | `job:create` | Tạo mới Job, gán `manager = request.user`, ghi AuditLog |
| `/api/manager/jobs/{id}/` | `PATCH` | `ManagerJobUpdateSerializer` | `job:update` | Cập nhật `job_name`, `description`, `deadline`, ghi AuditLog |
| `/api/manager/jobs/{id}/status/` | `POST` | `ManagerJobStatusChangeSerializer` | `job:change_status` | Kích hoạt State Machine đổi trạng thái Job qua Svc |
