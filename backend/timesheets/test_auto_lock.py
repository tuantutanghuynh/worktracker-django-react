"""
Test tự động khoá kỳ công khi sang tháng mới.

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
            # Giữ nguyên timezone thật để so sánh datetime không vỡ khi USE_TZ=True
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


def dang_khoa(month, year):
    return TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        job__isnull=True,
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
class TestChiKhoaThangDaQua:

    def test_khoa_dung_thang_vua_ket_thuc(self, admin):
        ket_qua = auto_lock_previous_period(today=date(2026, 9, 3))

        assert ket_qua["status"] == "locked"
        assert (ket_qua["month"], ket_qua["year"]) == (8, 2026)
        assert dang_khoa(8, 2026)

    def test_KHONG_khoa_thang_hien_tai(self, admin):
        """
        Chốt chặn quan trọng nhất của cả tính năng. Khoá nhầm tháng đang
        chấm công thì toàn công ty không log giờ được.
        """
        auto_lock_previous_period(today=date(2026, 9, 3))

        assert not dang_khoa(9, 2026)

    def test_KHONG_khoa_thang_tuong_lai(self, admin):
        auto_lock_previous_period(today=date(2026, 9, 3))

        assert not dang_khoa(10, 2026)

    def test_ngay_dau_thang_van_khoa_duoc_thang_truoc(self, admin):
        """
        Chay dung ngay mung 1: thang truoc vua ket thuc hom qua, phai khoa
        duoc ngay chu khong doi them ngay nao.
        """
        ket_qua = auto_lock_previous_period(today=date(2026, 9, 1))
        assert ket_qua["status"] == "locked"
        assert dang_khoa(8, 2026)

    def test_giao_nam_khoa_thang_12_nam_truoc(self, admin):
        ket_qua = auto_lock_previous_period(today=date(2026, 1, 5))

        assert (ket_qua["month"], ket_qua["year"]) == (12, 2025)
        assert dang_khoa(12, 2025)
        assert not dang_khoa(1, 2026)


@pytest.mark.django_db
class TestChayLaiNhieuLan:
    """
    Beat chạy MỖI NGÀY chứ không chỉ ngày mùng 1 — nếu máy chủ tắt đúng
    mùng 1 thì tháng đó sẽ không bao giờ được khoá. Đổi lại, từ ngày 2 trở
    đi task gặp kỳ đã khoá, và điều đó phải là chuyện bình thường.
    """

    def test_chay_lan_hai_khong_loi(self, admin):
        assert auto_lock_previous_period(today=date(2026, 9, 3))["status"] == "locked"
        assert auto_lock_previous_period(today=date(2026, 9, 4))["status"] == "already_locked"

    def test_khong_tao_them_ban_ghi_trung(self, admin):
        for ngay in range(3, 8):
            auto_lock_previous_period(today=date(2026, 9, ngay))

        so_ban_ghi = TimeLock.objects.filter(
            lock_scope=TimeLock.LockScope.GLOBAL, lock_month=8, lock_year=2026
        ).count()
        assert so_ban_ghi == 1

    def test_khong_ghi_de_len_ky_Admin_da_khoa_tay(self, admin):
        """
        Admin khoá tay trước, task tự động không được đụng vào — nếu ghi đè
        thì lý do và người thực hiện trong lịch sử bị thay mất.
        """
        khoa_global(8, 2026, user=admin)
        goc = TimeLock.objects.get(lock_month=8, lock_year=2026, lock_scope="GLOBAL")

        auto_lock_previous_period(today=date(2026, 9, 3))

        goc.refresh_from_db()
        assert goc.lock_reason != "Automatically locked by the system"


@pytest.mark.django_db
class TestTruongHopBienDoi:

    def test_khong_co_admin_thi_bao_loi_khong_ngat(self, db):
        """
        TimeLock.locked_by la NOT NULL nen phai co nguoi dung ten. Khong co
        Admin thi bo qua va ghi log, KHONG duoc nem ngoai le lam chet task.
        """
        ket_qua = auto_lock_previous_period(today=date(2026, 9, 3))

        assert ket_qua["status"] == "no_admin"
        assert not dang_khoa(8, 2026)

    def test_admin_da_khoa_khong_duoc_dung_ten(self, db):
        role = baker.make("accounts.Role", code="ADMIN")
        baker.make("accounts.CustomUser", role=role, is_active=False)

        assert auto_lock_previous_period(today=date(2026, 9, 3))["status"] == "no_admin"

    def test_ky_da_mo_khoa_thi_khoa_lai(self, admin):
        """
        Admin mở khoá kỳ cũ để sửa số liệu rồi quên khoá lại — lần chạy sau
        của task phải đóng lại. Bản ghi đã tồn tại với is_locked=False.
        """
        khoa_global(8, 2026, is_locked=False, user=admin)

        assert auto_lock_previous_period(today=date(2026, 9, 3))["status"] == "locked"
        assert dang_khoa(8, 2026)

    def test_ghi_ro_day_la_lenh_tu_dong(self, admin):
        """Admin doc lich su phai phan biet duoc khoa tay va khoa tu dong."""
        auto_lock_previous_period(today=date(2026, 9, 3))

        tl = TimeLock.objects.get(lock_month=8, lock_year=2026, lock_scope="GLOBAL")
        assert "Automatically locked" in tl.lock_reason


@pytest.mark.django_db
class TestKhongKhoaTayKyDangDienRa:
    """
    Chốt chặn cho việc khoá TAY qua giao diện Admin.

    GLOBAL lock chặn ghi LogWork ở MỌI job, nên khoá nhầm tháng đang diễn ra
    làm toàn công ty không chấm công được cho tới khi có người mở khoá. Mã
    lỗi CANNOT_LOCK_ACTIVE_PERIOD đã có sẵn trong từ điển lỗi của frontend
    từ lâu, nhưng phía Admin chưa bao giờ kiểm tra — chỉ phía Manager có.
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
        assert not dang_khoa(9, 2026)

    def test_khoa_thang_tuong_lai_bi_tu_choi(self, admin, monkeypatch):
        svc = ghim_hom_nay(monkeypatch, date(2026, 9, 15))

        with pytest.raises(svc.TimeLockError):
            self._khoa(admin, 12, 2026)
        assert not dang_khoa(12, 2026)

    def test_khoa_thang_da_qua_van_duoc(self, admin, monkeypatch):
        """Chốt chặn không được cản trở thao tác hợp lệ."""
        ghim_hom_nay(monkeypatch, date(2026, 9, 15))

        self._khoa(admin, 8, 2026)
        assert dang_khoa(8, 2026)

    def test_ngay_cuoi_thang_van_chua_khoa_duoc(self, admin, monkeypatch):
        """
        Ranh giới: ngày 30/09 vẫn còn trong kỳ tháng 9 — nhân viên còn cả
        ngày hôm đó để chấm công, chưa được khoá.
        """
        svc = ghim_hom_nay(monkeypatch, date(2026, 9, 30))

        with pytest.raises(svc.TimeLockError):
            self._khoa(admin, 9, 2026)
