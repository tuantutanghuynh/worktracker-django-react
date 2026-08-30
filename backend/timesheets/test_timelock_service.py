"""
Test khoá kỳ công (TimeLock).

timelock_manager_service.py dài hơn 500 dòng và quyết định việc chốt sổ công —
sai ở đây là sai tiền lương — nhưng trước đó không có một test nào.

Hai tầng khoá độc lập:
  GLOBAL : Admin khoá toàn công ty cho một tháng
  JOB    : Manager khoá riêng một dự án cho một tháng
Chỉ cần MỘT trong hai bật là kỳ đó đóng.
"""
from datetime import date

import pytest
from model_bakery import baker

from timesheets.models import TimeLock
from timesheets.services import timelock_manager_service as svc


@pytest.fixture
def job(db):
    return baker.make("projects.Job")


@pytest.fixture
def job_khac(db):
    return baker.make("projects.Job")


def khoa_global(month, year, is_locked=True):
    return baker.make(
        "timesheets.TimeLock",
        job=None,
        lock_scope=TimeLock.LockScope.GLOBAL,
        lock_month=month,
        lock_year=year,
        is_locked=is_locked,
    )


def khoa_job(job, month, year, is_locked=True):
    return baker.make(
        "timesheets.TimeLock",
        job=job,
        lock_scope=TimeLock.LockScope.JOB,
        lock_month=month,
        lock_year=year,
        is_locked=is_locked,
    )


class TestGetPeriodFromDate:
    def test_tach_dung_thang_nam(self):
        assert svc.get_period_from_date(date(2026, 3, 15)) == (3, 2026)

    def test_ngay_cuoi_thang_van_thuoc_thang_do(self):
        assert svc.get_period_from_date(date(2026, 12, 31)) == (12, 2026)


@pytest.mark.django_db
class TestKhoaGlobal:

    def test_chua_co_ban_ghi_thi_ky_mo(self, job):
        assert svc.is_global_period_locked(3, 2026) is False

    def test_co_ban_ghi_is_locked_true_thi_ky_dong(self):
        khoa_global(3, 2026)
        assert svc.is_global_period_locked(3, 2026) is True

    def test_ban_ghi_is_locked_false_thi_ky_van_mo(self):
        """Mở khoá là đặt is_locked=False, không xoá bản ghi — lịch sử phải giữ."""
        khoa_global(3, 2026, is_locked=False)
        assert svc.is_global_period_locked(3, 2026) is False

    def test_khoa_thang_nay_khong_anh_huong_thang_khac(self):
        khoa_global(3, 2026)
        assert svc.is_global_period_locked(4, 2026) is False

    def test_khoa_nam_nay_khong_anh_huong_nam_khac(self):
        """Bẫy kinh điển: chỉ so tháng mà quên năm -> khoá tháng 3/2026 làm
        đóng luôn tháng 3/2025."""
        khoa_global(3, 2026)
        assert svc.is_global_period_locked(3, 2025) is False


@pytest.mark.django_db
class TestKhoaJob:

    def test_chua_co_ban_ghi_thi_ky_mo(self, job):
        assert svc.is_job_period_locked(job.id, 3, 2026) is False

    def test_khoa_job_nay_khong_anh_huong_job_khac(self, job, job_khac):
        khoa_job(job, 3, 2026)
        assert svc.is_job_period_locked(job.id, 3, 2026) is True
        assert svc.is_job_period_locked(job_khac.id, 3, 2026) is False

    def test_mo_khoa_lai_thi_ky_mo_lai(self, job):
        """
        Mở khoá cập nhật is_locked trên chính bản ghi cũ chứ không tạo bản mới
        — model có ràng buộc unique (lock_month, lock_year, job_id) nên mỗi
        job/tháng chỉ tồn tại đúng một dòng.

        Ràng buộc đó cũng khiến `.order_by("-id").first()` trong service trở
        thành thừa: không bao giờ có quá một bản ghi để mà chọn.
        """
        lock = khoa_job(job, 3, 2026, is_locked=True)
        assert svc.is_job_period_locked(job.id, 3, 2026) is True

        lock.is_locked = False
        lock.save()
        assert svc.is_job_period_locked(job.id, 3, 2026) is False


@pytest.mark.django_db
class TestKetHopHaiTang:
    """is_period_locked = GLOBAL HOẶC JOB."""

    def test_ca_hai_deu_mo_thi_ky_mo(self, job):
        assert svc.is_period_locked(job.id, 3, 2026) is False

    def test_chi_global_khoa_thi_ky_dong(self, job):
        khoa_global(3, 2026)
        assert svc.is_period_locked(job.id, 3, 2026) is True

    def test_chi_job_khoa_thi_ky_dong(self, job):
        khoa_job(job, 3, 2026)
        assert svc.is_period_locked(job.id, 3, 2026) is True

    def test_global_khoa_thi_job_mo_cung_khong_cuu_duoc(self, job):
        """
        Quan trọng: Manager mở khoá dự án của mình KHÔNG được phép vượt qua
        lệnh khoá toàn công ty của Admin. Nếu không, việc chốt sổ lương của
        Admin có thể bị một Manager vô hiệu hoá.
        """
        khoa_global(3, 2026, is_locked=True)
        khoa_job(job, 3, 2026, is_locked=False)
        assert svc.is_period_locked(job.id, 3, 2026) is True


@pytest.mark.django_db
class TestChanGhiVaoKyDaKhoa:
    """assert_period_open_for_job() — hàng rào mọi thao tác ghi phải đi qua."""

    def test_ky_mo_thi_khong_nem_loi(self, job):
        svc.assert_period_open_for_job(job.id, date(2026, 3, 15))

    def test_ky_bi_global_khoa_thi_nem_loi(self, job):
        khoa_global(3, 2026)
        with pytest.raises(svc.TimeLockError) as exc:
            svc.assert_period_open_for_job(job.id, date(2026, 3, 15))
        assert "GLOBAL_PERIOD_IS_LOCKED" in str(exc.value)

    def test_ky_bi_job_khoa_thi_nem_loi(self, job):
        khoa_job(job, 3, 2026)
        with pytest.raises(svc.TimeLockError) as exc:
            svc.assert_period_open_for_job(job.id, date(2026, 3, 15))
        assert "JOB_PERIOD_IS_LOCKED" in str(exc.value)

    def test_khoa_thang_3_khong_chan_ghi_thang_4(self, job):
        """Khoá phải đúng phạm vi một tháng, không được lan sang tháng khác."""
        khoa_global(3, 2026)
        svc.assert_period_open_for_job(job.id, date(2026, 4, 1))

    def test_ngay_cuoi_thang_van_bi_chan(self, job):
        """Ranh giới: 31/3 vẫn thuộc kỳ tháng 3."""
        khoa_global(3, 2026)
        with pytest.raises(svc.TimeLockError):
            svc.assert_period_open_for_job(job.id, date(2026, 3, 31))


@pytest.mark.django_db
class TestValidateThangNam:

    @pytest.mark.parametrize("thang", [0, 13, -1, 99])
    def test_thang_khong_hop_le_bi_tu_choi(self, thang):
        with pytest.raises(Exception):
            svc.validate_month_year(thang, 2026)

    @pytest.mark.parametrize("thang", [1, 6, 12])
    def test_thang_hop_le_duoc_chap_nhan(self, thang):
        svc.validate_month_year(thang, 2026)
