# Executive Code Annotation: `backend/projects/views_admin.py`

**Package / Module:** `backend.projects.views_admin` · Admin ViewSets for Project & Client Management

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Admin Projects (System Diagram)

```
                              ┌───────────────────────────────────┐
                              │    HTTP Request (Admin User)      │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │  HasPermission('client:create')   │
                              │  HasPermission('job:update')      │
                              └─────────────────┬─────────────────┘
                                                │ (Phân quyền RBAC)
                                                ▼
              ┌─────────────────────────────────┴─────────────────────────────────┐
              │                                                                   │
              ▼                                                                   ▼
┌───────────────────────────┐                                       ┌───────────────────────────┐
│       ClientViewSet       │                                       │        JobViewSet         │
│ (projects/views_admin.py) │                                       │ (projects/views_admin.py) │
└─────────────┬─────────────┘                                       └─────────────┬─────────────┘
              │                                                                   │
    ┌─────────┴─────────┐                                               ┌─────────┴─────────┐
    │                   │                                               │                   │
    ▼                   ▼                                               ▼                   ▼
┌───────┐      ┌────────────────┐                              ┌───────┐      ┌────────────────┐
│Client │      │ log_audit_event│                              │  Job  │      │ log_audit_event│
│Model  │      │  (Audit Log)   │                              │ Model │      │  (Audit Log)   │
└───────┘      └────────────────┘                              └───────┘      └────────────────┘
```

> **Vì sao Admin ViewSet lại thực hiện Soft-Delete (`is_active = False` hoặc `status = 'CANCELLED'`) thay vì xóa cứng dữ liệu (`delete()`)?**
> - **Client Soft-Delete (`is_active = False`):** Khách hàng liên quan tới rất nhiều hợp đồng, dự án (Job) và nhật ký chấm công (Timesheet). Nếu xóa cứng `Client`, toàn bộ liên kết FK sẽ bị mồ côi hoặc cascade xóa luôn toàn bộ dữ liệu lịch sử làm việc của nhân viên, gây sai lệch báo cáo tài chính và sổ cái.
> - **Job Soft-Delete (`status = 'CANCELLED'`):** Dự án bị hủy bỏ cần được giữ lại vết trên hệ thống để phục vụ đối soát giờ công đã làm trong quá khứ. Việc đổi trạng thái sang `CANCELLED` giúp ngưng nhận Task/LogWork mới nhưng bảo toàn dữ liệu báo cáo lịch sử.

> **Vì sao phải ghi `log_audit_event` cho tất cả các thao tác CREATE, UPDATE, DELETE của Admin?**
> - Quyền Admin có sức mạnh tối cao trên hệ thống. Mọi thay đổi danh mục Khách hàng hay Dự án cấp Admin đều ảnh hưởng trực tiếp đến dữ liệu kinh doanh. Việc lưu `old_values` và `new_values` vào `AuditLog` giúp truy vết chính xác ai đã sửa cái gì, vào lúc nào, từ địa chỉ IP nào để bảo đảm tính minh bạch và tuân thủ an toàn thông tin (Compliance).

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Các Module Phụ Trợ (Imports)

```python
from rest_framework import viewsets
# "from rest_framework import viewsets" = mượn module `viewsets` từ thư viện Django REST Framework.
# `viewsets` cung cấp sẵn các bộ xử lý CRUD chuẩn (ModelViewSet) giúp giảm 80% lượng code lặp đi lặp lại.

from .models import Client, Job
# "from .models import Client, Job" = import 2 model ORM đại diện cho 2 thực thể trong CSDL: Khách hàng (Client) và Dự án (Job).
# "Client" = đối tác thuê công ty làm dự án; "Job" = dự án/hợp đồng cụ thể.

from .serializers_admin import ClientSerializer, JobSerializer
# "from .serializers_admin import ClientSerializer, JobSerializer" = import các serializer dành riêng cho Admin.
# Serializer đóng vai trò là "máy dịch thuật" biến dữ liệu JSON từ request thành Python object và ngược lại.

from accounts.permissions import HasPermission
# "from accounts.permissions import HasPermission" = import class kiểm tra quyền truy cập tinh gọn dựa trên Permission Code (RBAC).

from system.utils import log_audit_event
# "from system.utils import log_audit_event" = import hàm ghi nhật ký vết hệ thống (Audit Log) để theo dõi hành vi người dùng.

# ADMIN-only views for the projects app (Clients / Jobs CRUD).
# Dòng comment định nghĩa scope: Các API View trong file này CHỈ DÀNH RIÊNG cho quản trị viên hệ thống (Admin).
```

