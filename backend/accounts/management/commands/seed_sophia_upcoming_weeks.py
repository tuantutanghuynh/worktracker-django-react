"""
One-off seed script: adds LogWork entries for sophia.johnson@worktracker.vn
covering the next 3 weeks (2026-08-25 -> 2026-09-11) so the Timesheet
Week View has real content when clicking "Next Week" a couple of times,
not just the current week. Additive only (get_or_create), safe to re-run.

Same disclaimers as seed_sophia_dashboard.py: writes LogWork directly via
the ORM (not through EmployeeLogWorkSerializer.create()), acceptable only
because this is offline demo data, not a real user action going through
business rules. Hours per day are kept under the 8h cap by hand.

The plan below originally referenced 7 specific Task ids (16, 31, 46, 1,
102, 61, 76) hand-picked from one past `seed_data --reset` run. Those ids
aren't stable across reseeds — seed_data.py assigns tasks with an
unseeded random.choice(), so a fresh reset gives Sophia a different set of
tasks entirely. Replaced with 7 "slots" (0-6) resolved dynamically at
runtime by pick_sophia_tasks() below: whatever tasks she's actually
assigned to right now, topped up by reassigning spare tasks to her if she
doesn't have 7. The day/hours/gap-day plan itself (the actual point of
this script) is untouched.
"""
from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import CustomUser
from tasks.models import Task
from timesheets.models import LogWork
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet

NUM_SLOTS = 7


def pick_sophia_tasks(sophia):
    """Returns {slot index 0..NUM_SLOTS-1: Task}, preferring tasks already
    assigned to sophia and reassigning spare tasks to her (fine — offline
    seed data, see module docstring) if she doesn't have enough of her own."""
    picked = list(Task.objects.filter(assignee=sophia).order_by("id")[:NUM_SLOTS])
    if len(picked) < NUM_SLOTS:
        exclude_ids = {t.id for t in picked}
        extra = list(
            Task.objects.exclude(id__in=exclude_ids).order_by("id")[: NUM_SLOTS - len(picked)]
        )
        for t in extra:
            t.assignee = sophia
            t.save(update_fields=["assignee"])
        picked += extra
    if len(picked) < NUM_SLOTS:
        raise CommandError(
            f"Not enough tasks in the DB to seed {NUM_SLOTS} slots (found {len(picked)}) — run seed_data first."
        )
    return dict(enumerate(picked))


class Command(BaseCommand):
    help = "Seed 3 more weeks of LogWork for sophia.johnson@worktracker.vn (Timesheet Week View demo)"

    def handle(self, *args, **options):
        sophia = CustomUser.objects.get(email="sophia.johnson@worktracker.vn")
        manager = CustomUser.objects.get(email="manager@worktracker.vn")

        # Slot index (0-6) -> Task, resolved dynamically — xem docstring đầu file.
        tasks = pick_sophia_tasks(sophia)

        # (work_date, slot, hours, review_status) — mỗi ngày <= 8h,
        # vài ngày để trống có chủ đích (kiểm chứng zero-fill của Week View).
        plan = [
            (date(2026, 8, 25), 0, "3.00", LogWork.ReviewStatus.PENDING),
            (date(2026, 8, 25), 1, "2.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 8, 26), 2, "6.00", LogWork.ReviewStatus.PENDING),
            (date(2026, 8, 27), 3, "4.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 8, 27), 4, "2.00", LogWork.ReviewStatus.PENDING),
            (date(2026, 8, 28), 5, "7.00", LogWork.ReviewStatus.APPROVED),
            # 08-29, 08-30 (cuối tuần) để trống có chủ đích.
            (date(2026, 8, 31), 6, "5.00", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 1), 0, "3.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 2), 1, "6.00", LogWork.ReviewStatus.PENDING),
            # 09-03 để trống có chủ đích.
            (date(2026, 9, 4), 2, "4.00", LogWork.ReviewStatus.APPROVED),
            (date(2026, 9, 7), 3, "5.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 8), 4, "3.00", LogWork.ReviewStatus.PENDING),
            # 09-09 để trống có chủ đích.
            (date(2026, 9, 10), 5, "6.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 11), 6, "4.00", LogWork.ReviewStatus.REJECTED),

            # +2 tuần nữa (14/9 -> 25/9), nối tiếp không trùng ngày cũ.
            (date(2026, 9, 14), 0, "4.00", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 15), 2, "5.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 16), 1, "3.00", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 16), 4, "3.00", LogWork.ReviewStatus.PENDING),
            # 09-17 để trống có chủ đích.
            (date(2026, 9, 18), 3, "7.50", LogWork.ReviewStatus.APPROVED),
            (date(2026, 9, 21), 6, "4.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 22), 5, "6.00", LogWork.ReviewStatus.PENDING),
            # 09-23 để trống có chủ đích.
            (date(2026, 9, 24), 0, "5.00", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 25), 2, "3.50", LogWork.ReviewStatus.PENDING),
            (date(2026, 9, 25), 1, "2.50", LogWork.ReviewStatus.APPROVED),
        ]

        with transaction.atomic():
            touched_dates = set()
            for work_date, slot, hours, review_status in plan:
                task = tasks[slot]
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

        self.stdout.write(self.style.SUCCESS(
            f"Done. Added LogWork across {len(touched_dates)} days, 2026-08-25 to 2026-09-25."
        ))
