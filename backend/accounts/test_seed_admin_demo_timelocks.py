"""
Test _seed_timelocks() của lệnh seed_admin_demo.

Bug thật đã tìm ra: employee bị chặn Log Work với lỗi "Period 9/2026 is
locked (GLOBAL lock)" dù đó là THÁNG HIỆN TẠI. Root cause: _seed_timelocks
tái dùng --count (mặc định 20, dùng chung cho mọi loại demo data khác) làm
"số tháng QUÁ KHỨ cần khoá" — nhưng công thức sinh tháng
`((today.month - 2 - i) % 12) + 1` chỉ đúng với tối đa 11 vòng lặp (11
tháng/năm phân biệt); count=20 khiến i chạy tới 19, và tại i=11 công thức
vòng lại trúng đúng THÁNG HIỆN TẠI — hoàn toàn không liên quan gì tới
autolock_previous_period (Celery beat thật) hay đồng hồ hệ thống.
"""
import pytest
from model_bakery import baker

from accounts.management.commands.seed_admin_demo import Command
from django.utils import timezone
from timesheets.models import TimeLock


@pytest.fixture
def admin_user(db):
    role = baker.make("accounts.Role", code="ADMIN")
    return baker.make("accounts.CustomUser", role=role, is_active=True)


def test_seed_timelocks_never_locks_the_current_month(admin_user):
    today = timezone.now().date()

    # count=20 khớp đúng --count mặc định thật của seed_admin_demo — đây
    # chính là lời gọi xảy ra trong thực tế, không phải giá trị bịa ra để
    # ép bug lộ ra.
    Command()._seed_timelocks(count=20, admin_user=admin_user, jobs=[])

    current_month_locked = TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        lock_month=today.month,
        lock_year=today.year,
    ).exists()
    assert not current_month_locked, (
        "seed_admin_demo vừa khoá GLOBAL đúng THÁNG HIỆN TẠI — employee sẽ "
        "bị chặn Log Work ngay lập tức, đúng bug thật đã gặp."
    )


def test_seed_timelocks_never_locks_a_future_month(admin_user):
    today = timezone.now().date()

    Command()._seed_timelocks(count=20, admin_user=admin_user, jobs=[])

    for lock in TimeLock.objects.filter(lock_scope=TimeLock.LockScope.GLOBAL):
        is_future = (lock.lock_year, lock.lock_month) > (today.year, today.month)
        assert not is_future, f"Khoá tháng tương lai: {lock.lock_month}/{lock.lock_year}"


def test_seed_timelocks_creates_exactly_count_distinct_past_months(admin_user):
    """count=20 phải tạo ra 20 tháng QUÁ KHỨ phân biệt — không lặp lại do
    modulo-wraparound (đây là cách bug cũ "chỉ tạo được 12 bản ghi" dù
    count=20, vì 8 lời gọi cuối get_or_create trúng lại record đã có)."""
    Command()._seed_timelocks(count=20, admin_user=admin_user, jobs=[])

    assert TimeLock.objects.filter(lock_scope=TimeLock.LockScope.GLOBAL).count() == 20
