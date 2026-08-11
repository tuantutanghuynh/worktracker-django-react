import datetime
import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import axiosClient
from model_bakery import baker
from accounts.models import Permission
from system.security.permissions_manager import MANAGER_ROLE_CODE


# ============================================================
# Helper: lấy kết quả từ response (hỗ trợ cả có/không pagination)
# ============================================================
def get_results(response_data):
    if isinstance(response_data, list):
        return response_data
    return response_data.get("results", response_data)


def make_manager_with_perms(role, *permission_codes):
    """Tạo Manager và cấp các quyền được truyền vào."""
    user = baker.make("accounts.CustomUser", role=role, is_active=True)
    for code in permission_codes:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        baker.make("accounts.RolePermission", role=role, permission=perm)
    return user


# ============================================================
# Test 1: Scoping — Manager chỉ thấy Task thuộc Job của mình
# ============================================================
@pytest.mark.django_db
class TestManagerJobScoping:
    """
    Kiểm thử rằng Manager chỉ có thể truy cập các Task nằm trong các Job do
    chính mình quản lý (scoping dựa trên trường `manager` của Job).
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager_A = make_manager_with_perms(self.role_manager, "task:view")
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )

        self.client_db = baker.make("projects.Client")

        self.job_A = baker.make(
            "projects.Job",
            manager=self.manager_A,
            client=self.client_db,
            job_name="Dự án của A",
        )
        self.job_B = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Dự án của B",
        )

        self.task_A = baker.make("tasks.Task", job=self.job_A, title="Task của Job A")
        self.task_B = baker.make("tasks.Task", job=self.job_B, title="Task của Job B")

        self.url = "/api/manager/tasks/"

    def test_manager_A_only_sees_task_A(self):
        """Manager A gọi API -> chỉ thấy Task A, không thấy Task B."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)

        assert isinstance(results, list)
        assert len(results) == 1
        assert results[0]["id"] == self.task_A.id

        task_ids = [item["id"] for item in results]
        assert self.task_B.id not in task_ids


