"""
One-off seed script: enrich sophia.johnson@worktracker.vn's data so the
Employee Dashboard / My Performance charts have something real to show
(14-day trend, multi-project hours, mixed task statuses/overdue, varied
notifications) instead of the sparse data left over from earlier manual
testing. Additive only — never wipes anything, safe to re-run (uses
get_or_create keyed on fields specific enough not to duplicate rows).

Directly sets Task.status / creates LogWork rows via the ORM instead of
going through apply_transition()/the LogWork API — acceptable here only
because this is offline seed data, not a real user action flowing
through business rules (same pattern accounts/management/commands/
seed_data.py already uses for the same reason).

The 6 tasks this script logs hours against (marketing_task, task1, task16,
task46, task61, task76) used to be looked up by hardcoded title prefix
(e.g. "Design Database Schema #10.") — but seed_data.py assigns task
templates/assignees with an unseeded random.choice(), so which task lands
at that title/position is different on every `seed_data --reset`. Picked
dynamically instead via pick_task_for_sophia() below: any task already
assigned to her, or — if she doesn't have enough — any task in the DB,
force-reassigned to her (fine here, same "offline seed data" pass as
above). Variable names are historical, not literal titles.
"""
from datetime import timedelta, datetime
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import CustomUser
from projects.models import Job
from tasks.models import Task, TaskFollower, TaskComment
from tasks.services.order_index_manager_service import key_between
from timesheets.models import LogWork
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet
from system.models import Notification
from system.services.notification_manager_service import notify


def next_order_index(job, status):
    last = (
        Task.objects.filter(job=job, status=status)
        .order_by("-order_index")
        .values_list("order_index", flat=True)
        .first()
    )
    return key_between(last, None)


def pick_task_for_sophia(sophia, used_ids):
    """Returns a Task belonging to sophia that hasn't been picked yet in
    this run. Prefers one she's already assigned; falls back to grabbing
    any other task and reassigning it to her if she doesn't have enough."""
    task = (
        Task.objects.filter(assignee=sophia)
        .exclude(id__in=used_ids)
        .exclude(status=Task.Status.CANCELLED)
        .order_by("id")
        .first()
    )
    if task is None:
        task = Task.objects.exclude(id__in=used_ids).order_by("id").first()
        if task is None:
            raise CommandError(
                "Not enough tasks in the DB to seed Sophia's dashboard demo — run seed_data first."
            )
        task.assignee = sophia
        task.save(update_fields=["assignee"])
    used_ids.add(task.id)
    return task


