import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import axiosClient
from model_bakery import baker
from accounts.models import Permission
from system.security.permissions_manager import MANAGER_ROLE_CODE


def get_results(response_data):
    if isinstance(response_data, list):
        return response_data
    return response_data.get("results", response_data)


def make_manager_with_perms(role, *permission_codes):
    """Tạo Manager và cấp quyền cho role."""
    user = baker.make("accounts.CustomUser", role=role, is_active=True)
    for code in permission_codes:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        baker.make("accounts.RolePermission", role=role, permission=perm)
    return user


# ============================================================
# Test 1: TimeLock CRUD — List, Create
# ============================================================
@pytest.mark.django_db
class TestManagerTimeLockCRUD:
    """
    Kiểm thử CRUD TimeLock của Manager.
    Manager chỉ được tạo/xem TimeLock cho Job do mình quản lý.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager_A = make_manager_with_perms(
            self.role_manager, "timelock:view", "timelock:lock"
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.client_db = baker.make("projects.Client")

        self.job_A = baker.make(
            "projects.Job",
            manager=self.manager_A,
            client=self.client_db,
            job_name="Job A",
        )
        self.job_B = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Job B",
        )

        # TimeLock thuộc Job A (của Manager A)
        self.timelock_A = baker.make(
            "timesheets.TimeLock",
            job=self.job_A,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager_A,
            is_locked=True,
        )

        # TimeLock thuộc Job B (của Manager B)
        self.timelock_B = baker.make(
            "timesheets.TimeLock",
            job=self.job_B,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager_B,
            is_locked=True,
        )

        self.list_url = "/api/manager/time-locks/"

    def test_list_own_timelocks_only(self):
        """Manager A chỉ thấy TimeLock của Job A, không thấy của Job B."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.get(self.list_url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        lock_ids = [item["id"] for item in results]

        assert self.timelock_A.id in lock_ids
        assert self.timelock_B.id not in lock_ids

    def test_create_timelock_for_own_job(self):
        """Manager A tạo TimeLock mới cho Job A -> 201 Created."""
        self.client.force_authenticate(user=self.manager_A)
        payload = {
            "job_id": self.job_A.id,
            "lock_month": 7,
            "lock_year": 2026,
            "reason": "Đóng sổ tháng 7",
        }
        response = self.client.post(self.list_url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["lock_month"] == 7

    def test_cannot_create_timelock_for_other_job(self):
        """Manager A tạo TimeLock cho Job B -> bị từ chối (404)."""
        self.client.force_authenticate(user=self.manager_A)
        payload = {
            "job_id": self.job_B.id,
            "lock_month": 8,
            "lock_year": 2026,
            "reason": "Cố tình khóa job người khác",
        }
        response = self.client.post(self.list_url, payload, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ============================================================
# Test 2: Mở khóa TimeLock
# ============================================================
@pytest.mark.django_db
class TestManagerTimeLockUnlock:
    """
    Kiểm thử Manager mở khóa TimeLock.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.manager_A = make_manager_with_perms(
            self.role_manager, "timelock:view", "timelock:lock", "timelock:unlock"
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.client_db = baker.make("projects.Client")

        self.job_A = baker.make(
            "projects.Job",
            manager=self.manager_A,
            client=self.client_db,
            job_name="Job A",
        )
        self.job_B = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Job B",
        )

        self.timelock_A = baker.make(
            "timesheets.TimeLock",
            job=self.job_A,
            lock_scope="JOB",
            lock_month=5,
            lock_year=2026,
            locked_by=self.manager_A,
            is_locked=True,
        )
        self.timelock_B = baker.make(
            "timesheets.TimeLock",
            job=self.job_B,
            lock_scope="JOB",
            lock_month=5,
            lock_year=2026,
            locked_by=self.manager_B,
            is_locked=True,
        )

    def test_unlock_own_timelock(self):
        """Manager A mở khóa TimeLock của Job A -> 200 OK, is_locked=False."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/time-locks/{self.timelock_A.id}/unlock/"
        response = self.client.post(url, {"reason": "Cần chỉnh sửa timesheet"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_locked"] is False

    def test_cannot_unlock_other_managers_timelock(self):
        """Manager A mở khóa TimeLock của Job B (của Manager B) -> 404."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/time-locks/{self.timelock_B.id}/unlock/"
        response = self.client.post(url, {"reason": "Cố tình mở khóa"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ============================================================
# Test 3: LogWork — Xem, Approve, Reject, Correct, Void LogWork
# ============================================================
@pytest.mark.django_db
class TestManagerLogWork:
    """
    Kiểm thử Manager xem, duyệt, từ chối, điều chỉnh và hủy bỏ LogWork của nhân viên.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        self.manager_A = make_manager_with_perms(
            self.role_manager,
            "timesheet:view",
            "timesheet:review",
            "timesheet:correct",
            "timesheet:void",
        )
        self.manager_B = baker.make(
            "accounts.CustomUser", role=self.role_manager, is_active=True
        )
        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        self.client_db = baker.make("projects.Client")

        self.job_A = baker.make(
            "projects.Job",
            manager=self.manager_A,
            client=self.client_db,
            job_name="Job A",
        )
        self.job_B = baker.make(
            "projects.Job",
            manager=self.manager_B,
            client=self.client_db,
            job_name="Job B",
        )

        import datetime
        self.task_A = baker.make("tasks.Task", job=self.job_A, title="Task trong Job A")
        self.task_B = baker.make("tasks.Task", job=self.job_B, title="Task trong Job B")

        # LogWork của Employee trên Task A (thuộc Job A của Manager A)
        self.logwork_A = baker.make(
            "timesheets.LogWork",
            task=self.task_A,
            user=self.employee,
            work_date=datetime.date.today(),
            hours_spent="8.00",
            review_status="PENDING",
        )

        # LogWork của Employee trên Task B (thuộc Job B của Manager B)
        self.logwork_B = baker.make(
            "timesheets.LogWork",
            task=self.task_B,
            user=self.employee,
            work_date=datetime.date.today(),
            hours_spent="4.00",
            review_status="PENDING",
        )

        self.list_url = "/api/manager/log-works/"

    def test_list_logworks_scoped_to_own_jobs(self):
        """Manager A chỉ thấy LogWork thuộc Job A, không thấy LogWork của Job B."""
        self.client.force_authenticate(user=self.manager_A)
        response = self.client.get(self.list_url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        logwork_ids = [item["id"] for item in results]

        assert self.logwork_A.id in logwork_ids
        assert self.logwork_B.id not in logwork_ids

    def test_approve_logwork(self):
        """Manager A approve LogWork A (PENDING) -> 200 OK, review_status=APPROVED."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/log-works/{self.logwork_A.id}/approve/"
        response = self.client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["review_status"] == "APPROVED"

    def test_reject_logwork_with_reason(self):
        """Manager A reject LogWork A có lý do -> 200 OK, review_status=REJECTED."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/log-works/{self.logwork_A.id}/reject/"
        payload = {"reason": "Số giờ nhập không chính xác"}
        response = self.client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["review_status"] == "REJECTED"

    def test_reject_logwork_without_reason_fails(self):
        """Manager A reject LogWork A thiếu lý do -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/log-works/{self.logwork_A.id}/reject/"
        response = self.client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_correct_logwork(self):
        """Manager A điều chỉnh (correct) giờ làm của LogWork A -> 200 OK."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/log-works/{self.logwork_A.id}/correct/"
        payload = {
            "hours_spent": "6.50",
            "description": "Đã điều chỉnh lại giờ làm",
            "adjustment_reason": "Nhập thừa 1.5 giờ"
        }
        response = self.client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["hours_spent"] == "6.50"

    def test_void_logwork(self):
        """Manager A hủy bỏ (void) LogWork A -> 200 OK, review_status=VOIDED."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/log-works/{self.logwork_A.id}/void/"
        payload = {"reason": "Bản ghi nhập nhầm công việc"}
        response = self.client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["review_status"] == "VOIDED"

    def test_cannot_approve_other_manager_logwork(self):
        """Manager A cố approve LogWork B của Manager B -> 404 Not Found."""
        self.client.force_authenticate(user=self.manager_A)
        url = f"/api/manager/log-works/{self.logwork_B.id}/approve/"
        response = self.client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ============================================================
# Test 4: ManagerLogWorkFilter & ManagerTimeLockFilter Coverage
# ============================================================
@pytest.mark.django_db
class TestManagerTimesheetFilters:
    """
    Kiểm thử 100% độ phủ cho các class Filter trong app timesheets.
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")
        self.manager = make_manager_with_perms(
            self.role_manager, "timesheet:view", "timelock:view"
        )
        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job Timesheet Filters",
        )
        self.task = baker.make("tasks.Task", job=self.job, title="Task Timesheet Filter")

        import datetime
        self.logwork = baker.make(
            "timesheets.LogWork",
            task=self.task,
            user=self.employee,
            work_date=datetime.date.today(),
            hours_spent="5.00",
            description="Mô tả công việc filter",
            review_status="PENDING",
        )
        self.timelock = baker.make(
            "timesheets.TimeLock",
            job=self.job,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager,
            is_locked=True,
        )

        self.logwork_url = "/api/manager/log-works/"
        self.timelock_url = "/api/manager/time-locks/"

    def test_logwork_filter_valid_and_invalid_review_status(self):
        """LogWork filter review_status hợp lệ & không hợp lệ."""
        self.client.force_authenticate(user=self.manager)
        res_valid = self.client.get(self.logwork_url, {"review_status": "PENDING"})
        assert res_valid.status_code == status.HTTP_200_OK

        res_in_valid = self.client.get(self.logwork_url, {"review_status__in": "PENDING,APPROVED"})
        assert res_in_valid.status_code == status.HTTP_200_OK

        res_invalid = self.client.get(self.logwork_url, {"review_status": "WRONG_STATUS"})
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST

        res_in_invalid = self.client.get(self.logwork_url, {"review_status__in": "PENDING,WRONG"})
        assert res_in_invalid.status_code == status.HTTP_400_BAD_REQUEST

    def test_logwork_filter_integer_params(self):
        """LogWork filter job_id, task_id, user_id hợp lệ & không phải chữ số."""
        self.client.force_authenticate(user=self.manager)
        res_valid = self.client.get(self.logwork_url, {
            "job_id": self.job.id,
            "task_id": self.task.id,
            "user_id": self.employee.id,
        })
        assert res_valid.status_code == status.HTTP_200_OK

        res_invalid = self.client.get(self.logwork_url, {"job_id": "abc"})
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST

    def test_logwork_filter_work_date_range(self):
        """LogWork filter work_date_from/to hợp lệ & sai định dạng."""
        self.client.force_authenticate(user=self.manager)
        res_valid = self.client.get(self.logwork_url, {
            "work_date_from": "2020-01-01",
            "work_date_to": "2030-12-31",
        })
        assert res_valid.status_code == status.HTTP_200_OK

        res_invalid_from = self.client.get(self.logwork_url, {"work_date_from": "invalid_date"})
        assert res_invalid_from.status_code == status.HTTP_400_BAD_REQUEST

        res_invalid_to = self.client.get(self.logwork_url, {"work_date_to": "invalid_date"})
        assert res_invalid_to.status_code == status.HTTP_400_BAD_REQUEST

    def test_logwork_filter_search_and_ordering(self):
        """LogWork filter search & ordering."""
        self.client.force_authenticate(user=self.manager)
        res_search = self.client.get(self.logwork_url, {"search": "filter"})
        assert res_search.status_code == status.HTTP_200_OK

        res_empty = self.client.get(self.logwork_url, {"search": "   "})
        assert res_empty.status_code == status.HTTP_200_OK

        res_order_valid = self.client.get(self.logwork_url, {"ordering": "-hours_spent"})
        assert res_order_valid.status_code == status.HTTP_200_OK

        res_order_invalid = self.client.get(self.logwork_url, {"ordering": "invalid_col"})
        assert res_order_invalid.status_code == status.HTTP_400_BAD_REQUEST

    def test_timelock_filter_month_year(self):
        """TimeLock filter month, year hợp lệ & month không nằm trong 1-12."""
        self.client.force_authenticate(user=self.manager)
        res_valid = self.client.get(self.timelock_url, {"lock_month": 6, "lock_year": 2026})
        assert res_valid.status_code == status.HTTP_200_OK

        res_invalid_month = self.client.get(self.timelock_url, {"lock_month": 15})
        assert res_invalid_month.status_code == status.HTTP_400_BAD_REQUEST

    def test_timelock_filter_is_locked_and_scope(self):
        """TimeLock filter is_locked & lock_scope."""
        self.client.force_authenticate(user=self.manager)
        res_locked_true = self.client.get(self.timelock_url, {"is_locked": "true"})
        assert res_locked_true.status_code == status.HTTP_200_OK

        res_locked_false = self.client.get(self.timelock_url, {"is_locked": "0"})
        assert res_locked_false.status_code == status.HTTP_200_OK

        res_locked_invalid = self.client.get(self.timelock_url, {"is_locked": "maybe"})
        assert res_locked_invalid.status_code == status.HTTP_400_BAD_REQUEST

        res_scope_valid = self.client.get(self.timelock_url, {"lock_scope": "JOB"})
        assert res_scope_valid.status_code == status.HTTP_200_OK

        res_scope_invalid = self.client.get(self.timelock_url, {"lock_scope": "WRONG_SCOPE"})
        assert res_scope_invalid.status_code == status.HTTP_400_BAD_REQUEST

    def test_timelock_filter_ordering(self):
        """TimeLock ordering hợp lệ & không hợp lệ."""
        self.client.force_authenticate(user=self.manager)
        res_valid = self.client.get(self.timelock_url, {"ordering": "-lock_month"})
        assert res_valid.status_code == status.HTTP_200_OK

        res_invalid = self.client.get(self.timelock_url, {"ordering": "invalid_field"})
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================
# Test 5: TimeLock Service Edge Cases & Locked Period Checks
# ============================================================
@pytest.mark.django_db
class TestTimeLockServiceEdgeCases:
    """
    Kiểm thử 100% độ phủ cho timelock_manager_service.py
    """

    def setup_method(self):
        cache.clear()
        self.client = axiosClient()

        self.role_manager = baker.make("accounts.Role", code=MANAGER_ROLE_CODE)
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")
        self.manager = make_manager_with_perms(
            self.role_manager, "timelock:view", "timelock:lock", "timelock:unlock", "timesheet:review"
        )
        self.employee = baker.make(
            "accounts.CustomUser", role=self.role_employee, is_active=True
        )

        self.client_db = baker.make("projects.Client")
        self.job = baker.make(
            "projects.Job",
            manager=self.manager,
            client=self.client_db,
            job_name="Job TimeLock Service",
        )
        self.task = baker.make("tasks.Task", job=self.job, title="Task Service")

        import datetime
        self.work_date = datetime.date(2026, 6, 15)
        self.logwork = baker.make(
            "timesheets.LogWork",
            task=self.task,
            user=self.employee,
            work_date=self.work_date,
            hours_spent="4.00",
            review_status="PENDING",
        )

        self.timelock_url = "/api/manager/time-locks/"

    def test_lock_already_locked_period_fails(self):
        """Tạo khóa cho kỳ đã bị khóa -> 400 Bad Request."""
        baker.make(
            "timesheets.TimeLock",
            job=self.job,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager,
            is_locked=True,
        )
        self.client.force_authenticate(user=self.manager)
        payload = {
            "job_id": self.job.id,
            "lock_month": 6,
            "lock_year": 2026,
            "reason": "Khóa lại",
        }
        res = self.client.post(self.timelock_url, payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_lock_previously_unlocked_period_relocks(self):
        """Khóa lại kỳ đã từng được mở khóa -> 201 Created/200 OK, is_locked=True."""
        unlocked = baker.make(
            "timesheets.TimeLock",
            job=self.job,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager,
            is_locked=False,
        )
        self.client.force_authenticate(user=self.manager)
        payload = {
            "job_id": self.job.id,
            "lock_month": 6,
            "lock_year": 2026,
            "reason": "Tái khóa",
        }
        res = self.client.post(self.timelock_url, payload, format="json")
        assert res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
        unlocked.refresh_from_db()
        assert unlocked.is_locked is True

    def test_unlock_already_unlocked_period_fails(self):
        """Mở khóa cho kỳ đã mở sẵn -> 400 Bad Request."""
        unlocked = baker.make(
            "timesheets.TimeLock",
            job=self.job,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager,
            is_locked=False,
        )
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/time-locks/{unlocked.id}/unlock/"
        res = self.client.post(url, {"reason": "Mở lần nữa"}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_unlock_without_reason_fails(self):
        """Mở khóa thiếu reason -> 400 Bad Request."""
        locked = baker.make(
            "timesheets.TimeLock",
            job=self.job,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager,
            is_locked=True,
        )
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/time-locks/{locked.id}/unlock/"
        res = self.client.post(url, {"reason": "   "}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_lock_invalid_month_year_raises_400(self):
        """Khóa với tháng > 12 hoặc năm < 2000 -> 400 Bad Request."""
        self.client.force_authenticate(user=self.manager)
        res_month = self.client.post(self.timelock_url, {
            "job_id": self.job.id,
            "lock_month": 13,
            "lock_year": 2026,
        }, format="json")
        assert res_month.status_code == status.HTTP_400_BAD_REQUEST

        res_year = self.client.post(self.timelock_url, {
            "job_id": self.job.id,
            "lock_month": 6,
            "lock_year": 1999,
        }, format="json")
        assert res_year.status_code == status.HTTP_400_BAD_REQUEST

    def test_action_on_locked_period_fails(self):
        """Thao tác approve logwork khi kỳ công bị JOB lock -> 400 Bad Request."""
        baker.make(
            "timesheets.TimeLock",
            job=self.job,
            lock_scope="JOB",
            lock_month=6,
            lock_year=2026,
            locked_by=self.manager,
            is_locked=True,
        )
        self.client.force_authenticate(user=self.manager)
        url = f"/api/manager/log-works/{self.logwork.id}/approve/"
        res = self.client.post(url, {}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST


