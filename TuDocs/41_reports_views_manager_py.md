# Executive Code Annotation: `backend/reports/views_manager.py`

**Package / Module:** `backend.reports.views_manager` · Manager Reporting & Export API Views

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Report & Export Manager (System Diagram)

```
                            ┌─────────────────────────────────────────┐
                            │       HTTP Request (Manager User)       │
                            └────────────────────┬────────────────────┘
                                                 │
                                                 ▼
                            ┌─────────────────────────────────────────┐
                            │      Permission & Scope Checking        │
                            │      IsActiveAuthenticated              │
                            │      IsManagerRole                      │
                            │      HasPermissionCode ('report:view')  │
                            └────────────────────┬────────────────────┘
                                                 │
        ┌───────────────────────────┬────────────┴──────────────┬───────────────────────────┐
        │ GET /dashboard/           │ GET /task-summary/        │ GET /timesheet-detail/    │ POST /export/
        ▼                           ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ Manager       │           │ ManagerTask   │           │ Manager       │           │ ManagerReport │
│ DashboardView │           │ SummaryReport │           │ TimesheetDetail│          │ ExportView    │
│ (build_       │           │ View          │           │ ReportView    │           │ (export_      │
│  dashboard)   │           │ (build_task_  │           │ (build_       │           │  manager_     │
│               │           │  summary)     │           │  timesheet)   │           │  report)      │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │                           │
        ▼                           ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ Response JSON │           │ Response JSON │           │ Response JSON │           │ HttpResponse  │
│ (200 OK)      │           │ (200 OK)      │           │ (200 OK)      │           │ Binary File   │
└───────────────┘           └───────────────┘           └───────────────┘           │ (Attachment)  │
                                                                                    └───────────────┘
```

> **Vì sao thao tác Xuất Báo Cáo (`ManagerReportExportView`) mặc dù Read-Only với dữ liệu nghiệp vụ nhưng lại bắt buộc phải ghi `log_action` (AuditLog)?**
> Việc xuất file báo cáo (Excel/PDF) chứa các thông tin tổng hợp nhạy cảm như chi tiết chấm công, danh sách công việc và năng suất của nhân viên. Để phòng chống rủi ro rò rỉ dữ liệu (Data Leakage) và tuân thủ các quy định bảo mật thông tin doanh nghiệp, hệ thống bắt buộc phải ghi lại Audit Log hành động `REPORT_EXPORTED` kèm thông tin ai đã xuất, thời gian nào và bộ lọc dữ liệu là gì.

> **Vì sao mặc định `ManagerDashboardView` lại tự động lấy tháng/năm hiện tại khi client không truyền `month` và `year`?**
> Đây là thiết kế tối ưu hóa trải nghiệm người dùng (UX): Khi Manager vừa truy cập vào màn hình Dashboard, giao diện sẽ lập tức hiển thị chỉ số tổng quan của tháng hiện tại (`timezone.localdate()`) mà không bắt người dùng phải thao tác chọn bộ lọc thủ công.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Các Services Báo Cáo (Imports)

```python
from django.http import HttpResponse
# "from django.http import HttpResponse" = mượn lớp `HttpResponse` cơ bản của Django để trả về dữ liệu nhị phân (file Excel/PDF download).

from django.utils import timezone
# "from django.utils import timezone" = mượn module quản lý múi giờ hệ thống để xác định ngày/tháng hiện tại.

from rest_framework import status
# Import bộ mã trạng thái HTTP.

from rest_framework.response import Response
# Import lớp trả về dữ liệu dạng JSON.

from rest_framework.views import APIView
# Import lớp `APIView` làm nền tảng xây dựng các endpoint báo cáo độc lập.

from reports.serializers_manager import (
    ManagerDashboardQuerySerializer,
    ManagerReportExportQuerySerializer,
    ManagerTaskSummaryReportQuerySerializer,
    ManagerTimesheetDetailReportQuerySerializer,
)
# Import bộ Serializer kiểm định tham số đầu vào (Query Parameters / Request Body) của Manager.

from reports.services.manager_dashboard_service import build_dashboard
# Service tổng hợp chỉ số Dashboard (tổng số Job, số Task hoàn thành, tổng giờ làm...).

from reports.services.manager_task_summary_report_service import (
    build_task_summary_report,
)
# Service tổng hợp báo cáo Task theo dự án, trạng thái, người thực hiện.

from reports.services.manager_timesheet_detail_report_service import (
    build_timesheet_detail_report,
)
# Service tổng hợp chi tiết chấm công (Timesheet) trong phạm vi quản lý của Manager.

from reports.services.manager_report_export_service import (
    export_manager_report,
)
# Service sinh file xuất báo cáo nhị phân (Excel XLSX / PDF).

from system.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
# Bộ 3 quyền an toàn bảo vệ API của Manager.
```

---

### 2. View Dashboard Tổng Quan (`ManagerDashboardView`)