class Command(BaseCommand):
    help = "Seed richer, more diverse data for sophia.johnson@worktracker.vn (Dashboard/My Performance demo)"

    def handle(self, *args, **options):
        sophia = CustomUser.objects.get(email="sophia.johnson@worktracker.vn")
        manager = CustomUser.objects.get(email="manager@worktracker.vn")
        today = timezone.localdate()

        with transaction.atomic():
            # -----------------------------------------------------------
            # 1. Diversify existing tasks' status (completion rate,
            #    task_status_breakdown need more than TODO/IN_PROGRESS/REVIEWING).
            # -----------------------------------------------------------
            self.stdout.write("1. Diversifying existing task statuses...")

            used_task_ids = set()
            marketing_task = pick_task_for_sophia(sophia, used_task_ids)
            marketing_task.status = Task.Status.COMPLETED
            marketing_task.completed_at = timezone.now() - timedelta(days=4)
            marketing_task.save()

            # -----------------------------------------------------------
            # 2. New tasks on jobs Sophia doesn't have yet (Security Audit,
            #    Website Redesign, HRMS Portal) — fills out hours_by_project
            #    and adds a CANCELLED case (excluded from completion rate).
            # -----------------------------------------------------------
            self.stdout.write("2. Adding tasks on new projects for Sophia...")

            job_sec = Job.objects.get(job_code="JOB-SEC-06")
            job_web = Job.objects.get(job_code="JOB-WEB-03")
            job_hrm = Job.objects.get(job_code="JOB-HRM-09")

            sec_task, _ = Task.objects.get_or_create(
                title="Penetration Test Report Writeup",
                job=job_sec,
                defaults={
                    "creator": manager,
                    "assignee": sophia,
                    "status": Task.Status.COMPLETED,
                    "priority": Task.Priority.MEDIUM,
                    "deadline": today - timedelta(days=2),
                    "completed_at": timezone.now() - timedelta(days=3),
                    "order_index": next_order_index(job_sec, Task.Status.COMPLETED),
                    "description": "Summarize findings from the security audit into a client-facing report.",
                },
            )

            web_task, _ = Task.objects.get_or_create(
                title="Homepage Hero Section Redesign",
                job=job_web,
                defaults={
                    "creator": manager,
                    "assignee": sophia,
                    "status": Task.Status.TODO,
                    "priority": Task.Priority.LOW,
                    "deadline": today + timedelta(days=10),
                    "order_index": next_order_index(job_web, Task.Status.TODO),
                    "description": "Rework the homepage hero section per the new brand guidelines.",
                },
            )

            hrm_task, _ = Task.objects.get_or_create(
                title="Employee Self-Service Portal Wireframe",
                job=job_hrm,
                defaults={
                    "creator": manager,
                    "assignee": sophia,
                    "status": Task.Status.CANCELLED,
                    "priority": Task.Priority.LOW,
                    "deadline": today + timedelta(days=5),
                    "order_index": next_order_index(job_hrm, Task.Status.CANCELLED),
                    "description": "Superseded by the vendor's off-the-shelf HRMS module — cancelled by the client.",
                },
            )

            used_task_ids.update({sec_task.id, web_task.id, hrm_task.id})

            for t in (sec_task, web_task, hrm_task):
                TaskFollower.objects.get_or_create(task=t, user=manager)
                TaskFollower.objects.get_or_create(task=t, user=sophia)

            TaskComment.objects.get_or_create(
                task=sec_task, user=manager,
                defaults={"content": "Great work on the audit — please have the report ready by Friday."},
            )
            TaskComment.objects.get_or_create(
                task=hrm_task, user=manager,
                defaults={"content": "Client switched to a vendor solution, cancelling this one."},
            )

            # -----------------------------------------------------------
            # 3. LogWork spread across the last 14 days (the Dashboard/My
            #    Performance daily trend window), mixed review_status,
            #    2 deliberate zero-hour gap days to prove the frontend's
            #    zero-fill still renders a continuous line.
            # -----------------------------------------------------------
            self.stdout.write("3. Seeding LogWork across the last 14 days...")

            task1 = pick_task_for_sophia(sophia, used_task_ids)
            task16 = pick_task_for_sophia(sophia, used_task_ids)
            task46 = pick_task_for_sophia(sophia, used_task_ids)
            task61 = pick_task_for_sophia(sophia, used_task_ids)
            task76 = pick_task_for_sophia(sophia, used_task_ids)

            # (day_offset_from_today, task, hours, review_status)
            # day_offset 13 = trend_start (today - 13), 0 = today.
            plan = [
                (13, task1, "6.00", LogWork.ReviewStatus.APPROVED),   # 08-05
                (12, task16, "4.00", LogWork.ReviewStatus.APPROVED),  # 08-06
                # 08-07, 08-08 deliberately left empty (zero-fill gap days)
                (9, task46, "7.50", LogWork.ReviewStatus.PENDING),    # 08-09
                (8, task76, "8.00", LogWork.ReviewStatus.APPROVED),   # 08-10
                (7, task61, "5.00", LogWork.ReviewStatus.PENDING),    # 08-11
                (6, marketing_task, "3.00", LogWork.ReviewStatus.APPROVED),  # 08-12
                (5, sec_task, "6.50", LogWork.ReviewStatus.APPROVED), # 08-13
                # day_offset 4 (08-14) deliberately skipped — another gap day.
                (3, web_task, "2.00", LogWork.ReviewStatus.APPROVED), # 08-15, on top of the 9.5h already there
                (2, task76, "8.00", LogWork.ReviewStatus.APPROVED),   # 08-16
                (1, task1, "6.00", LogWork.ReviewStatus.APPROVED),    # 08-17
                (1, task16, "3.00", LogWork.ReviewStatus.APPROVED),   # 08-17
                (0, task46, "4.00", LogWork.ReviewStatus.PENDING),    # 08-18 (today)
                (0, task61, "2.50", LogWork.ReviewStatus.REJECTED),   # 08-18 (today)
            ]

            touched_dates = set()
            for day_offset, task, hours, review_status in plan:
                work_date = today - timedelta(days=day_offset)
                LogWork.objects.get_or_create(
                    task=task,
                    user=sophia,
                    work_date=work_date,
                    hours_spent=Decimal(hours),
                    defaults={
                        "description": f"Logged work on '{task.title}'.",
                        "review_status": review_status,
                        "reviewed_by": manager if review_status != LogWork.ReviewStatus.PENDING else None,
                    },
                )
                touched_dates.add(work_date)

            for work_date in touched_dates:
                rebuild_daily_user_timesheet(sophia.id, work_date)

            # -----------------------------------------------------------
            # 4. Notifications — variety of event types, mixed read state,
            #    backdated created_at so the feed doesn't look like it all
            #    happened in the same second.
            # -----------------------------------------------------------
            self.stdout.write("4. Seeding varied notifications...")

            notif_plan = [
                (Notification.EventType.TASK_ASSIGNED, "New task assigned", f"You were assigned '{web_task.title}'.", f"/employee/tasks/{web_task.id}", 6, True),
                (Notification.EventType.TASK_COMMENT, "New comment on your task", f"Manager commented on '{sec_task.title}'.", f"/employee/tasks/{sec_task.id}", 5, True),
                (Notification.EventType.TASK_STATUS_CHANGED, "Task completed", f"'{marketing_task.title}' was marked completed.", f"/employee/tasks/{marketing_task.id}", 4, True),
                (Notification.EventType.TASK_STATUS_CHANGED, "Task cancelled", f"'{hrm_task.title}' was cancelled by the client.", f"/employee/tasks/{hrm_task.id}", 3, False),
                (Notification.EventType.LOG_WORK_APPROVED, "Log work approved", f"Your log work on '{task76.title}' (08/16) was approved.", "/employee/timesheet", 2, False),
                (Notification.EventType.LOG_WORK_REJECTED, "Log work rejected", f"Your log work on '{task61.title}' (08/18) was rejected — please review.", "/employee/timesheet", 0, False),
                (Notification.EventType.TIMESHEET_LOCK, "Timesheet period locked", "July's timesheet has been locked by your manager.", "/employee/timesheet", 10, True),
            ]

            for event_type, title, content, url, days_ago, is_read in notif_plan:
                notification = notify(
                    recipients=[sophia.id],
                    event_type=event_type,
                    title=title,
                    content=content,
                    related_url=url,
                )[0]
                Notification.objects.filter(id=notification.id).update(
                    created_at=timezone.now() - timedelta(days=days_ago),
                    is_read=is_read,
                )

        self.stdout.write(self.style.SUCCESS(
            "Done. Sophia now has richer task/logwork/notification data for the Dashboard demo."
        ))
