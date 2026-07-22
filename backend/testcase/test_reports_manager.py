import datetime
import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient
from model_bakery import baker
from accounts.models import Permission
from system.security.permissions_manager import MANAGER_ROLE_CODE


# ============================================================
# Helper — dùng get_or_create để tránh duplicate key cho Permission
# ============================================================
def make_manager_with_perms(role, *permission_codes):
    """Tạo Manager và cấp quyền cho role."""
    user = baker.make("accounts.CustomUser", role=role, is_active=True)
    for code in permission_codes:
        # get_or_create để tránh lỗi UNIQUE constraint khi 2 manager
        # trong cùng 1 test cùng cần 1 permission code
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        baker.make("accounts.RolePermission", role=role, permission=perm)
    return user


# ============================================================
# Test 1: Dashboard — trả về đúng cấu trúc và scoped đúng
# ============================================================
@pytest.mark.django_db
class TestManagerDashboard:
    """
    Kiểm thử API Dashboard của Manager.
    GET /api/manager/dashboard/
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager = make_manager_with_perms(self.role_manager, "report:view")

        self.url = "/api/manager/dashboard/"

    def test_dashboard_returns_200_ok(self):
        """Manager gọi Dashboard -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK

    def test_dashboard_returns_correct_structure(self):
        """Dashboard phải trả về đầy đủ các key cần thiết."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "month" in data
        assert "year" in data
        assert "managed_jobs_count" in data
        assert "task_status_summary" in data
        assert "overdue_task_rate" in data
        assert "team_total_hours" in data
        assert "workload_per_employee" in data
        assert "productivity_heatmap" in data

    def test_dashboard_with_month_year_params(self):
        """Dashboard với query params month/year cụ thể -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url, {"month": 6, "year": 2026})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["month"] == 6
        assert response.data["year"] == 2026

    def test_dashboard_managed_jobs_count_is_scoped(self):
        """
        managed_jobs_count chỉ đếm Job của Manager đang đăng nhập,
        không đếm Job của Manager khác.
        """
        self.client.force_authenticate(user=self.manager)

        # Manager này chưa có Job nào
        response_before = self.client.get(self.url)
        assert response_before.data["managed_jobs_count"] == 0

        # Tạo 2 Job cho Manager này
        client_db = baker.make("projects.Client")
        baker.make("projects.Job", manager=self.manager, client=client_db, job_name="Job 1")
        baker.make("projects.Job", manager=self.manager, client=client_db, job_name="Job 2")

        # Tạo Job cho Manager khác (không được tính)
        other_manager = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        baker.make("projects.Job", manager=other_manager, client=client_db, job_name="Job khác")

        response_after = self.client.get(self.url)
        assert response_after.data["managed_jobs_count"] == 2

    def test_unauthenticated_user_cannot_access_dashboard(self):
        """Người chưa đăng nhập truy cập Dashboard -> 401 Unauthorized."""
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_month_param_returns_400(self):
        """Truyền month=13 (không hợp lệ) -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url, {"month": 13, "year": 2026})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================
# Test 2: Task Summary Report
# Cấu trúc thực tế: {filters, rows, summary: {status_summary, priority_summary, ...}}
# ============================================================
@pytest.mark.django_db
class TestManagerTaskSummaryReport:
    """
    Kiểm thử API báo cáo tổng hợp Task.
    GET /api/manager/reports/task-summary/
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")
        self.manager = make_manager_with_perms(self.role_manager, "report:view")

        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job báo cáo",
        )
        baker.make("tasks.Task", job=self.job, title="Task 1", status="TODO")
        baker.make("tasks.Task", job=self.job, title="Task 2", status="IN_PROGRESS")

        self.url = "/api/manager/reports/task-summary/"

    def test_task_summary_returns_200_ok(self):
        """Manager gọi Task Summary Report -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK

    def test_task_summary_returns_correct_keys(self):
        """Task Summary phải có các key cần thiết ở top-level."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        # 3 key top-level theo cấu trúc thực tế của service
        assert "filters" in data
        assert "rows" in data
        assert "summary" in data
        # summary phải có các key thống kê
        summary = data["summary"]
        assert "status_summary" in summary
        assert "priority_summary" in summary

    def test_task_summary_scoped_to_own_jobs(self):
        """Task Summary chỉ báo cáo Task trong Job của mình."""
        # Manager B và Job B không được tính
        manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        job_B = baker.make(
            "projects.Job",
            manager=manager_B,
            client=self.client_db,
            job_name="Job của B",
        )
        baker.make("tasks.Task", job=job_B, title="Task của B", status="TODO")

        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        # rows chứa danh sách task — Manager A có 2, không phải 3
        assert len(response.data["rows"]) == 2

    def test_task_summary_filter_by_job_id(self):
        """Filter theo job_id -> chỉ trả về Task của Job đó."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url, {"job_id": self.job.id})
        assert response.status_code == status.HTTP_200_OK


# ============================================================
# Test 3: Timesheet Detail Report
# Cấu trúc thực tế: {filters, rows, summary: {total_hours, employee_summary, ...}}
# ============================================================
@pytest.mark.django_db
class TestManagerTimesheetDetailReport:
    """
    Kiểm thử API báo cáo chi tiết Timesheet.
    GET /api/manager/reports/timesheet-detail/
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")
        self.manager = make_manager_with_perms(self.role_manager, "report:view")

        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job Timesheet",
        )
        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )
        self.task = baker.make("tasks.Task", job=self.job, title="Task log")

        # Tạo 1 LogWork
        baker.make(
            "timesheets.LogWork",
            task=self.task,
            user=self.employee,
            work_date=datetime.date.today(),
            hours_spent="8.00",
            review_status="PENDING",
        )

        self.url = "/api/manager/reports/timesheet-detail/"

    def test_timesheet_detail_returns_200_ok(self):
        """Manager gọi Timesheet Detail Report -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK

    def test_timesheet_detail_returns_correct_keys(self):
        """Timesheet Detail phải có các key top-level và summary đúng."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        # 3 key top-level
        assert "filters" in data
        assert "rows" in data
        assert "summary" in data
        # summary phải có total_hours
        assert "total_hours" in data["summary"]

    def test_timesheet_detail_filter_by_date_range(self):
        """Filter theo work_date_from/to -> trả về đúng logwork trong khoảng."""
        self.client.force_authenticate(user=self.manager)
        today = datetime.date.today()
        response = self.client.get(self.url, {
            "work_date_from": today.isoformat(),
            "work_date_to": today.isoformat(),
        })
        assert response.status_code == status.HTTP_200_OK
        # rows phải có ít nhất 1 logwork
        assert len(response.data["rows"]) >= 1

    def test_timesheet_detail_scoped_to_own_jobs(self):
        """Timesheet chỉ báo cáo LogWork thuộc Job của mình."""
        manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        job_B = baker.make(
            "projects.Job",
            manager=manager_B,
            client=self.client_db,
            job_name="Job B",
        )
        task_B = baker.make("tasks.Task", job=job_B, title="Task B")
        baker.make(
            "timesheets.LogWork",
            task=task_B,
            user=self.employee,
            work_date=datetime.date.today(),
            hours_spent="4.00",
            review_status="PENDING",
        )

        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        # Manager A chỉ thấy 1 row (logwork của mình), không thấy logwork của Job B
        assert len(response.data["rows"]) == 1