---

### 2. Quản Lý Danh Mục Khách Hàng (`ClientViewSet`)

```python
class ClientViewSet(viewsets.ModelViewSet):
# "class ClientViewSet(viewsets.ModelViewSet):" = định nghĩa lớp xử lý API CRUD cho Khách hàng.
# Kế thừa từ `ModelViewSet` nghĩa là tự động có sẵn các action: list (GET), create (POST), retrieve (GET id), update (PUT/PATCH), destroy (DELETE).

    queryset = Client.objects.all()
    # "queryset = Client.objects.all()" = khai báo nguồn dữ liệu mặc định là lấy toàn bộ các bản ghi trong bảng Khách hàng (`clients`).

    serializer_class = ClientSerializer
    # "serializer_class = ClientSerializer" = chỉ định serializer mặc định để đóng gói/giải nén dữ liệu Khách hàng.

    def get_permissions(self):
    # "def get_permissions(self):" = ghi đè hàm lấy danh sách phân quyền động dựa theo từng thao tác (action).
        if self.action == 'create':
        # "if self.action == 'create':" = nếu người dùng đang gửi request tạo mới Khách hàng (POST /api/admin/clients/).
            return [HasPermission('client:create')]
            # "return [HasPermission('client:create')]" = yêu cầu người dùng phải sở hữu mã quyền `client:create`.
        return [HasPermission('client:update')]
        # "return [HasPermission('client:update')]" = với các thao tác khác (xem, sửa, xóa), yêu cầu mã quyền `client:update`.

    def perform_create(self, serializer):
    # "def perform_create(self, serializer):" = hàm can thiệp vào quá trình lưu dữ liệu khi tạo mới Khách hàng.
        instance = serializer.save()
        # "instance = serializer.save()" = thực thi lưu thông tin Khách hàng mới vào CSDL PostgreSQL và trả về đối tượng `Client` vừa tạo.
        log_audit_event(
        # "log_audit_event(...)" = kích hoạt hàm ghi nhật ký vết Audit Log.
            actor=self.request.user,
            # "actor=self.request.user" = ghi nhận người thực hiện là Admin đang đăng nhập.
            action='CREATE',
            # "action='CREATE'" = loại hành động là Tạo mới.
            table_name='clients',
            # "table_name='clients'" = tên bảng dữ liệu tác động là `clients`.
            record_id=instance.id,
            # "record_id=instance.id" = ID của Khách hàng mới được tạo.
            new_values=serializer.data,
            # "new_values=serializer.data" = lưu toàn bộ dữ liệu thuộc tính vừa tạo dưới dạng JSON.
            request=self.request,
            # "request=self.request" = truyền request để lấy thêm địa chỉ IP và User-Agent của Admin.
        )

    def perform_update(self, serializer):
    # "def perform_update(self, serializer):" = hàm can thiệp vào quá trình cập nhật thông tin Khách hàng.
        old_values = ClientSerializer(self.get_object()).data
        # "old_values = ..." = chụp lại trạng thái dữ liệu CŨ của Khách hàng trước khi bị chỉnh sửa để lưu vào Audit Log.
        instance = serializer.save()
        # "instance = serializer.save()" = tiến hành đè dữ liệu MỚI vào CSDL.
        log_audit_event(
        # Ghi nhật ký vết cho thao tác Cập nhật (UPDATE).
            actor=self.request.user,
            action='UPDATE',
            table_name='clients',
            record_id=instance.id,
            old_values=old_values,   # Lưu dữ liệu trước khi sửa
            new_values=serializer.data, # Lưu dữ liệu sau khi sửa
            request=self.request,
        )

    def perform_destroy(self, instance):
    # "def perform_destroy(self, instance):" = ghi đè hàm xóa Khách hàng (Xóa mềm / Soft Delete).
        old_values = ClientSerializer(instance).data
        # "old_values = ..." = chụp lại dữ liệu trước khi vô hiệu hóa.
        instance.is_active = False
        # "instance.is_active = False" = NGUYÊN TẮC NGHIỆP VỤ: Không xóa bản ghi khỏi DB mà chỉ gắn cờ `is_active = False` (Ngừng hoạt động).
        instance.save()
        # "instance.save()" = lưu trạng thái vô hiệu hóa vào CSDL.
        log_audit_event(
        # Ghi nhật ký vết cho thao tác Xóa (DELETE).
            actor=self.request.user,
            action='DELETE',
            table_name='clients',
            record_id=instance.id,
            old_values=old_values,
            request=self.request,
        )
```

