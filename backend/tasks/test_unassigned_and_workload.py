"""
Module: tasks.test_unassigned_and_workload
Description: TDD tests verifying unassigned task serialization, planning job workload count, and project team integrity.
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model

from accounts.models import Role, EmployeeProfile
from projects.models import Client, Job
from tasks.models import Task
from tasks.manager.serializers_manager import ManagerTaskListSerializer, ManagerTaskDetailSerializer
from timesheets.services.manager_employee_utilization_service import calculate_smart_workload_pressure
from projects.manager.serializers_manager import ManagerJobDetailSerializer

User = get_user_model()


@pytest.fixture
def test_setup(db):
    """Setup test manager, employee, client, and job."""
    manager_role, _ = Role.objects.get_or_create(code="MANAGER", defaults={"name": "Manager"})
    employee_role, _ = Role.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Employee"})

    manager = User.objects.create_user(
        email="mgr_test@worktracker.vn",
        password="Password123!",
        role=manager_role,
    )
    EmployeeProfile.objects.create(user=manager, full_name="Manager One")

    employee = User.objects.create_user(
        email="emp_test@worktracker.vn",
        password="Password123!",
        role=employee_role,
    )
    EmployeeProfile.objects.create(user=employee, full_name="Employee One", manager=manager)

    client = Client.objects.create(
        client_name="Test Client Corp",
        tax_code="TAX-998877",
        is_active=True,
    )

    today = timezone.localdate()
    job_planning = Job.objects.create(
        client=client,
        manager=manager,
        job_code="JOB-PLAN-1",
        job_name="Planning Phase Project",
        status=Job.Status.PLANNING,
        start_date=today,
        deadline=today + timedelta(days=30),
    )

    return {
        "manager": manager,
        "employee": employee,
        "client": client,
        "job_planning": job_planning,
    }


@pytest.mark.django_db
def test_unassigned_task_serialization_returns_none_or_unassigned(test_setup):
    """Task assigned to manager (unassigned) should serialize assignee as None in manager serializers."""
    manager = test_setup["manager"]
    job = test_setup["job_planning"]
    today = timezone.localdate()

    # Task created without employee -> assignee is set to manager
    task_unassigned = Task.objects.create(
        job=job,
        assignee=manager,
        creator=manager,
        title="Unassigned Architecture Draft",
        deadline=today + timedelta(days=7),
        order_index="a0",
    )

    serializer_list = ManagerTaskListSerializer(task_unassigned)
    assert serializer_list.data["assignee"] is None, "Unassigned task must have assignee=None in ManagerTaskListSerializer"

    serializer_detail = ManagerTaskDetailSerializer(task_unassigned)
    assert serializer_detail.data["assignee"] is None, "Unassigned task must have assignee=None in ManagerTaskDetailSerializer"


@pytest.mark.django_db
def test_employee_workload_counts_planning_and_active_jobs(test_setup):
    """Smart workload pressure service must count jobs in both PLANNING and ACTIVE status."""
    employee = test_setup["employee"]
    manager = test_setup["manager"]
    job_planning = test_setup["job_planning"]
    today = timezone.localdate()

    # Create task in PLANNING job assigned to employee
    Task.objects.create(
        job=job_planning,
        assignee=employee,
        creator=manager,
        title="Planning Module Task",
        status=Task.Status.TODO,
        priority=Task.Priority.HIGH,
        deadline=today + timedelta(days=5),
        order_index="a0",
    )

    metrics = calculate_smart_workload_pressure(employee)
    assert metrics["active_jobs_count"] == 1, f"Expected 1 active job for planning project, got {metrics['active_jobs_count']}"
    assert metrics["active_tasks_count"] == 1
    assert metrics["daily_required_hours"] > 0
    assert metrics["capacity_pct"] > 0


@pytest.mark.django_db
def test_employee_workload_counts_jobs_from_project_team_even_with_zero_tasks(test_setup):
    """Smart workload service must count PLANNING, ACTIVE, and ON_HOLD jobs from project team even when employee has 0 tasks."""
    from chat.models import ChatRoom, ChatParticipant

    employee = test_setup["employee"]
    manager = test_setup["manager"]
    client = test_setup["client"]
    today = timezone.localdate()

    # Create 5 distinct jobs:
    # 1. Job Planning (already created in test_setup, add employee to chat/team)
    job_planning = test_setup["job_planning"]
    room_planning = ChatRoom.objects.create(name="Planning Room", room_type="JOB", job=job_planning)
    ChatParticipant.objects.create(room=room_planning, user=employee)

    # 2. Job Active (add employee to chat/team, NO tasks assigned)
    job_active = Job.objects.create(
        client=client,
        manager=manager,
        job_code="JOB-ACT-1",
        job_name="Active Project Team Only",
        status=Job.Status.ACTIVE,
        start_date=today,
        deadline=today + timedelta(days=30),
    )
    room_active = ChatRoom.objects.create(name="Active Room", room_type="JOB", job=job_active)
    ChatParticipant.objects.create(room=room_active, user=employee)

    # 3. Job On Hold (add employee to chat/team, NO tasks assigned)
    job_on_hold = Job.objects.create(
        client=client,
        manager=manager,
        job_code="JOB-HOLD-1",
        job_name="On Hold Project Team",
        status=Job.Status.ON_HOLD,
        start_date=today,
        deadline=today + timedelta(days=30),
    )
    room_hold = ChatRoom.objects.create(name="Hold Room", room_type="JOB", job=job_on_hold)
    ChatParticipant.objects.create(room=room_hold, user=employee)

    # 4. Job Completed (should NOT be counted in active jobs)
    job_completed = Job.objects.create(
        client=client,
        manager=manager,
        job_code="JOB-DONE-1",
        job_name="Completed Project",
        status=Job.Status.COMPLETED,
        start_date=today - timedelta(days=60),
        deadline=today - timedelta(days=10),
    )
    room_done = ChatRoom.objects.create(name="Done Room", room_type="JOB", job=job_completed)
    ChatParticipant.objects.create(room=room_done, user=employee)

    # 5. Job Cancelled (should NOT be counted in active jobs)
    job_cancelled = Job.objects.create(
        client=client,
        manager=manager,
        job_code="JOB-CANCEL-1",
        job_name="Cancelled Project",
        status=Job.Status.CANCELLED,
        start_date=today,
        deadline=today + timedelta(days=10),
    )
    room_cancel = ChatRoom.objects.create(name="Cancel Room", room_type="JOB", job=job_cancelled)
    ChatParticipant.objects.create(room=room_cancel, user=employee)

    # 6. Job Active with task assigned to employee
    job_active_with_task = Job.objects.create(
        client=client,
        manager=manager,
        job_code="JOB-TASK-1",
        job_name="Active Project with Task",
        status=Job.Status.ACTIVE,
        start_date=today,
        deadline=today + timedelta(days=20),
    )
    Task.objects.create(
        job=job_active_with_task,
        assignee=employee,
        creator=manager,
        title="Active Deliverable Task",
        status=Task.Status.IN_PROGRESS,
        priority=Task.Priority.HIGH,
        deadline=today + timedelta(days=5),
        order_index="a0",
    )

    # Total in-scope jobs: Planning (1) + Active team (2) + On Hold (3) + Active with task (6) = 4 jobs
    metrics = calculate_smart_workload_pressure(employee)
    assert metrics["active_jobs_count"] == 4, f"Expected 4 active/planning/on-hold jobs, got {metrics['active_jobs_count']}"
    assert metrics["active_tasks_count"] == 1
    assert metrics["daily_required_hours"] > 0


@pytest.mark.django_db
def test_manager_job_serializer_team_size_excludes_manager(test_setup):
    """ManagerJobListSerializer team_size must strictly count assigned employees and exclude the manager."""
    from chat.models import ChatRoom, ChatParticipant
    from projects.manager.serializers_manager import ManagerJobListSerializer

    manager = test_setup["manager"]
    employee = test_setup["employee"]
    job = test_setup["job_planning"]
    today = timezone.localdate()

    # 1. Add employee to job team
    room = ChatRoom.objects.create(name="Planning Room", room_type="JOB", job=job)
    ChatParticipant.objects.create(room=room, user=employee)

    # 2. Add an unassigned task (assignee=manager)
    Task.objects.create(
        job=job,
        assignee=manager,
        creator=manager,
        title="Unassigned Task For Manager",
        deadline=today + timedelta(days=7),
        order_index="a0",
    )

    # 3. Serialize job
    serializer = ManagerJobListSerializer(job)
    # team_size should be 1 (only the employee), NOT 2 (employee + manager)
    assert serializer.data["team_size"] == 1, f"Expected team_size=1, got {serializer.data['team_size']}"
    assert len(serializer.data["project_team"]) == 1
    assert serializer.data["project_team"][0]["id"] == employee.id


@pytest.mark.django_db
def test_task_creation_hard_validation_dates(test_setup):
    """Task creation must hard-block dates in the past, exceeding job deadline, or with start_date > deadline."""
    from rest_framework.exceptions import ValidationError
    from tasks.manager.serializers_manager import ManagerTaskCreateSerializer
    from tasks.services.task_manager_service import create_task

    manager = test_setup["manager"]
    employee = test_setup["employee"]
    job = test_setup["job_planning"]
    today = timezone.localdate()

    # Case 1: Deadline in the past -> REJECTED
    ser_past = ManagerTaskCreateSerializer(
        data={
            "job_id": job.id,
            "title": "Past Task",
            "deadline": str(today - timedelta(days=1)),
        }
    )
    assert not ser_past.is_valid()
    assert "deadline" in ser_past.errors

    # Case 2: Deadline exceeding job.deadline -> REJECTED
    ser_exceed = ManagerTaskCreateSerializer(
        data={
            "job_id": job.id,
            "title": "Exceed Task",
            "deadline": str(job.deadline + timedelta(days=1)),
        }
    )
    assert not ser_exceed.is_valid()
    assert "deadline" in ser_exceed.errors

    # Case 3: Start date in the past -> REJECTED
    ser_start_past = ManagerTaskCreateSerializer(
        data={
            "job_id": job.id,
            "title": "Start Past Task",
            "start_date": str(today - timedelta(days=2)),
            "deadline": str(today + timedelta(days=5)),
        }
    )
    assert not ser_start_past.is_valid()
    assert "start_date" in ser_start_past.errors

    # Case 4: Start date > deadline -> REJECTED
    ser_order = ManagerTaskCreateSerializer(
        data={
            "job_id": job.id,
            "title": "Inverted Dates Task",
            "start_date": str(today + timedelta(days=10)),
            "deadline": str(today + timedelta(days=5)),
        }
    )
    assert not ser_order.is_valid()
    assert "start_date" in ser_order.errors

    # Case 5: Valid start_date and deadline within job bounds -> SUCCEEDS
    valid_data = {
        "job_id": job.id,
        "title": "Planned Future Task",
        "start_date": str(today + timedelta(days=5)),
        "deadline": str(today + timedelta(days=15)),
        "assignee_id": employee.id,
    }
    ser_valid = ManagerTaskCreateSerializer(data=valid_data)
    assert ser_valid.is_valid(), ser_valid.errors

    task = create_task(user=manager, data=valid_data)
    assert str(task.start_date) == str(today + timedelta(days=5))
    assert str(task.deadline) == str(today + timedelta(days=15))
    assert task.title == "Planned Future Task"


@pytest.mark.django_db
def test_task_update_status_based_editing_rules(test_setup):
    """Task update rules by status:

    - TODO: Manager can edit start_date and deadline.
    - IN_PROGRESS / REVIEWING: Manager can edit deadline, but CANNOT change start_date.
    - COMPLETED / CANCELLED: Manager CANNOT edit any task field (terminal closed state).
    """
    from tasks.services.task_manager_service import update_task, BusinessRuleError
    from tasks.manager.serializers_manager import ManagerTaskUpdateSerializer

    manager = test_setup["manager"]
    employee = test_setup["employee"]
    job = test_setup["job_planning"]
    today = timezone.localdate()

    # 1. TODO task: Can edit both start_date and deadline
    task_todo = Task.objects.create(
        job=job,
        assignee=employee,
        creator=manager,
        title="Todo Task",
        status=Task.Status.TODO,
        start_date=today,
        deadline=today + timedelta(days=10),
        order_index="a0",
    )
    ser_todo = ManagerTaskUpdateSerializer(
        instance=task_todo,
        data={
            "start_date": str(today + timedelta(days=2)),
            "deadline": str(today + timedelta(days=12)),
        },
    )
    assert ser_todo.is_valid(), ser_todo.errors
    updated_todo = update_task(
        user=manager,
        task=task_todo,
        data={
            "start_date": today + timedelta(days=2),
            "deadline": today + timedelta(days=12),
        },
    )
    assert updated_todo.start_date == today + timedelta(days=2)
    assert updated_todo.deadline == today + timedelta(days=12)

    # 2. IN_PROGRESS task: CANNOT change start_date, but CAN change deadline
    task_in_prog = Task.objects.create(
        job=job,
        assignee=employee,
        creator=manager,
        title="In Progress Task",
        status=Task.Status.IN_PROGRESS,
        start_date=today,
        deadline=today + timedelta(days=10),
        order_index="a1",
    )
    # 2a. Attempt to change start_date -> REJECTED
    ser_prog_bad = ManagerTaskUpdateSerializer(
        instance=task_in_prog,
        data={"start_date": str(today + timedelta(days=3))},
    )
    assert not ser_prog_bad.is_valid()
    assert "start_date" in ser_prog_bad.errors

    with pytest.raises(BusinessRuleError, match="Cannot change start date"):
        update_task(
            user=manager,
            task=task_in_prog,
            data={"start_date": today + timedelta(days=3)},
        )

    # 2b. Change deadline only -> ALLOWED
    ser_prog_good = ManagerTaskUpdateSerializer(
        instance=task_in_prog,
        data={"deadline": str(today + timedelta(days=14))},
    )
    assert ser_prog_good.is_valid(), ser_prog_good.errors
    updated_prog = update_task(
        user=manager,
        task=task_in_prog,
        data={"deadline": today + timedelta(days=14)},
    )
    assert updated_prog.deadline == today + timedelta(days=14)

    # 3. REVIEWING task: CANNOT change start_date
    task_review = Task.objects.create(
        job=job,
        assignee=employee,
        creator=manager,
        title="Reviewing Task",
        status=Task.Status.REVIEWING,
        start_date=today,
        deadline=today + timedelta(days=10),
        order_index="a2",
    )
    ser_rev_bad = ManagerTaskUpdateSerializer(
        instance=task_review,
        data={"start_date": str(today + timedelta(days=2))},
    )
    assert not ser_rev_bad.is_valid()
    assert "start_date" in ser_rev_bad.errors

    with pytest.raises(BusinessRuleError, match="Cannot change start date"):
        update_task(
            user=manager,
            task=task_review,
            data={"start_date": today + timedelta(days=2)},
        )

    # 4. COMPLETED task: CANNOT edit at all
    task_done = Task.objects.create(
        job=job,
        assignee=employee,
        creator=manager,
        title="Completed Task",
        status=Task.Status.COMPLETED,
        start_date=today,
        deadline=today + timedelta(days=10),
        order_index="a3",
    )
    ser_done_bad = ManagerTaskUpdateSerializer(
        instance=task_done,
        data={"title": "New Title"},
    )
    assert not ser_done_bad.is_valid()

    with pytest.raises(BusinessRuleError, match="Cannot edit task in 'COMPLETED' status"):
        update_task(
            user=manager,
            task=task_done,
            data={"title": "New Title"},
        )

    # 5. CANCELLED task: CANNOT edit at all
    task_cancelled = Task.objects.create(
        job=job,
        assignee=employee,
        creator=manager,
        title="Cancelled Task",
        status=Task.Status.CANCELLED,
        start_date=today,
        deadline=today + timedelta(days=10),
        order_index="a4",
    )
    ser_canc_bad = ManagerTaskUpdateSerializer(
        instance=task_cancelled,
        data={"title": "New Title"},
    )
    assert not ser_canc_bad.is_valid()

    with pytest.raises(BusinessRuleError, match="Cannot edit task in 'CANCELLED' status"):
        update_task(
            user=manager,
            task=task_cancelled,
            data={"title": "New Title"},
        )




