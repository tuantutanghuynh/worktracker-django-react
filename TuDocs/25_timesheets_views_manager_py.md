# Executive Code Annotation: `backend/timesheets/views_manager.py`

**Package / Module:** `backend.timesheets.views_manager` · Manager ViewSets Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Cấu Trúc ViewSet Dành Cho Manager (Manager ViewSets Architecture)

```
                            ┌────────────────────────────────────────┐
                            │    Manager API Authorization Layer     │
                            │ [IsActiveAuthenticated, IsManagerRole] │
                            └───────────────────┬────────────────────┘
                                                │
          ┌─────────────────────────────────────┴─────────────────────────────────────┐
          ▼                                                                           ▼
[ManagerLogWorkViewSet]                                                     [ManagerTimeLockViewSet]
(ReadOnlyModelViewSet + Custom Actions)                                     (ModelViewSet + Custom Unlock Action)
  ├── Permission: Dynamic per action                                          ├── Permission: Dynamic per action
  │     - list/retrieve: "timesheet:view"                                     │     - list/retrieve: "timelock:view"
  │     - approve/reject: "timesheet:review"                                  │     - create: "timelock:lock"
  │     - correct: "timesheet:correct"                                        │     - unlock: "timelock:unlock"
  │     - void: "timesheet:void"                                              ├── Scope: scoped_timelocks(user) (JOB scope only)
  ├── Scope: scoped_logworks(user)                                            ├── Blocked: PATCH/DELETE (MethodNotAllowed)
  └── Actions: approve(), reject(), correct(), void()                         └── Action: unlock()
```

> **Vì sao `ManagerTimeLockViewSet` lại chặn các phương thức HTTP `PATCH` và `DELETE` (ném `MethodNotAllowed`)?**
> Cờ khóa kỳ công `TimeLock` mang tính chất pháp lý và tài chính cao. Không được phép xóa cứng (DELETE) hay sửa đổi tùy tiện (PATCH). Nếu muốn gỡ bỏ cờ khóa, Manager buộc phải gửi request `POST` đến endpoint action chuyên biệt `/unlock/` có đi kèm lý do giải thích minh bạch (`unlock_reason`).

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
1: from rest_framework import status, viewsets
2: from rest_framework.decorators import action
3: from rest_framework.exceptions import MethodNotAllowed
4: from rest_framework.response import Response
# Nạp các thành phần ViewSet, decorators và response của DRF.

6: from timesheets.models import LogWork, TimeLock
7: from timesheets.serializers_manager import (...)
19: from timesheets.filters_manager import ManagerLogWorkFilter, ManagerTimeLockFilter
23: from timesheets.services.logwork_review_manager_service import (...)
29: from timesheets.services.timelock_manager_service import lock_job_period, unlock_job_period
34: from system.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
35: from system.scoping_manager import get_scoped_object_or_404, scoped_jobs, scoped_logworks, scoped_timelocks
# Nạp đầy đủ các lớp Serializer, Filter, Domain Service, Permission và Scoping helper.

43: class ManagerLogWorkViewSet(viewsets.ReadOnlyModelViewSet):
# ViewSet quản lý việc xem và duyệt LogWork dành cho Manager.

51:     permission_classes = [IsActiveAuthenticated, IsManagerRole, HasPermissionCode]
# Bắt buộc user phải active, có Role Manager và sở hữu mã quyền RBAC tương ứng.

57:     http_method_names = ["get", "post", "head", "options"]
# Giới hạn các phương thức HTTP được phép.

64:     def get_permissions(self):
65:         action_permissions = {
66:             "list": "timesheet:view",
67:             "retrieve": "timesheet:view",
68:             "approve": "timesheet:review",
69:             "reject": "timesheet:review",
70:             "correct": "timesheet:correct",
71:             "void": "timesheet:void",
72:         }
73:         self.required_permission = action_permissions.get(self.action)
74:         return super().get_permissions()
# Phân quyền động theo từng action nghiệp vụ (vd: approve yêu cầu permission 'timesheet:review').

76:     def get_queryset(self):
77:         return (
78:             scoped_logworks(self.request.user)
79:             .select_related(...)
80:         )
# Áp dụng hàm phân quyền dữ liệu scoped_logworks(user), đảm bảo Manager chỉ nhìn thấy logwork thuộc Job của mình.

92:     def get_serializer_class(self):
# Trả về Serializer class tương ứng với từng action (list, approve, reject, correct, void...).

110:    def list(self, request, *args, **kwargs):
# API GET /api/manager/log-works/ danh sách logwork có hỗ trợ bộ lọc ManagerLogWorkFilter và phân trang.

151:    @action(detail=True, methods=["post"], url_path="approve")
152:    def approve(self, request, pk=None):
# Action POST /api/manager/log-works/{id}/approve/ gọi service approve_logwork().

180:    @action(detail=True, methods=["post"], url_path="reject")
181:    def reject(self, request, pk=None):
# Action POST /api/manager/log-works/{id}/reject/ gọi service reject_logwork().

209:    @action(detail=True, methods=["post"], url_path="correct")
210:    def correct(self, request, pk=None):
# Action POST /api/manager/log-works/{id}/correct/ gọi service correct_logwork().

242:    @action(detail=True, methods=["post"], url_path="void")
243:    def void(self, request, pk=None):
# Action POST /api/manager/log-works/{id}/void/ gọi service void_logwork().

272: class ManagerTimeLockViewSet(viewsets.ModelViewSet):
# ViewSet quản lý việc tạo và mở khóa TimeLock cấp Job dành cho Manager.

307:    def get_queryset(self):
308:        return (
309:            scoped_timelocks(self.request.user)
310:            .select_related(...)
311:        )
# Đảm bảo Manager chỉ nhìn thấy các cờ khóa cấp JOB thuộc Job của mình (loại trừ GLOBAL lock của Admin).

373:    def create(self, request, *args, **kwargs):
# API POST /api/manager/time-locks/ để tạo mới cờ khóa cho một Job.

409:    def partial_update(self, request, *args, **kwargs):
416:        raise MethodNotAllowed("PATCH")

418:    def destroy(self, request, *args, **kwargs):
424:        raise MethodNotAllowed("DELETE")
# Chặn hoàn toàn thao tác PATCH và DELETE đối với TimeLock.

426:    @action(detail=True, methods=["post"], url_path="unlock")
427:    def unlock(self, request, pk=None):
# Custom action POST /api/manager/time-locks/{id}/unlock/ để mở khóa kỳ công có yêu cầu lý do unlock_reason.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| ViewSet Class | Action Name | Dynamic Required Permission | Core Service / Operation Called |
|---------------|-------------|-----------------------------|---------------------------------|
| `ManagerLogWorkViewSet` | `list`, `retrieve` | `timesheet:view` | Retrieve scoped logworks with `ManagerLogWorkFilter` |
| `ManagerLogWorkViewSet` | `approve` | `timesheet:review` | Call `approve_logwork()` service |
| `ManagerLogWorkViewSet` | `reject` | `timesheet:review` | Call `reject_logwork()` service |
| `ManagerLogWorkViewSet` | `correct` | `timesheet:correct` | Call `correct_logwork()` service |
| `ManagerLogWorkViewSet` | `void` | `timesheet:void` | Call `void_logwork()` service |
| `ManagerTimeLockViewSet` | `create` | `timelock:lock` | Call `lock_job_period()` service |
| `ManagerTimeLockViewSet` | `unlock` | `timelock:unlock` | Call `unlock_job_period()` service |
