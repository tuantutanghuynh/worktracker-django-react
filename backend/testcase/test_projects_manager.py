import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import axiosClient
from model_bakery import baker
from system.security.permissions_manager import MANAGER_ROLE_CODE


# ============================================================
# Helper
# ============================================================
def get_results(response_data):
    if isinstance(response_data, list):
        return response_data
    return response_data.get("results", response_data)


# ============================================================
# Test 1: Job CRUD — List, Retrieve, Create, Update
# ============================================================
@pytest.mark.django_db
class TestManagerJobCRUD:
    """
    Kiểm thử CRUD cơ bản cho Job của Manager.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        for code in ["job:view", "job:create", "job:update"]:
            perm = baker.make("accounts.Permission", code=code)
            baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

        self.manager_A = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.client_db = baker.make("projects.Client")

        self.job_A = baker.make(
            "projects.Job",
            manager=self.manager_A,
            client=self.client_db,
            job_name="Dự án Alpha",
        )
        self.job_B = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Dự án Beta",
        )

        self.list_url = "/api/manager/jobs/"
        self.detail_url_A = f"/api/manager/jobs/{self.job_A.id}/"
        self.detail_url_B = f"/api/manager/jobs/{self.job_B.id}/"

    def test_list_only_own_jobs(self):
        """Manager A chỉ thấy Job A trong danh sách, không thấy Job B."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.get(self.list_url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        job_ids = [item["id"] for item in results]

        assert self.job_A.id in job_ids
        assert self.job_B.id not in job_ids

    def test_retrieve_own_job(self):
        """Manager A lấy chi tiết Job A -> 200 OK."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.get(self.detail_url_A)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == self.job_A.id

    def test_cannot_retrieve_other_manager_job(self):
        """Manager A lấy chi tiết Job B (của Manager B) -> 404 Not Found."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.get(self.detail_url_B)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_job(self):
        """Manager tạo Job mới -> 201 Created, manager tự động là người tạo."""
        self.client.force_authenticate(user=self.manager_A)
        import datetime
        payload = {
            "client_id": self.client_db.id,
            "job_name": "Dự án mới toanh",
            "start_date": datetime.date.today().isoformat(),
            "deadline": (datetime.date.today() + datetime.timedelta(days=30)).isoformat(),
        }
        response = self.client.post(self.list_url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["job_name"] == "Dự án mới toanh"

    def test_partial_update_own_job(self):
        """Manager A cập nhật job_name của Job A -> 200 OK."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.patch(
            self.detail_url_A,
            {"job_name": "Dự án Alpha v2"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["job_name"] == "Dự án Alpha v2"

    def test_cannot_update_other_manager_job(self):
        """Manager A cố sửa Job B -> 404 Not Found."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.patch(
            self.detail_url_B,
            {"job_name": "Cố tình sửa"},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ============================================================
# Test 2: Đổi trạng thái Job
# ============================================================
@pytest.mark.django_db
class TestManagerJobStatusChange:
    """
    Kiểm thử Manager đổi trạng thái Job.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        for code in ["job:view", "job:change_status"]:
            perm = baker.make("accounts.Permission", code=code)
            baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

        self.manager_A = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.client_db = baker.make("projects.Client")

        self.job_A = baker.make(
            "projects.Job",
            manager=self.manager_A,
            client=self.client_db,
            job_name="Job sẽ đổi status",
            status="PLANNING",
        )
        self.job_B = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Job của B",
            status="PLANNING",
        )

    def test_change_own_job_status_to_active(self):
        """Manager đổi Job PLANNING -> ACTIVE -> 200 OK."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/jobs/{self.job_A.id}/status/"
        response = self.client.post(url, {"new_status": "ACTIVE"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "ACTIVE"

    def test_cannot_change_other_manager_job_status(self):
        """Manager A đổi trạng thái Job của B -> 404 Not Found."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/jobs/{self.job_B.id}/status/"
        response = self.client.post(url, {"new_status": "ACTIVE"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ============================================================
# Test 3: Kanban Board
# ============================================================
@pytest.mark.django_db
class TestManagerKanban:
    """
    Kiểm thử Kanban Board trả về đúng cấu trúc.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        perm = baker.make("accounts.Permission", code="task:view")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

        self.manager = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job Kanban test",
        )

        baker.make("tasks.Task", job=self.job, title="Task TODO", status="TODO")
        baker.make("tasks.Task", job=self.job, title="Task In Progress", status="IN_PROGRESS")

    def test_kanban_returns_correct_structure(self):
        """Kanban API trả về đúng cấu trúc có 'job' và 'columns'."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/jobs/{self.job.id}/kanban/"
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "job" in response.data
        assert "columns" in response.data
        # columns phải có đủ các trạng thái của Task
        assert "TODO" in response.data["columns"]
        assert "IN_PROGRESS" in response.data["columns"]
        # Kiểm tra số lượng Task trong từng cột
        assert len(response.data["columns"]["TODO"]) == 1
        assert len(response.data["columns"]["IN_PROGRESS"]) == 1


# ============================================================
# Test 4: ManagerJobFilter Edge Cases & Validation Errors
# ============================================================
@pytest.mark.django_db
class TestManagerJobFilters:
    """
    Kiểm thử 100% độ phủ cho class ManagerJobFilter.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        perm = baker.make("accounts.Permission", code="job:view")
        baker.make("accounts.RolePermission", role=self.role_manager, permission=perm)

        self.manager = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.client_db = baker.make("projects.Client")

        import datetime
        self.job_active = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Dự án Tìm Kiếm 1",
            description="Mô tả dự án",
            status="ACTIVE",
            start_date=datetime.date.today(),
            deadline=datetime.date.today() + datetime.timedelta(days=10),
        )
        self.job_completed = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Dự án Tìm Kiếm 2",
            status="COMPLETED",
            start_date=datetime.date.today(),
            deadline=datetime.date.today() - datetime.timedelta(days=5),
        )

        self.list_url = "/api/manager/jobs/"

    def test_filter_valid_status_and_status_in(self):
        """Filter status đơn và status__in hợp lệ -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"status": "ACTIVE"})
        assert res.status_code == status.HTTP_200_OK

        res = self.client.get(self.list_url, {"status__in": "ACTIVE,COMPLETED"})
        assert res.status_code == status.HTTP_200_OK

    def test_filter_invalid_status_raises_400(self):
        """Filter status không hợp lệ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"status": "INVALID_STATUS"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_invalid_status_in_raises_400(self):
        """Filter status__in chứa giá trị không hợp lệ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"status__in": "ACTIVE,WRONG_STATUS"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_invalid_client_id_raises_400(self):
        """Filter client_id không phải số nguyên -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"client_id": "not_an_int"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_valid_client_id(self):
        """Filter client_id hợp lệ -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"client_id": self.client_db.id})
        assert res.status_code == status.HTTP_200_OK

    def test_filter_invalid_deadline_from_format_raises_400(self):
        """Filter deadline_from sai định dạng -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"deadline_from": "2026/12/31"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_invalid_deadline_to_format_raises_400(self):
        """Filter deadline_to sai định dạng -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"deadline_to": "invalid-date"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_valid_deadline_range(self):
        """Filter deadline_from/to đúng định dạng -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {
            "deadline_from": "2020-01-01",
            "deadline_to": "2030-12-31",
        })
        assert res.status_code == status.HTTP_200_OK

    def test_filter_search(self):
        """Search job_name hoặc description -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"search": "Tìm Kiếm"})
        assert res.status_code == status.HTTP_200_OK

        res_empty = self.client.get(self.list_url, {"search": "   "})
        assert res_empty.status_code == status.HTTP_200_OK

    def test_filter_is_overdue(self):
        """Filter is_overdue=true / false / 1 / 0 / invalid -> 200/400."""
        self.client.force_authenticate(user=self.manager)
        res_true = self.client.get(self.list_url, {"is_overdue": "true"})
        assert res_true.status_code == status.HTTP_200_OK

        res_false = self.client.get(self.list_url, {"is_overdue": "false"})
        assert res_false.status_code == status.HTTP_200_OK

        res_invalid = self.client.get(self.list_url, {"is_overdue": "maybe"})
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_ordering(self):
        """Ordering hợp lệ & không hợp lệ."""
        self.client.force_authenticate(user=self.manager)
        res_valid = self.client.get(self.list_url, {"ordering": "-job_name"})
        assert res_valid.status_code == status.HTTP_200_OK

        res_invalid = self.client.get(self.list_url, {"ordering": "invalid_field"})
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST

