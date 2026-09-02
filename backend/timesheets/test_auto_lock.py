"""
Test tự động khoá kỳ công khi sang tháng mới (Quy trình 2 giai đoạn):
  - Ngày 1: Tự động khoá cấp JOB (Manager scope) để chặn nhân viên log/sửa công.
  - Ngày 1..4: Cửa sổ ân hạn (grace period) cho Manager review công.
  - Ngày 5: Tự động khoá cấp GLOBAL (Admin scope) đóng băng dữ liệu cho payroll.

Luật quan trọng nhất: CHỈ khoá tháng đã qua. Khoá nhầm tháng hiện tại sẽ
khiến toàn công ty không chấm công được — sự cố nghiêm trọng nhất mà tính
năng này có thể gây ra.
"""
from datetime import date

import pytest
from model_bakery import baker

from timesheets.models import TimeLock
from timesheets.services.auto_lock_service import (
    auto_lock_previous_period,
    get_previous_period,
)


def ghim_hom_nay(monkeypatch, hom_nay):
    """
    Ghim timezone.now() bên trong timelock_manager_service.

    Thay HẲN cái tên `timezone` trong namespace của service, KHÔNG sửa thuộc
    tính `now` của module django.utils.timezone thật — module đó dùng chung
    cả project, vá vào đó thì auto_now_add của mọi model cũng nhận giá trị
    giả. Cùng cách đã dùng ở test_admin_timesheet_service.py.
    """
    from datetime import datetime

    from django.utils import timezone as timezone_that
    from timesheets.services import timelock_manager_service as svc

    class _FakeTimezone:
        @staticmethod
        def now():
            return timezone_that.make_aware(
                datetime(hom_nay.year, hom_nay.month, hom_nay.day, 12, 0)
            )

    monkeypatch.setattr(svc, "timezone", _FakeTimezone)
    return svc


@pytest.fixture
def admin(db):
    role = baker.make("accounts.Role", code="ADMIN")
    return baker.make(
        "accounts.CustomUser", email="quantri@test.com", role=role, is_active=True
    )


@pytest.fixture
def manager(db):
    role = baker.make("accounts.Role", code="MANAGER")
    return baker.make(
        "accounts.CustomUser", email="manager@test.com", role=role, is_active=True
    )


@pytest.fixture
def sample_job(db, manager):
    return baker.make(
        "projects.Job",
        job_name="Website Redesign",
        manager=manager,
        start_date=date(2026, 1, 1),
    )


def khoa_global(month, year, is_locked=True, user=None):
    return baker.make(
        "timesheets.TimeLock",
        job=None,
        lock_scope=TimeLock.LockScope.GLOBAL,
        lock_month=month,
        lock_year=year,
        is_locked=is_locked,
        locked_by=user,
    )


def dang_khoa_global(month, year):
    return TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        job__isnull=True,
        lock_month=month,
        lock_year=year,
        is_locked=True,
    ).exists()


def dang_khoa_job(job, month, year):
    return TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.JOB,
        job=job,
        lock_month=month,
        lock_year=year,
        is_locked=True,
    ).exists()


class TestTinhThangTruoc:
    """Chỗ dễ viết sai nhất: mốc giao năm, tháng 1 phải lùi về 12 năm trước."""

    @pytest.mark.parametrize(
        "hom_nay,mong_doi",
        [
            (date(2026, 9, 15), (8, 2026)),
            (date(2026, 3, 1), (2, 2026)),
            (date(2026, 12, 31), (11, 2026)),
            (date(2026, 1, 1), (12, 2025)),   # giao nam
            (date(2026, 1, 31), (12, 2025)),  # van la thang 12 nam truoc
        ],
    )
    def test_tinh_dung_thang_truoc(self, hom_nay, mong_doi):
        assert get_previous_period(hom_nay) == mong_doi


@pytest.mark.django_db
class TestQuyTrinhHaiGiaiDoan:
    """
    Quy trình 2 giai đoạn:
      - Ngày 1: Tự động khoá Job, để ngỏ Global lock cho Manager review.
      - Ngày 5: Tự động khoá Global toàn hệ thống cho payroll.
    """

    def test_ngay_1_khoa_job_nhung_chua_khoa_global(self, admin, sample_job):
        ket_qua = auto_lock_previous_period(today=date(2026, 9, 1))

        assert ket_qua["status"] == "locked"
        assert ket_qua["month"] == 8 and ket_qua["year"] == 2026

        # Cấp Job đã được khóa
        assert dang_khoa_job(sample_job, 8, 2026)
        assert ket_qua["job_locks"]["locked_count"] >= 1

        # Cấp Global CHƯA bị khóa (để ngỏ cho Manager review)
        assert not dang_khoa_global(8, 2026)
        assert ket_qua["global_lock"]["status"] == "pending_until_day_5"

    def test_ngay_3_van_trong_thoi_gian_an_han(self, admin, sample_job):
        """Từ ngày 1 đến ngày 4: Global vẫn ở trạng thái pending_until_day_5."""
        ket_qua = auto_lock_previous_period(today=date(2026, 9, 3))

        assert not dang_khoa_global(8, 2026)
        assert ket_qua["global_lock"]["status"] == "pending_until_day_5"

    def test_ngay_5_chinh_thuc_khoa_global(self, admin, sample_job):
        """Đúng ngày 5: Hết hạn ân hạn, hệ thống tự động khóa GLOBAL toàn công ty."""
        ket_qua = auto_lock_previous_period(today=date(2026, 9, 5))

        assert ket_qua["status"] == "locked"
        assert dang_khoa_global(8, 2026)
        assert ket_qua["global_lock"]["status"] == "locked"
        assert dang_khoa_job(sample_job, 8, 2026)


