import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import Permission, Role, RolePermission


def make_employee(role_code="EMPLOYEE", permission_codes=None):
    role = Role.objects.get_or_create(code=role_code, defaults={"name": role_code})[0]
    for code in permission_codes or []:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=role, permission=perm)
    return baker.make(
        "accounts.CustomUser",
        role=role,
        is_active=True,
        must_change_password=False,
    )


@pytest.mark.django_db
class TestEmployeeMyTeamView:

    def setup_method(self):
        self.client = APIClient()

    def test_lists_only_jobs_the_employee_has_tasks_in(self):
        me = make_employee(permission_codes=["job:view"])
        manager = make_employee(role_code="MANAGER")
        job_mine = baker.make("projects.Job", manager=manager, job_name="Mine")
        job_other = baker.make("projects.Job", manager=manager, job_name="Not mine")
        baker.make("tasks.Task", assignee=me, job=job_mine)

        other_employee = make_employee()
        baker.make("tasks.Task", assignee=other_employee, job=job_other)

        self.client.force_authenticate(user=me)
        response = self.client.get("/api/employee/team/")

        assert response.status_code == 200
        job_names = [row["job_name"] for row in response.data]
        assert job_names == ["Mine"]

    def test_teammates_include_self_marked_is_me_and_exclude_workload_fields(self):
        me = make_employee(permission_codes=["job:view"])
        colleague = make_employee()
        manager = make_employee(role_code="MANAGER")
        job = baker.make("projects.Job", manager=manager)
        baker.make("tasks.Task", assignee=me, job=job)
        baker.make("tasks.Task", assignee=colleague, job=job)

        self.client.force_authenticate(user=me)
        response = self.client.get("/api/employee/team/")

        assert response.status_code == 200
        teammates = response.data[0]["teammates"]
        ids_and_is_me = {row["id"]: row["is_me"] for row in teammates}
        assert ids_and_is_me == {me.id: True, colleague.id: False}

        # Không lộ field workload nào trong response
        for row in teammates:
            assert "logged_hours" not in row
            assert "utilization_rate" not in row
            assert "capacity_hours" not in row

    def test_duplicate_tasks_same_colleague_same_job_appear_once(self):
        me = make_employee(permission_codes=["job:view"])
        colleague = make_employee()
        manager = make_employee(role_code="MANAGER")
        job = baker.make("projects.Job", manager=manager)
        baker.make("tasks.Task", assignee=me, job=job)
        baker.make("tasks.Task", assignee=colleague, job=job)
        baker.make("tasks.Task", assignee=colleague, job=job)  # task thứ 2 của colleague, cùng job

        self.client.force_authenticate(user=me)
        response = self.client.get("/api/employee/team/")

        teammate_ids = [row["id"] for row in response.data[0]["teammates"]]
        assert teammate_ids.count(colleague.id) == 1

    def test_employee_with_no_tasks_gets_empty_list(self):
        me = make_employee(permission_codes=["job:view"])

        self.client.force_authenticate(user=me)
        response = self.client.get("/api/employee/team/")

        assert response.status_code == 200
        assert response.data == []

    def test_requires_job_view_permission(self):
        me = make_employee(permission_codes=[])  # không cấp job:view

        self.client.force_authenticate(user=me)
        response = self.client.get("/api/employee/team/")

        assert response.status_code == 403

    def test_bulk_query_does_not_scale_with_team_size(self):
        me = make_employee(permission_codes=["job:view"])
        manager = make_employee(role_code="MANAGER")
        job = baker.make("projects.Job", manager=manager)
        baker.make("tasks.Task", assignee=me, job=job)
        for _ in range(5):
            colleague = make_employee()
            baker.make("tasks.Task", assignee=colleague, job=job)

        self.client.force_authenticate(user=me)

        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/employee/team/")

        assert response.status_code == 200
        # 3 query cố định cho job+teammate+task-progress data (jobs,
        # teammate-rows, status-count aggregation) + các query phụ của
        # auth/permission middleware — chặn trần cao để không quá giòn
        # (fragile), nhưng vẫn đủ để bắt hồi quy N+1 rõ ràng (vd. nếu ai
        # đó lỡ query teammate/progress riêng cho từng job trong vòng lặp).
        assert len(ctx.captured_queries) < 15

    def test_task_progress_counts_whole_team_not_just_caller(self):
        me = make_employee(permission_codes=["job:view"])
        colleague = make_employee()
        manager = make_employee(role_code="MANAGER")
        job = baker.make("projects.Job", manager=manager)

        baker.make("tasks.Task", assignee=me, job=job, status="COMPLETED")
        baker.make("tasks.Task", assignee=colleague, job=job, status="COMPLETED")
        baker.make("tasks.Task", assignee=colleague, job=job, status="IN_PROGRESS")
        baker.make("tasks.Task", assignee=colleague, job=job, status="TODO")
        baker.make("tasks.Task", assignee=colleague, job=job, status="CANCELLED")

        self.client.force_authenticate(user=me)
        response = self.client.get("/api/employee/team/")

        progress = response.data[0]["task_progress"]
        assert progress == {
            "total": 5,
            "completed": 2,
            "in_progress": 1,
            "reviewing": 0,
            "todo": 1,
            "cancelled": 1,
            "pct": 40,  # 2/5 = 40%, tính cả CANCELLED trong total (khớp ManagerJobDetailPage)
        }

    def test_task_progress_pct_is_zero_not_a_divide_by_zero_error(self):
        # Job trong danh sách employee_job_ids() luôn có ít nhất 1 task
        # (đó là điều kiện lọt vào danh sách), nên total=0 không xảy ra
        # qua API thật — nhưng công thức pct = completed/total vẫn phải
        # tự bảo vệ khỏi ZeroDivisionError nếu context thiếu dữ liệu cho
        # job đó (context.get(...) trả về {} rỗng). Gọi thẳng serializer
        # method để khoá chặt đúng nhánh này.
        from projects.employee.serializers_employee import EmployeeMyTeamJobSerializer

        manager = make_employee(role_code="MANAGER")
        job = baker.make("projects.Job", manager=manager)
        serializer = EmployeeMyTeamJobSerializer(context={"task_stats_by_job": {}})

        progress = serializer.get_task_progress(job)

        assert progress == {
            "total": 0, "completed": 0, "in_progress": 0,
            "reviewing": 0, "todo": 0, "cancelled": 0, "pct": 0,
        }