---

### 3. Quản Lý Danh Mục Dự Án (`JobViewSet`)

```python
class JobViewSet(viewsets.ModelViewSet):
# "class JobViewSet(viewsets.ModelViewSet):" = định nghĩa lớp xử lý API CRUD cho Dự án (Job).

    queryset = Job.objects.all()
    # "queryset = Job.objects.all()" = lấy toàn bộ danh sách Dự án trong hệ thống.

    serializer_class = JobSerializer
    # "serializer_class = JobSerializer" = dùng `JobSerializer` để biến đổi dữ liệu Dự án.

    def get_permissions(self):
    # "def get_permissions(self):" = phân quyền động theo từng action nghiệp vụ của Dự án.
        if self.action == 'create':
            return [HasPermission('job:create')]
            # Bắt buộc có quyền `job:create` mới được phép khởi tạo dự án mới.
        return [HasPermission('job:update')]
        # Bắt buộc có quyền `job:update` để xem/chỉnh sửa thông tin dự án.

    def perform_create(self, serializer):
    # "def perform_create(self, serializer):" = xử lý logic lưu và ghi Audit Log khi tạo Dự án mới.
        instance = serializer.save()
        # Lưu Dự án mới vào CSDL.
        log_audit_event(
            actor=self.request.user,
            action='CREATE',
            table_name='jobs',
            record_id=instance.id,
            new_values=serializer.data,
            request=self.request,
        )

    def perform_update(self, serializer):
    # "def perform_update(self, serializer):" = xử lý logic lưu và ghi Audit Log khi cập nhật Dự án.
        old_values = JobSerializer(self.get_object()).data
        # Lấy dữ liệu cũ của Job trước khi cập nhật.
        instance = serializer.save()
        # Lưu thay đổi mới.
        log_audit_event(
            actor=self.request.user,
            action='UPDATE',
            table_name='jobs',
            record_id=instance.id,
            old_values=old_values,
            new_values=serializer.data,
            request=self.request,
        )

    def perform_destroy(self, instance):
    # "def perform_destroy(self, instance):" = xử lý Hủy Dự án (Soft Delete) thay vì xóa khỏi CSDL.
        old_values = JobSerializer(instance).data
        # Lưu snapshot dữ liệu cũ.
        instance.status = 'CANCELLED'
        # NGUYÊN TẮC NGHIỆP VỤ: Đổi trạng thái Dự án thành 'CANCELLED' (Đã hủy).
        # Giúp chặn việc tạo Task/LogWork mới thuộc dự án này nhưng vẫn giữ lịch sử chấm công cũ.
        instance.save()
        # Lưu trạng thái CANCELLED vào CSDL.
        log_audit_event(
            actor=self.request.user,
            action='DELETE',
            table_name='jobs',
            record_id=instance.id,
            old_values=old_values,
            request=self.request,
        )
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| ViewSet Name | Managed Model | Permission Code Required | Destructive Action Logic (Soft Delete) | Audit Log Table |
|--------------|---------------|--------------------------|-----------------------------------------|-----------------|
| **`ClientViewSet`** | `Client` | `client:create` (POST)<br>`client:update` (GET/PUT/PATCH/DELETE) | Gán `is_active = False` | `clients` |
| **`JobViewSet`** | `Job` | `job:create` (POST)<br>`job:update` (GET/PUT/PATCH/DELETE) | Gán `status = 'CANCELLED'` | `jobs` |
