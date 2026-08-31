import pytest
from model_bakery import baker

from system.security.scoping_manager import employee_job_ids


@pytest.mark.django_db
class TestEmployeeJobIds:

    def test_returns_distinct_job_ids_for_employee_tasks(self):
        role = baker.make("accounts.Role", code="EMPLOYEE")
        employee = baker.make("accounts.CustomUser", role=role, is_active=True)
        job_a = baker.make("projects.Job")
        job_b = baker.make("projects.Job")

        # 2 task trong job_a (phải chỉ trả về 1 job_id, không trùng lặp)
        baker.make("tasks.Task", assignee=employee, job=job_a)
        baker.make("tasks.Task", assignee=employee, job=job_a)
        # 1 task trong job_b
        baker.make("tasks.Task", assignee=employee, job=job_b)

        result = set(employee_job_ids(employee))

        assert result == {job_a.id, job_b.id}

    def test_ignores_tasks_assigned_to_other_users(self):
        role = baker.make("accounts.Role", code="EMPLOYEE")
        employee = baker.make("accounts.CustomUser", role=role, is_active=True)
        other_employee = baker.make("accounts.CustomUser", role=role, is_active=True)
        job = baker.make("projects.Job")

        baker.make("tasks.Task", assignee=other_employee, job=job)

        result = set(employee_job_ids(employee))

        assert result == set()

    def test_returns_empty_for_non_employee_role(self):
        manager_role = baker.make("accounts.Role", code="MANAGER")
        manager = baker.make("accounts.CustomUser", role=manager_role, is_active=True)
        job = baker.make("projects.Job", manager=manager)
        baker.make("tasks.Task", assignee=manager, job=job)

        result = set(employee_job_ids(manager))

        assert result == set()