@pytest.mark.django_db
class TestChiKhoaThangDaQua:

    def test_KHONG_khoa_thang_hien_tai(self, admin, sample_job):
        """
        Chốt chặn quan trọng nhất của cả tính năng. Khoá nhầm tháng đang
        chấm công thì toàn công ty không log giờ được.
        """
        auto_lock_previous_period(today=date(2026, 9, 5))

        assert not dang_khoa_global(9, 2026)
        assert not dang_khoa_job(sample_job, 9, 2026)

    def test_KHONG_khoa_thang_tuong_lai(self, admin, sample_job):
        auto_lock_previous_period(today=date(2026, 9, 5))

        assert not dang_khoa_global(10, 2026)
        assert not dang_khoa_job(sample_job, 10, 2026)

    def test_giao_nam_khoa_thang_12_nam_truoc(self, admin, sample_job):
        ket_qua = auto_lock_previous_period(today=date(2026, 1, 5))

        assert (ket_qua["month"], ket_qua["year"]) == (12, 2025)
        assert dang_khoa_global(12, 2025)
        assert not dang_khoa_global(1, 2026)


@pytest.mark.django_db
class TestChayLaiNhieuLan:
    """
    Beat chạy MỖI NGÀY — task đảm bảo tính idempotent, không tạo trùng
    và không lỗi khi chạy lại nhiều lần.
    """

    def test_chay_lai_ngay_5_va_6_khong_loi(self, admin, sample_job):
        assert auto_lock_previous_period(today=date(2026, 9, 5))["status"] == "locked"
        assert auto_lock_previous_period(today=date(2026, 9, 6))["status"] == "already_locked"

    def test_khong_tao_them_ban_ghi_global_trung(self, admin, sample_job):
        for ngay in range(5, 10):
            auto_lock_previous_period(today=date(2026, 9, ngay))

        so_ban_ghi = TimeLock.objects.filter(
            lock_scope=TimeLock.LockScope.GLOBAL, lock_month=8, lock_year=2026
        ).count()
        assert so_ban_ghi == 1

    def test_khong_ghi_de_len_ky_Admin_da_khoa_tay(self, admin):
        khoa_global(8, 2026, user=admin)
        goc = TimeLock.objects.get(lock_month=8, lock_year=2026, lock_scope="GLOBAL")

        auto_lock_previous_period(today=date(2026, 9, 5))

        goc.refresh_from_db()
        assert goc.lock_reason != "Automatically locked by the system"


@pytest.mark.django_db
class TestTruongHopBienDoi:

    def test_khong_co_admin_thi_bao_loi_khong_ngat(self, db):
        ket_qua = auto_lock_previous_period(today=date(2026, 9, 5))

        assert ket_qua["status"] == "no_admin"
        assert not dang_khoa_global(8, 2026)

    def test_admin_da_khoa_khong_duoc_dung_ten(self, db):
        role = baker.make("accounts.Role", code="ADMIN")
        baker.make("accounts.CustomUser", role=role, is_active=False)

        assert auto_lock_previous_period(today=date(2026, 9, 5))["status"] == "no_admin"

    def test_ky_da_mo_khoa_thi_khoa_lai_vao_ngay_5(self, admin):
        khoa_global(8, 2026, is_locked=False, user=admin)

        assert auto_lock_previous_period(today=date(2026, 9, 5))["status"] == "locked"
        assert dang_khoa_global(8, 2026)

    def test_ghi_ro_day_la_lenh_tu_dong(self, admin, sample_job):
        auto_lock_previous_period(today=date(2026, 9, 5))

        tl_global = TimeLock.objects.get(lock_month=8, lock_year=2026, lock_scope="GLOBAL")
        assert "Automatically locked" in tl_global.lock_reason

        tl_job = TimeLock.objects.get(lock_month=8, lock_year=2026, lock_scope="JOB", job=sample_job)
        assert "Automatically locked" in tl_job.lock_reason


@pytest.mark.django_db
class TestKhongKhoaTayKyDangDienRa:
    """
    Chốt chặn cho việc khoá TAY qua giao diện Admin.
    """

    def _khoa(self, admin, month, year):
        from timesheets.services.timelock_manager_service import lock_global_period

        return lock_global_period(
            user=admin, lock_month=month, lock_year=year, reason="thu"
        )

    def test_khoa_thang_hien_tai_bi_tu_choi(self, admin, monkeypatch):
        svc = ghim_hom_nay(monkeypatch, date(2026, 9, 15))

        with pytest.raises(svc.TimeLockError) as exc:
            self._khoa(admin, 9, 2026)
        assert "CANNOT_LOCK_ACTIVE_PERIOD" in str(exc.value)
        assert not dang_khoa_global(9, 2026)

    def test_khoa_thang_tuong_lai_bi_tu_choi(self, admin, monkeypatch):
        svc = ghim_hom_nay(monkeypatch, date(2026, 9, 15))

        with pytest.raises(svc.TimeLockError):
            self._khoa(admin, 12, 2026)
        assert not dang_khoa_global(12, 2026)

    def test_khoa_thang_da_qua_van_duoc(self, admin, monkeypatch):
        ghim_hom_nay(monkeypatch, date(2026, 9, 15))

        self._khoa(admin, 8, 2026)
        assert dang_khoa_global(8, 2026)

    def test_ngay_cuoi_thang_van_chua_khoa_duoc(self, admin, monkeypatch):
        svc = ghim_hom_nay(monkeypatch, date(2026, 9, 30))

        with pytest.raises(svc.TimeLockError):
            self._khoa(admin, 9, 2026)