```python
class ManagerDashboardView(APIView):
# "class ManagerDashboardView(APIView):" = Endpoint cung cấp dữ liệu chỉ số tổng quan Dashboard cho Manager.

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    # Phân quyền 3 lớp bắt buộc.

    required_permission = "report:view"
    # Yêu cầu mã quyền `report:view`.

    def get(self, request):
    # GET /api/manager/dashboard/?month=7&year=2026
        today = timezone.localdate()
        # Lấy ngày hiện tại theo múi giờ địa phương (Asia/Ho_Chi_Minh).

        data = {
            "month": request.query_params.get("month", today.month),
            "year": request.query_params.get("year", today.year),
        }
        # Nếu Frontend không truyền `month` hoặc `year`, tự động lấy tháng/năm hiện tại làm mặc định.

        serializer = ManagerDashboardQuerySerializer(data=data)
        serializer.is_valid(raise_exception=True)
        # Kiểm tra tính hợp lệ của tháng (1-12) và năm.

        dashboard = build_dashboard(
            user=request.user,
            month=serializer.validated_data["month"],
            year=serializer.validated_data["year"],
        )
        # Ủy quyền cho Service tính toán dữ liệu Dashboard dựa theo scope `user`.

        return Response(
            dashboard,
            status=status.HTTP_200_OK,
        )
```

---

### 3. View Báo Cáo Tổng Hợp Công Việc & Chi Tiết Chấm Công

```python
class ManagerTaskSummaryReportView(APIView):
# "class ManagerTaskSummaryReportView(APIView):" = Báo cáo thống kê tổng hợp Công việc (Task).

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
    # GET /api/manager/reports/task-summary/
        serializer = ManagerTaskSummaryReportQuerySerializer(
            data=request.query_params,
        )
        serializer.is_valid(raise_exception=True)

        report_data = build_task_summary_report(
            user=request.user,
            filters=serializer.validated_data,
        )
        # Gọi Service tính toán báo cáo Task Summary trong scope của Manager.

        return Response(
            report_data,
            status=status.HTTP_200_OK,
        )


class ManagerTimesheetDetailReportView(APIView):
# "class ManagerTimesheetDetailReportView(APIView):" = Báo cáo thống kê chi tiết Nhật ký Chấm công (Timesheet).

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
    # GET /api/manager/reports/timesheet-detail/
        serializer = ManagerTimesheetDetailReportQuerySerializer(
            data=request.query_params,
        )
        serializer.is_valid(raise_exception=True)

        report_data = build_timesheet_detail_report(
            user=request.user,
            filters=serializer.validated_data,
        )
        # Gọi Service truy vấn chi tiết Timesheet thuộc các Job do Manager quản lý.

        return Response(
            report_data,
            status=status.HTTP_200_OK,
        )
```

---

### 4. View Export Báo Cáo Ra File (`ManagerReportExportView`)

```python
class ManagerReportExportView(APIView):
# "class ManagerReportExportView(APIView):" = API xuất dữ liệu báo cáo ra file tải về (Download File).

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:export"
    # Yêu cầu mã quyền cao cấp hơn: `report:export`.

    def post(self, request):
    # POST /api/manager/reports/export/
    # Body: {"report_type": "TASK_SUMMARY", "file_format": "XLSX", "job_id": 1}
        serializer = ManagerReportExportQuerySerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        exported_file = export_manager_report(
            user=request.user,
            filters=serializer.validated_data,
            request=request,
        )
        # Service thực thi sinh file nhị phân (bytes) và tự động ghi Audit Log `REPORT_EXPORTED`.

        response = HttpResponse(
            exported_file["content"],
            content_type=exported_file["content_type"],
        )
        # Đóng gói dữ liệu nhị phân của file vào `HttpResponse` kèm theo Content-Type chuẩn (VD: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet).

        response["Content-Disposition"] = (
            f'attachment; filename="{exported_file["filename"]}"'
        )
        # Đính kèm Header `Content-Disposition` để báo trình duyệt mở hộp thoại Download File về máy.

        return response
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| API View | HTTP Method | Permission Required | Input Serializer | Key Business Logic & Return Format |
|----------|-------------|---------------------|------------------|------------------------------------|
| `ManagerDashboardView` | `GET` | `report:view` | `ManagerDashboardQuerySerializer` | Trả về JSON tổng quan chỉ số tháng/năm trong scope Manager |
| `ManagerTaskSummaryReportView` | `GET` | `report:view` | `ManagerTaskSummaryReportQuerySerializer` | Trả về JSON thống kê danh sách Task lọc theo job, assignee, status |
| `ManagerTimesheetDetailReportView` | `GET` | `report:view` | `ManagerTimesheetDetailReportQuerySerializer` | Trả về JSON chi tiết các dòng LogWork theo khoảng ngày làm việc |
| `ManagerReportExportView` | `POST` | `report:export` | `ManagerReportExportQuerySerializer` | Trả về HttpResponse nhị phân đính kèm header Download File XLSX/PDF |
