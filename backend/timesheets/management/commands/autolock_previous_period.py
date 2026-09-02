"""
Chay tay viec khoa ky cong tu dong.

Cung mot logic voi task Celery chay dinh ky. Co lenh nay de:
  - Demo duoc ma khong can bat Celery beat.
  - Kiem tra ket qua ngay lap tuc thay vi cho toi 00:05 hom sau.
  - Cuu duoc neu beat chet may ngay ma khong ai biet.
"""
from django.core.management.base import BaseCommand

from timesheets.services.auto_lock_service import (
    auto_lock_previous_period,
    get_previous_period,
)


class Command(BaseCommand):
    help = "Khoa ky cong GLOBAL cua thang vua ket thuc (bo qua neu da khoa)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chi bao se khoa ky nao, khong ghi gi vao database.",
        )

    def handle(self, *args, **options):
        month, year = get_previous_period()

        if options["dry_run"]:
            self.stdout.write(f"[dry-run] Se khoa ky {month:02d}/{year}. Khong ghi gi.")
            return

        ket_qua = auto_lock_previous_period()
        status = ket_qua["status"]

        if status == "locked":
            self.stdout.write(self.style.SUCCESS(
                f"Da khoa ky {month:02d}/{year} (dung ten {ket_qua['actor']})."
            ))
        elif status == "already_locked":
            self.stdout.write(f"Ky {month:02d}/{year} da duoc khoa tu truoc. Khong lam gi.")
        elif status == "no_admin":
            self.stdout.write(self.style.ERROR(
                "Khong co Admin dang hoat dong nao de dung ten khoa ky."
            ))
        else:
            self.stdout.write(self.style.ERROR(
                f"Khoa ky {month:02d}/{year} that bai: {ket_qua.get('reason')}"
            ))