# ============================================================
# Test 4: Report Export
# ============================================================
@pytest.mark.django_db
class TestManagerReportExport:
    """
    Kiểm thử API export báo cáo.
    POST /api/manager/reports/export/
    """

    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        # Manager có đủ quyền export
        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager = make_manager_with_perms(
            self.role_manager, "report:view", "report:export"
        )

        # Manager chỉ có view, không có export — dùng role khác để tránh conflict
        self.role_view_only = baker.make("accounts.Role", code="MANAGER_VIEW_ONLY")
        self.manager_no_export = make_manager_with_perms(
            self.role_view_only,
            # KHÔNG cấp report:export, chỉ cấp report:view
            # Nhưng role này không có MANAGER_ROLE_CODE nên IsManagerRole sẽ chặn
        )

        self.client_db = baker.make("projects.Client")
        baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job Export",
        )

        self.url = "/api/manager/reports/export/"

    def test_export_task_summary_returns_file(self):
        """Manager export Task Summary -> trả về file (có Content-Disposition)."""
        self.client.force_authenticate(user=self.manager)
        payload = {
            "report_type": "TASK_SUMMARY",
            "file_format": "XLSX",
        }
        response = self.client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        # Phải có header Content-Disposition để trình duyệt tải về
        assert "Content-Disposition" in response

    def test_non_manager_role_cannot_export(self):
        """User không có MANAGER role -> 403 Forbidden."""
        self.client.force_authenticate(user=self.manager_no_export)
        payload = {
            "report_type": "TASK_SUMMARY",
            "file_format": "XLSX",
        }
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_export_without_report_type_returns_400(self):
        """Thiếu report_type -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(self.url, {"file_format": "XLSX"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_export_timesheet_detail_xlsx_returns_file(self):
        """Manager export Timesheet Detail XLSX -> trả về file 200 OK."""
        self.client.force_authenticate(user=self.manager)
        payload = {
            "report_type": "TIMESHEET_DETAIL",
            "file_format": "XLSX",
        }
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "Content-Disposition" in response

    def test_export_task_summary_pdf_returns_file(self):
        """Manager export Task Summary PDF -> trả về file PDF 200 OK."""
        self.client.force_authenticate(user=self.manager)
        payload = {
            "report_type": "TASK_SUMMARY",
            "file_format": "PDF",
        }
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "Content-Disposition" in response

    def test_export_timesheet_detail_pdf_returns_file(self):
        """Manager export Timesheet Detail PDF -> trả về file PDF 200 OK."""
        self.client.force_authenticate(user=self.manager)
        payload = {
            "report_type": "TIMESHEET_DETAIL",
            "file_format": "PDF",
        }
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "Content-Disposition" in response

    def test_export_invalid_format_raises_400(self):
        """Export với định dạng file không hỗ trợ (VD: CSV) -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        payload = {
            "report_type": "TASK_SUMMARY",
            "file_format": "CSV",
        }
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_export_invalid_report_type_raises_400(self):
        """Export với loại báo cáo không hỗ trợ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        payload = {
            "report_type": "INVALID_REPORT_TYPE",
            "file_format": "XLSX",
        }
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

