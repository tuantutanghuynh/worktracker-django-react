import pytest
from decimal import Decimal
from datetime import date

from model_bakery import baker
from rest_framework.test import APIClient
from accounts.models import Permission

from timesheets.models import DailyUserTimesheet

# Kiểm tra hành vi của EmployeeLogWorkSerializer.create() sau khi gộp
# get_or_create() + select_for_update() thành 1 dòng (xem FR-21) — không
# test race condition thật (cần threading + Postgres, để dành dịp khác),
# chỉ xác nhận DailyUserTimesheet được tạo/cộng dồn đúng ở cả 2 nhánh:
# chưa có row (created) và đã có row (found + lock).


def make_employee_with_task():
    """Tạo 1 Employee có quyền timesheet:create và 1 Task được giao cho họ."""
    role = baker.make("accounts.Role", code="EMPLOYEE")
    perm, _ = Permission.objects.get_or_create(
        code="timesheet:create", defaults={"name": "timesheet:create"}
    )
    baker.make("accounts.RolePermission", role=role, permission=perm)

    employee = baker.make(
        "accounts.CustomUser",
        role=role,
        is_active=True,
        must_change_password=False,  # tránh bug fixture must_change_password đã báo team
    )
    task = baker.make("tasks.Task", assignee=employee)
    return employee, task


@pytest.mark.django_db
class TestEmployeeLogWorkDailyTotal:

    def setup_method(self):
        self.client = APIClient()
        self.employee, self.task = make_employee_with_task()
        self.client.force_authenticate(user=self.employee)
        self.work_date = date(2026, 3, 10)

    # Nhánh CHƯA có DailyUserTimesheet cho ngày đó — get_or_create() phải tạo mới.
    def test_first_log_creates_daily_timesheet_with_correct_total(self):
        response = self.client.post("/api/timesheets/log-works/", {
            "task": self.task.id,
            "work_date": self.work_date,
            "hours_spent": 5,
            "description": "Log đầu tiên trong ngày",
        }, format="json")

        assert response.status_code == 201
        timesheet = DailyUserTimesheet.objects.get(
            user=self.employee, work_date=self.work_date
        )
        assert timesheet.total_hours == Decimal("5")

    # Nhánh ĐÃ có DailyUserTimesheet — get_or_create() phải get() + lock đúng row
    # có sẵn, rồi cộng dồn total_hours thay vì tạo trùng.
    def test_second_log_same_day_accumulates_total(self):
        self.client.post("/api/timesheets/log-works/", {
            "task": self.task.id,
            "work_date": self.work_date,
            "hours_spent": 5,
            "description": "Log đầu tiên",
        }, format="json")

        response = self.client.post("/api/timesheets/log-works/", {
            "task": self.task.id,
            "work_date": self.work_date,
            "hours_spent": 3,
            "description": "Log thứ hai cùng ngày",
        }, format="json")

        assert response.status_code == 201
        timesheet = DailyUserTimesheet.objects.get(
            user=self.employee, work_date=self.work_date
        )
        assert timesheet.total_hours == Decimal("8")

        # Vẫn phải đúng 1 row duy nhất cho (user, work_date) — không bị tạo trùng.
        assert DailyUserTimesheet.objects.filter(
            user=self.employee, work_date=self.work_date
        ).count() == 1

    # Cap 24h vẫn phải hoạt động đúng sau khi gộp query — hồi quy quan trọng nhất.
    def test_exceeding_24h_cap_still_rejected(self):
        self.client.post("/api/timesheets/log-works/", {
            "task": self.task.id,
            "work_date": self.work_date,
            "hours_spent": 20,
            "description": "Log gần đầy ngày",
        }, format="json")

        response = self.client.post("/api/timesheets/log-works/", {
            "task": self.task.id,
            "work_date": self.work_date,
            "hours_spent": 5,
            "description": "Log vượt 24h",
        }, format="json")

        assert response.status_code == 400
        timesheet = DailyUserTimesheet.objects.get(
            user=self.employee, work_date=self.work_date
        )
        assert timesheet.total_hours == Decimal("20")  # không bị cộng thêm 5h vượt cap
