"""
Chay tay viec khoa ky cong tu dong (Quy trinh 2 giai doan: Job ngay 1 & Global ngay 5).

Cung mot logic voi task Celery chay dinh ky. Co lenh nay de:
  - Demo duoc ma khong can bat Celery beat.
  - Kiem tra ket qua ngay lap tuc thay vi cho toi 00:05 hom sau.
  - Cho phep truyen --date de gia lap chay vao ngay bat ky (vi du ngay 1 hoac ngay 5).
  - Cuu duoc neu beat chet may ngay ma khong ai biet.
"""
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from timesheets.services.auto_lock_service import (
    auto_lock_previous_period,
    get_previous_period,
)


class Command(BaseCommand):
    help = (
        "Tu dong khoa ky cong cua thang vua ket thuc theo 2 giai doan: "
        "Khoa Job (Manager scope tu ngay 1) va Khoa Global (Admin scope tu ngay 5)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chi bao se khoa ky nao, khong ghi gi vao database.",
        )
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="Gia lap ngay chay (dinh dang YYYY-MM-DD). Mac dinh la hom nay.",
        )

    def handle(self, *args, **options):
        simulated_today = None
        if options.get("date"):
            try:
                simulated_today = datetime.strptime(options["date"], "%Y-%m-%d").date()
            except ValueError:
                raise CommandError("Dinh dang --date khong hop le. Vui long dung YYYY-MM-DD.")

        today = simulated_today or timezone.localdate()
        month, year = get_previous_period(today)

        if options["dry_run"]:
            self.stdout.write(
                f"[dry-run] Gia lap ngay {today}: se xu ly ky {month:02d}/{year}.\n"
                f"  - Khoa cap Job: ap dung tu ngay 1 (hom nay la ngay {today.day})\n"
                f"  - Khoa cap Global: ap dung tu ngay 5 (hom nay la ngay {today.day})"
            )
            return

        ket_qua = auto_lock_previous_period(today=today)
        status = ket_qua.get("status")

        if status == "no_admin":
            self.stdout.write(self.style.ERROR(
                "Khong co Admin dang hoat dong nao de dung ten khoa ky."
            ))
            return

        if status == "error":
            self.stdout.write(self.style.ERROR(
                f"Khoa ky {month:02d}/{year} that bai: {ket_qua.get('reason')}"
            ))
            return

        # Thong tin ket qua chi tiet
        job_info = ket_qua.get("job_locks", {})
        global_info = ket_qua.get("global_lock", {})

        self.stdout.write(self.style.SUCCESS(
            f"=== KET QUA TU DONG KHOA KY CONG {month:02d}/{year} (Gia lap: {today}) ==="
        ))

        # 1. Job Locks
        self.stdout.write(
            f"[*] Khoa cap Job (Manager): "
            f"Da khoa {job_info.get('locked_count', 0)} job(s), "
            f"da khoa tu truoc: {job_info.get('already_locked_count', 0)}, "
            f"bo qua (Manager unlock): {job_info.get('skipped_unlocked_count', 0)}."
        )

        # 2. Global Lock
        g_status = global_info.get("status")
        if g_status == "locked":
            self.stdout.write(self.style.SUCCESS(
                f"[*] Khoa cap Global (Admin): DA KHOA toan he thong (dung ten {global_info.get('actor')})."
            ))
        elif g_status == "already_locked":
            self.stdout.write(
                f"[*] Khoa cap Global (Admin): Da khoa toan he thong tu truoc."
            )
        elif g_status == "pending_until_day_5":
            self.stdout.write(self.style.WARNING(
                f"[*] Khoa cap Global (Admin): Chua den ngay 5 (hom nay la ngay {today.day}). "
                f"Global lock dang de ngo cho Manager review cong."
            ))
        else:
            self.stdout.write(self.style.ERROR(
                f"[*] Khoa cap Global (Admin) that bai: {global_info.get('reason')}"
            ))

