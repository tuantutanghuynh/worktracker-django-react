# Executive Code Annotation: `backend/system/views_admin.py`

**Package / Module:** `backend.system.views_admin` · Admin System Dashboard & Audit Log Query Endpoints

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (bảng điều khiển phi thuyền, kính hiển vi, két an toàn...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Tổng Hợp Dữ Liệu Trang Quản Trị (Admin Views Architecture Diagram)

```
                            HTTP Request từ Admin
                                      │
                                      ▼
                        HasPermission('audit:view')
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        ┌─────────────────────┐               ┌─────────────────────┐
        │  AuditLogViewSet    │               │    DashboardView    │
        │ (ReadOnlyModelViewSet)               │      (APIView)      │
        └──────────┬──────────┘               └──────────┬──────────┘
                   │                                     │
    ┌──────────────┼──────────────┐       ┌──────────────┼──────────────┬──────────────┐
    ▼              ▼              ▼       ▼              ▼              ▼              ▼
 Lọc Actor     Lọc Action     Lọc Date   Clients      Jobs & Tasks   LogWorks      Audit Summary
 (user_id)   (CREATE/LOCK..) (from-to)  Overview     (Status &      (Approved     (Created/Locked
                                                     Overdue)        Hours)        Today)
    │              │              │       │              │              │              │
    └──────────────┴──────────────┼───────┴──────────────┴──────────────┴──────────────┘
                                  ▼
                     HTTP Response (JSON Payload)
```

> **Vì sao `AuditLogViewSet` lại kế thừa từ `ReadOnlyModelViewSet` thay vì `ModelViewSet` thông thường?**
> Nguyên tắc cốt lõi của nhật ký vết bảo mật (Audit Log) là tính **Bất biến (Immutability)**. Một khi bản ghi nhật ký được hệ thống ghi lại (ai truy cập, ai đổi lương, ai khóa sổ), NÓ KHÔNG ĐƯỢC PHÉP BỊ SỬA HOẶC XÓA bởi bất kỳ ai, kể cả Admin tối cao. Việc dùng `ReadOnlyModelViewSet` chỉ mở các phương thức đọc `GET` (list và detail), tự động vô hiệu hóa hoàn toàn các HTTP method sửa xóa (`POST`, `PUT`, `PATCH`, `DELETE`), giúp ngăn chặn hành vi xóa vết gian lận qua API.

> **Vì sao `DashboardView` lại tính toán trực tiếp số liệu tổng hợp (Aggregation) bằng ORM (`Sum`, `count`) thay vì lưu sẵn các số thống kê vào 1 bảng DB riêng?**
> Việc lưu sẵn số liệu thống kê vào 1 bảng DB riêng dễ dẫn đến nguy cơ lệch dữ liệu (Data Desynchronization) nếu có giao dịch bị hủy hoặc chưa kịp cập nhật. Tính toán trực tiếp bằng các hàm tối ưu SQL như `count()` và `aggregate(Sum(...))` giúp Admin luôn nhìn thấy con số chính xác **Real-time 100%** tại thời điểm gọi API.

> **Vì sao cần bộ lọc đa tiêu chí (actor, action, table_name, date_from, date_to) trong `AuditLogViewSet`?**
> Khi hệ thống vận hành thực tế hàng năm, bảng `AuditLog` có thể phình to lên hàng triệu dòng dữ liệu. Việc cung cấp bộ lọc dynamic theo người thực hiện (`actor`), hành động (`action`), bảng ảnh hưởng (`table_name`) và khoảng thời gian (`date_from` đến `date_to`) giúp Admin và bộ phận kiểm toán bảo mật nhanh chóng khoanh vùng điều tra sự cố trong vài giây.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Các Model Liên Ứng Dụng

```python
from django.db.models import Sum
# "from django.db.models import Sum" = nạp hàm tính tổng `Sum` của Django ORM để thực thi câu lệnh SQL `SUM()` trực tiếp dưới CSDL.

from django.utils import timezone
# "from django.utils import timezone" = bộ công cụ xử lý thời gian chuẩn của Django (hỗ trợ Timezone UTC+7).

from rest_framework import viewsets
# "from rest_framework import viewsets" = nạp bộ ViewSet cao cấp từ DRF.

from rest_framework.views import APIView
# "from rest_framework.views import APIView" = nạp lớp View nền tảng để tùy biến các endpoint dạng custom logic.

from rest_framework.response import Response
# "from rest_framework.response import Response" = lớp đối tượng dùng để đóng gói dữ liệu trả về cho Client dưới dạng HTTP Response chuẩn JSON.

from accounts.models import CustomUser
# Nạp Model tài khoản người dùng từ app `accounts`.

from accounts.permissions import HasPermission
# Nạp class kiểm tra mã quyền chi tiết của app `accounts`.

from projects.models import Client, Job
# Nạp các Model Khách hàng (`Client`) và Dự án (`Job`) từ app `projects`.

from tasks.models import Task
# Nạp Model Nhiệm vụ (`Task`) từ app `tasks`.

from timesheets.models import LogWork
# Nạp Model Nhật ký làm việc (`LogWork`) từ app `timesheets`.

from .models import AuditLog
# Nạp Model Nhật ký hệ thống (`AuditLog`).

from .serializers_admin import AuditLogSerializer
# Nạp Serializer vừa tạo ở file `serializers_admin.py`.
```

---

### 2. ViewSet Truy Vấn Lịch Sử Hệ Thống Dành Cho Admin (`AuditLogViewSet`)

```python
# ADMIN-only views for the system app (audit log + dashboard).


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
# "class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):" = định nghĩa ViewSet chỉ hỗ trợ xem dữ liệu (Read-Only) cho nhật ký vết.

    serializer_class = AuditLogSerializer
    # Khai báo Serializer đại diện là `AuditLogSerializer`.

    def get_permissions(self):
        return [HasPermission('audit:view')]
    # Ghi đè hàm `get_permissions`: Yêu cầu người dùng phải có mã quyền `'audit:view'` mới được phép truy cập endpoint này.

    def get_queryset(self):
    # Ghi đè hàm `get_queryset` để xây dựng bộ lọc dữ liệu động theo tham số URL (Query Parameters).

        queryset = AuditLog.objects.all().order_by('-created_at')
        # Lấy toàn bộ nhật ký vết và sắp xếp giảm dần theo thời gian tạo (`-created_at`), tức là sự kiện mới nhất sẽ lên đầu.

        actor = self.request.query_params.get('actor')
        if actor:
            queryset = queryset.filter(user_id=actor)
        # Nếu URL có param `?actor=<user_id>` -> Lọc danh sách nhật ký do user này thực hiện.

        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        # Nếu URL có param `?action=LOCK_ACCOUNT` -> Lọc theo loại hành động cụ thể.

        table_name = self.request.query_params.get('table_name')
        if table_name:
            queryset = queryset.filter(table_name=table_name)
        # Nếu URL có param `?table_name=jobs` -> Lọc nhật ký tác động lên bảng cụ thể.

        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        # "created_at__date__gte=date_from" = lọc các bản ghi có ngày lớn hơn hoặc bằng (`gte` = greater than or equal) ngày bắt đầu.

        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        # "created_at__date__lte=date_to" = lọc các bản ghi có ngày nhỏ hơn hoặc bằng (`lte` = less than or equal) ngày kết thúc.

        return queryset
        # Trả về QuerySet đã được lọc hoàn chỉnh.
```

---

### 3. View Tổng Hợp Số Liệu Dashboard Quản Trị Hệ Thống (`DashboardView`)

```python
class DashboardView(APIView):

    def get_permissions(self):
        return [HasPermission('audit:view')]
    # Yêu cầu mã quyền `'audit:view'` để xem Dashboard quản trị.

    def get(self, request):
    # Định nghĩa phương thức xử lý HTTP GET request.

        today = timezone.now().date()
        # Lấy ngày hôm nay theo múi giờ hệ thống (UTC+7).

        active_clients = Client.objects.filter(is_active=True).count()
        # Đếm tổng số Khách hàng đang hợp tác hoạt động (`is_active=True`).

        running_jobs = Job.objects.filter(status='ACTIVE').count()
        # Đếm tổng số Dự án đang chạy (`status='ACTIVE'`).

        total_users = CustomUser.objects.filter(is_active=True).count()
        # Đếm tổng số Tài khoản nhân sự đang hoạt động trong hệ thống.

        overdue_jobs = Job.objects.filter(
            deadline__lt=today,
            status__in=['PLANNING', 'ACTIVE', 'ON_HOLD'],
        ).count()
        # Đếm số Dự án bị trễ hạn:
        # - `deadline__lt=today` = hạn chót nhỏ hơn ngày hôm nay (quá hạn).
        # - `status__in=['PLANNING', 'ACTIVE', 'ON_HOLD']` = dự án chưa hoàn thành hoặc chưa bị hủy.

        total_hours = (
            LogWork.objects
            .filter(review_status='APPROVED')
            .aggregate(total=Sum('hours_spent'))['total'] or 0
        )
        # Tính tổng số giờ làm việc thực tế đã được duyệt trong toàn công ty:
        # - Lọc `LogWork` có `review_status='APPROVED'`.
        # - `.aggregate(total=Sum('hours_spent'))` = gọi SQL `SUM(hours_spent)`.
        # - `['total'] or 0` = lấy giá trị tổng, nếu chưa có giờ làm nào (`None`) thì mặc định trả về `0`.

        jobs_by_status = {
            s: Job.objects.filter(status=s).count()
            for s in ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
        }
        # Cấu trúc Dictionary Comprehension: Tạo dictionary thống kê số lượng Dự án theo từng trạng thái (Lập kế hoạch, Đang chạy, Tạm dừng, Hoàn thành, Đã hủy).

        jobs_by_status['OVERDUE'] = overdue_jobs
        # Bổ sung chỉ số dự án quá hạn (`OVERDUE`) vào dictionary thống kê trạng thái dự án.

        clients_overview = {
            'active':   active_clients,
            'inactive': Client.objects.filter(is_active=False).count(),
            'total':    Client.objects.count(),
        }
        # Đóng gói chỉ số tổng quan về Khách hàng (Đang hoạt động, Ngừng hoạt động, Tổng số).

        task_status = {
            s: Task.objects.filter(status=s).count()
            for s in ['TODO', 'IN_PROGRESS', 'REVIEWING', 'COMPLETED', 'CANCELLED']
        }
        # Dictionary Comprehension: Thống kê số lượng Nhiệm vụ (Task) theo từng trạng thái công việc.

        audit_today = AuditLog.objects.filter(created_at__date=today)
        # Lọc toàn bộ bản ghi nhật ký vết phát sinh trong ngày hôm nay.

        audit_summary_today = {
            'account_created':   audit_today.filter(action='CREATE', table_name='users').count(),
            'account_locked':    audit_today.filter(action='LOCK_ACCOUNT').count(),
            'role_changed':      audit_today.filter(action='ASSIGN_ROLE').count(),
            'deadline_changed':  audit_today.filter(action='UPDATE', table_name='jobs').count(),
            'timesheet_locked':  audit_today.filter(action='LOCK_TIMESHEET').count(),
        }
        # Tóm tắt các sự kiện an ninh quan trọng trong ngày:
        # - Số tài khoản mới tạo.
        # - Số tài khoản bị khóa.
        # - Số lần thay đổi vai trò phân quyền.
        # - Số lần thay đổi hạn chót dự án.
        # - Số lần thực hiện khóa kỳ chấm công.

        return Response({
            'active_clients':      active_clients,
            'running_jobs':        running_jobs,
            'total_work_hours':    total_hours,
            'total_users':         total_users,
            'overdue_jobs':        overdue_jobs,
            'jobs_by_status':      jobs_by_status,
            'clients_overview':    clients_overview,
            'task_status':         task_status,
            'audit_summary_today': audit_summary_today,
        })
        # Đóng gói toàn bộ các chỉ số thống kê vào một đối tượng JSON Response và gửi về cho Frontend Admin Dashboard hiển thị.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| View Class | Loại DRF View | Kiểm Tra Quyền | Các Thống Kế / Bộ Lọc Chính | Ý Nghĩa Nghiệp Vụ WorkTracker |
|------------|---------------|----------------|----------------------------|--------------------------------|
| `AuditLogViewSet` | `ReadOnlyModelViewSet` | `HasPermission('audit:view')` | Lọc theo `actor`, `action`, `table_name`, `date_from`, `date_to` | Truy vấn nhật ký vết an ninh hệ thống bất biến (Immutability) |
| `DashboardView` | `APIView` (GET) | `HasPermission('audit:view')` | Thống kê số lượng Client, Job, Task, LogWork (Hours), Audit Today | Bảng điều khiển trung tâm cung cấp bức tranh toàn cảnh sức khỏe công ty |