# ============================================================
# Test 2: Tạo Task
# ============================================================
@pytest.mark.django_db
class TestManagerTaskCreate:
    """
    Kiểm thử tạo Task: chỉ tạo được trong Job của mình,
    và Job đã COMPLETED không được tạo Task mới.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        self.manager = make_manager_with_perms(
            self.role_manager, "task:view", "task:create"
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        self.client_db = baker.make("projects.Client")

        # Job ACTIVE của Manager — deadline phải SAU deadline của Task
        self.job_mine = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job của tôi",
            status="ACTIVE",
            start_date=datetime.date.today(),
            deadline=datetime.date(2027, 12, 31),
        )

        # Job đã COMPLETED của Manager
        self.job_completed = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job đã hoàn thành",
            status="COMPLETED",
        )

        # Job của Manager B (ngoài phạm vi)
        self.job_other = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Job của người khác",
            status="ACTIVE",
        )

        self.url = "/api/manager/tasks/"
        self.valid_payload = {
            "job_id": self.job_mine.id,
            "assignee_id": self.employee.id,
            "title": "Task mới toanh",
            "priority": "MEDIUM",
            "deadline": "2026-12-31",
        }

    def test_can_create_task_on_own_job(self):
        """Manager tạo Task trên Job của mình -> 201 Created."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(self.url, self.valid_payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Task mới toanh"

    def test_cannot_create_task_on_other_manager_job(self):
        """Manager tạo Task trên Job của người khác -> bị từ chối (404/403)."""
        self.client.force_authenticate(user=self.manager)
        payload = {**self.valid_payload, "job_id": self.job_other.id}
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        ]

    def test_cannot_create_task_when_job_is_completed(self):
        """Manager tạo Task trên Job đã COMPLETED -> bị từ chối (400)."""
        self.client.force_authenticate(user=self.manager)
        payload = {**self.valid_payload, "job_id": self.job_completed.id}
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================
# Test 3: Cập nhật Task (update_task service branches)
# ============================================================
@pytest.mark.django_db
class TestManagerTaskUpdate:
    """
    Kiểm thử cập nhật Task và các nhánh kiểm tra dữ liệu của update_task service.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        self.manager = make_manager_with_perms(
            self.role_manager, "task:view", "task:update"
        )
        self.employee_1 = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )
        self.employee_2 = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job để update task",
            start_date=datetime.date.today(),
            deadline=datetime.date(2027, 12, 31),
        )
        self.task = baker.make(
            "tasks.Task",
            job=self.job,
            assignee=self.employee_1,
            creator=self.manager,
            title="Task ban đầu",
            priority="LOW",
            deadline=datetime.date(2026, 6, 30),
        )
        self.url = f"/api/manager/tasks/{self.task.id}/"

    def test_partial_update_task_fields(self):
        """Cập nhật tiêu đề, ưu tiên, mô tả -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        payload = {
            "title": "Task đã đổi tên",
            "priority": "HIGH",
            "description": "Mô tả mới",
        }
        response = self.client.patch(self.url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "Task đã đổi tên"
        assert response.data["priority"] == "HIGH"

    def test_update_task_reassign_employee(self):
        """Đổi assignee sang employee khác -> 200 OK, kích hoạt notification/follower mới."""
        self.client.force_authenticate(user=self.manager)
        payload = {"assignee_id": self.employee_2.id}
        response = self.client.patch(self.url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["assignee"]["id"] == self.employee_2.id


# ============================================================
# Test 4: Chuyển trạng thái Task (State Machine)
# ============================================================
@pytest.mark.django_db
class TestManagerTaskTransition:
    """
    Kiểm thử state machine chuyển trạng thái Task:
    - Approve: REVIEWING -> COMPLETED
    - Reject: phải có reason, REVIEWING -> IN_PROGRESS
    - Không Approve Task đang ở trạng thái sai
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager = make_manager_with_perms(
            self.role_manager, "task:view", "task:review", "task:cancel"
        )
        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job test transition",
        )

        self.task_reviewing = baker.make(
            "tasks.Task",
            job=self.job,
            title="Task đang review",
            status="REVIEWING",
        )

        self.task_todo = baker.make(
            "tasks.Task",
            job=self.job,
            title="Task mới tạo",
            status="TODO",
        )

    def test_approve_task_in_reviewing_status(self):
        """Manager Approve Task đang REVIEWING -> 200 OK, status = COMPLETED."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/tasks/{self.task_reviewing.id}/approve/"
        response = self.client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "COMPLETED"

    def test_reject_task_requires_reason(self):
        """Manager Reject Task mà không có reason -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/tasks/{self.task_reviewing.id}/reject/"
        response = self.client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reject_task_with_reason_succeeds(self):
        """Manager Reject Task với reason hợp lệ -> 200 OK, status = IN_PROGRESS."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/tasks/{self.task_reviewing.id}/reject/"
        response = self.client.post(url, {"reason": "Chưa đạt yêu cầu"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "IN_PROGRESS"

    def test_cannot_approve_task_in_wrong_status(self):
        """Manager Approve Task đang ở TODO -> bị từ chối (400)."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/tasks/{self.task_todo.id}/approve/"
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================
# Test 5: Kanban Move (move_task_kanban service branches)
# ============================================================
@pytest.mark.django_db
class TestManagerTaskKanbanMove:
    """
    Kiểm thử kéo thả Task trên bảng Kanban (cùng cột vs khác cột).
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager = make_manager_with_perms(
            self.role_manager, "task:view", "task:change_status"
        )

        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job Kanban Move",
        )

        self.task_1 = baker.make("tasks.Task", job=self.job, title="Task 1", status="TODO")
        self.task_2 = baker.make("tasks.Task", job=self.job, title="Task 2", status="TODO")

    def test_move_task_same_column_reorder(self):
        """Reorder cùng cột (to_status='TODO') -> 200 OK, chỉ đổi order_index."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/tasks/{self.task_1.id}/move/"
        payload = {
            "to_status": "TODO",
            "prev_task_id": self.task_2.id,
        }
        response = self.client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "TODO"

    def test_move_task_different_column_transition(self):
        """Kéo sang cột mới (TODO -> IN_PROGRESS) -> 200 OK, chuyển status thành công."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/tasks/{self.task_1.id}/move/"
        payload = {
            "to_status": "IN_PROGRESS",
        }
        response = self.client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "IN_PROGRESS"

    def test_move_task_invalid_status_fails(self):
        """Kéo với status không hợp lệ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/tasks/{self.task_1.id}/move/"
        payload = {
            "to_status": "INVALID_STATUS_NAME",
        }
        response = self.client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================
# Test 6: Comment — Manager comment vào Task của mình
# ============================================================
@pytest.mark.django_db
class TestManagerTaskComment:
    """
    Kiểm thử Manager có thể comment vào Task thuộc Job của mình,
    và không thể comment vào Task của người khác.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager_A = make_manager_with_perms(
            self.role_manager, "task:view", "task:comment"
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.client_db = baker.make("projects.Client")

        self.job_A = baker.make(
            "projects.Job",
            manager=self.manager_A,
            client=self.client_db,
            job_name="Job của A",
        )
        self.job_B = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Job của B",
        )

        self.task_A = baker.make("tasks.Task", job=self.job_A, title="Task A")
        self.task_B = baker.make("tasks.Task", job=self.job_B, title="Task B")

    def test_can_comment_on_own_task(self):
        """Manager A comment vào Task trong Job A -> 201 Created."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/tasks/{self.task_A.id}/comments/"
        response = self.client.post(url, {"content": "Nhận xét của tôi"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_cannot_comment_on_other_managers_task(self):
        """Manager A comment vào Task của Job B (của Manager B) -> 404."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/tasks/{self.task_B.id}/comments/"
        response = self.client.post(url, {"content": "Cố tình xâm phạm"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ============================================================
# Test 7: ManagerTaskFilter Edge Cases & Validation Errors
# ============================================================
@pytest.mark.django_db
class TestManagerTaskFilters:
    """
    Kiểm thử 100% độ phủ cho class ManagerTaskFilter.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")
        self.manager = make_manager_with_perms(self.role_manager, "task:view")

        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )
        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job Task Filters",
        )

        import datetime
        self.task_1 = baker.make(
            "tasks.Task",
            job=self.job,
            assignee=self.employee,
            creator=self.manager,
            title="Task 1",
            description="Mô tả task 1",
            status="TODO",
            priority="HIGH",
            deadline=datetime.date.today() + datetime.timedelta(days=5),
        )
        self.task_2 = baker.make(
            "tasks.Task",
            job=self.job,
            assignee=self.employee,
            creator=self.manager,
            title="Task 2",
            status="COMPLETED",
            priority="LOW",
            deadline=datetime.date.today() - datetime.timedelta(days=2),
        )

        self.list_url = "/api/manager/tasks/"

    def test_filter_valid_status_and_status_in(self):
        """Filter status đơn và status__in hợp lệ -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"status": "TODO"})
        assert res.status_code == status.HTTP_200_OK

        res = self.client.get(self.list_url, {"status__in": "TODO,COMPLETED"})
        assert res.status_code == status.HTTP_200_OK

    def test_filter_invalid_status_raises_400(self):
        """Filter status không hợp lệ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"status": "WRONG_STATUS"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_invalid_status_in_raises_400(self):
        """Filter status__in chứa giá trị không hợp lệ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"status__in": "TODO,WRONG_STATUS"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_valid_priority_and_priority_in(self):
        """Filter priority đơn và priority__in hợp lệ -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"priority": "HIGH"})
        assert res.status_code == status.HTTP_200_OK

        res = self.client.get(self.list_url, {"priority__in": "HIGH,LOW"})
        assert res.status_code == status.HTTP_200_OK

    def test_filter_invalid_priority_raises_400(self):
        """Filter priority không hợp lệ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"priority": "WRONG_PRIORITY"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_invalid_priority_in_raises_400(self):
        """Filter priority__in không hợp lệ -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"priority__in": "HIGH,WRONG_PRIORITY"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_invalid_job_id_raises_400(self):
        """Filter job_id không phải số nguyên -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"job_id": "abc"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_valid_job_id(self):
        """Filter job_id hợp lệ -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"job_id": self.job.id})
        assert res.status_code == status.HTTP_200_OK

    def test_filter_invalid_assignee_id_raises_400(self):
        """Filter assignee_id không phải số nguyên -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"assignee_id": "abc"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_valid_assignee_id(self):
        """Filter assignee_id hợp lệ -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"assignee_id": self.employee.id})
        assert res.status_code == status.HTTP_200_OK

    def test_filter_invalid_deadline_from_format_raises_400(self):
        """Filter deadline_from sai định dạng -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"deadline_from": "invalid_date"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_invalid_deadline_to_format_raises_400(self):
        """Filter deadline_to sai định dạng -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"deadline_to": "invalid_date"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_valid_deadline_range(self):
        """Filter deadline_from/to hợp lệ -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {
            "deadline_from": "2020-01-01",
            "deadline_to": "2030-12-31",
        })
        assert res.status_code == status.HTTP_200_OK

    def test_filter_is_overdue(self):
        """Filter is_overdue=true / false / 1 / 0 / invalid -> 200/400."""
        self.client.force_authenticate(user=self.manager)
        res_true = self.client.get(self.list_url, {"is_overdue": "true"})
        assert res_true.status_code == status.HTTP_200_OK

        res_false = self.client.get(self.list_url, {"is_overdue": "0"})
        assert res_false.status_code == status.HTTP_200_OK

        res_invalid = self.client.get(self.list_url, {"is_overdue": "invalid"})
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_search(self):
        """Filter search theo title hoặc description -> 200 OK."""
        self.client.force_authenticate(user=self.manager)
        res = self.client.get(self.list_url, {"search": "Task 1"})
        assert res.status_code == status.HTTP_200_OK

        res_empty = self.client.get(self.list_url, {"search": "   "})
        assert res_empty.status_code == status.HTTP_200_OK

    def test_filter_ordering(self):
        """Ordering hợp lệ & không hợp lệ."""
        self.client.force_authenticate(user=self.manager)
        res_valid = self.client.get(self.list_url, {"ordering": "-priority"})
        assert res_valid.status_code == status.HTTP_200_OK

        res_invalid = self.client.get(self.list_url, {"ordering": "invalid_field"})
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST

