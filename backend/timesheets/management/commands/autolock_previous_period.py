"""
Module: timesheets.management.commands.autolock_previous_period
Description: Management command to manually execute or simulate two-stage period locking for the elapsed month.
"""

from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from timesheets.services.auto_lock_service import (
    auto_lock_previous_period,
    get_previous_period,
)


class Command(BaseCommand):
    """Execute or simulate two-stage period locking routine across job and global scopes."""
    help = (
        "Automatically lock timesheet period of elapsed month in two stages: "
        "Job scope on Day 1 (Manager scope) and Global scope on Day 5 (Admin scope)."
    )

    def add_arguments(self, parser):
        """Define command-line arguments for dry-run mode and simulated execution dates."""
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show which periods would be locked without writing changes to the database.",
        )
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="Simulate execution date in YYYY-MM-DD format (defaults to current date).",
        )

    def handle(self, *args, **options):
        """Execute automated period locking logic with simulated date and output status."""
        simulated_today = None
        if options.get("date"):
            try:
                simulated_today = datetime.strptime(options["date"], "%Y-%m-%d").date()
            except ValueError:
                raise CommandError("Invalid --date format. Please use YYYY-MM-DD.")

        today = simulated_today or timezone.localdate()
        month, year = get_previous_period(today)

        if options["dry_run"]:
            self.stdout.write(
                f"[dry-run] Simulating date {today}: targeting period {month:02d}/{year}.\n"
                f"  - Job scope lock: applies from Day 1 (today is day {today.day})\n"
                f"  - Global scope lock: applies from Day 5 (today is day {today.day})"
            )
            return

        result = auto_lock_previous_period(today=today)
        status = result.get("status")

        if status == "no_admin":
            self.stdout.write(self.style.ERROR(
                "No active Administrator account found to sign the period lock action."
            ))
            return

        if status == "error":
            self.stdout.write(self.style.ERROR(
                f"Period lock failed for {month:02d}/{year}: {result.get('reason')}"
            ))
            return

        job_info = result.get("job_locks", {})
        global_info = result.get("global_lock", {})

        self.stdout.write(self.style.SUCCESS(
            f"=== AUTOMATED PERIOD LOCK RESULT {month:02d}/{year} (Simulated: {today}) ==="
        ))

        self.stdout.write(
            f"[*] Job Scope Lock (Manager): "
            f"Locked {job_info.get('locked_count', 0)} job(s), "
            f"already locked: {job_info.get('already_locked_count', 0)}, "
            f"skipped (Manager unlocked): {job_info.get('skipped_unlocked_count', 0)}."
        )

        g_status = global_info.get("status")
        if g_status == "locked":
            self.stdout.write(self.style.SUCCESS(
                f"[*] Global Scope Lock (Admin): LOCKED company-wide (actor {global_info.get('actor')})."
            ))
        elif g_status == "already_locked":
            self.stdout.write(
                f"[*] Global Scope Lock (Admin): Already locked company-wide."
            )
        elif g_status == "pending_until_day_5":
            self.stdout.write(self.style.WARNING(
                f"[*] Global Scope Lock (Admin): Day 5 has not arrived yet (today is day {today.day}). "
                f"Global lock remains open for manager review."
            ))
        else:
            self.stdout.write(self.style.ERROR(
                f"[*] Global Scope Lock (Admin) failed: {global_info.get('reason')}"
            ))
