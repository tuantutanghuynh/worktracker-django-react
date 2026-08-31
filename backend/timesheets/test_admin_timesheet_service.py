"""
Unit test cho timesheets/services/admin_timesheet_service.py.

File này trước đây KHÔNG có test nào, dù chứa toàn bộ công thức của trang
Timesheet Control (missing_days, avg_per_day, 4 trạng thái NORMAL / WARNING
/ MISSING / OVER_LIMIT). Đây là chỗ dễ sai nhất vì mọi con số đều phụ thuộc
"hôm nay là ngày mấy" — nên test phải cố định mốc thời gian, không được để
chạy hôm nay đúng, mai sai.
"""
from datetime import date, datetime
from decimal import Decimal

import pytest
from model_bakery import baker

from accounts.models import CustomUser, Role, EmployeeProfile
from timesheets.models import LogWork, DailyUserTimesheet
from timesheets.services import admin_timesheet_service as svc


@pytest.fixture
def employee_role(db):
    return Role.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Employee"})[0]


@pytest.fixture
def task(db):
    """LogWork.task la NOT NULL nen moi log deu phai gan vao mot Task that.
    Dung baker de tu sinh ca chuoi Client -> Job -> Task."""
    return baker.make("tasks.Task")


@pytest.fixture
def employee(db, employee_role):
    user = CustomUser.objects.create_user(
        email="emp.timesheet@test.com",
        password="Test@1234",
        role=employee_role,
        is_active=True,
    )
    EmployeeProfile.objects.create(user=user, full_name="Nhan Vien Test")
    return user


def freeze_today(monkeypatch, fake_today):
    """
    Ép timezone.now() bên trong service trả về một ngày cố định.

    Service gọi timezone.now().date() để biết "đã trôi qua bao nhiêu ngày
    làm việc". Không ghim lại thì test sẽ đổi kết quả theo ngày chạy.

    Lưu ý cách vá: thay HẲN cái tên `timezone` trong namespace của service,
    KHÔNG được sửa thuộc tính `now` của module django.utils.timezone thật.
    Module đó dùng chung cả project — vá vào đó thì auto_now_add của mọi
    model cũng nhận giá trị giả và việc lưu bản ghi sẽ vỡ.
    """

    class _FakeTimezone:
        @staticmethod
        def now():
            # Trả về datetime thật để .date() hoạt động đúng như bản gốc
            return datetime(fake_today.year, fake_today.month, fake_today.day, 12, 0)

    monkeypatch.setattr(svc, "timezone", _FakeTimezone)


class TestGetMonthRange:
    def test_thang_31_ngay(self):
        assert svc.get_month_range(1, 2026) == (date(2026, 1, 1), date(2026, 1, 31))

    def test_thang_2_nam_thuong(self):
        assert svc.get_month_range(2, 2026) == (date(2026, 2, 1), date(2026, 2, 28))

    def test_thang_2_nam_nhuan(self):
        assert svc.get_month_range(2, 2028) == (date(2028, 2, 1), date(2028, 2, 29))


class TestGetElapsedWorkingDays:
    """
    Hàm gốc sinh ra mọi con số "thiếu ngày". Ba mốc phải phân biệt rõ:
    tháng tương lai, tháng đang diễn ra, tháng đã kết thúc.
    """

    def test_thang_tuong_lai_tra_ve_0(self, monkeypatch):
        freeze_today(monkeypatch, date(2026, 5, 10))
        start, end = svc.get_month_range(8, 2026)
        assert svc.get_elapsed_working_days(start, end) == 0

    def test_thang_da_qua_tinh_het_thang(self, monkeypatch):
        freeze_today(monkeypatch, date(2026, 5, 10))
        start, end = svc.get_month_range(3, 2026)
        assert svc.get_elapsed_working_days(start, end) == svc.calculate_working_days(start, end)

    def test_thang_hien_tai_chi_tinh_toi_hom_nay(self, monkeypatch):
        # Giữa tháng chỉ đếm tới hôm nay, KHÔNG lấy cả tháng. Đây chính là
        # bug cũ khiến giữa tháng ai cũng bị gắn MISSING dù đã log đủ.
        freeze_today(monkeypatch, date(2026, 5, 15))
        start, end = svc.get_month_range(5, 2026)
        elapsed = svc.get_elapsed_working_days(start, end)
        assert elapsed == svc.calculate_working_days(date(2026, 5, 1), date(2026, 5, 15))
        assert elapsed < svc.calculate_working_days(start, end)

    def test_ngay_dau_thang_van_tinh_duoc(self, monkeypatch):
        # 1/5/2026 là thứ Sáu -> đã trôi qua đúng 1 ngày làm việc
        freeze_today(monkeypatch, date(2026, 5, 1))
        start, end = svc.get_month_range(5, 2026)
        assert svc.get_elapsed_working_days(start, end) == 1


@pytest.mark.django_db
class TestEmployeeTimesheetList:
    """
    Bảng Timesheet Control. Mỗi test dựng đúng một tình huống để kiểm tra
    service gắn đúng 1 trong 4 trạng thái.

    Mốc dùng chung: 9/5/2026 (thứ Bảy). Từ 1/5 đến 9/5 có 8 ngày làm việc
    theo lịch Mon-Sat của hệ thống — trừ Chủ nhật 3/5.
    """

    NGAY_LAM_VIEC = [1, 2, 4, 5, 6, 7, 8, 9]

    def _log(self, user, task, day, hours, month=5, year=2026):
        """Ghi cả LogWork lẫn DailyUserTimesheet — service đọc cả hai bảng."""
        work_date = date(year, month, day)
        LogWork.objects.create(
            user=user,
            task=task,
            work_date=work_date,
            hours_spent=Decimal(str(hours)),
            description="test",
            review_status=LogWork.ReviewStatus.APPROVED,
        )
        row, _ = DailyUserTimesheet.objects.get_or_create(
            user=user, work_date=work_date, defaults={"total_hours": Decimal("0")}
        )
        row.total_hours = row.total_hours + Decimal(str(hours))
        row.save()

    def _row_of(self, employee, month=5, year=2026):
        rows = svc.get_admin_employee_timesheet_list(month=month, year=year)
        return next(r for r in rows if r["user_id"] == employee.id)

    def test_khong_log_gi_thi_missing(self, monkeypatch, employee):
        freeze_today(monkeypatch, date(2026, 5, 15))
        row = self._row_of(employee)
        assert row["status"] == "MISSING"
        assert row["missing_days"] > 0
        assert row["month_hours"] == 0

    def test_log_du_moi_ngay_thi_normal(self, monkeypatch, employee, task):
        freeze_today(monkeypatch, date(2026, 5, 9))
        for d in self.NGAY_LAM_VIEC:
            self._log(employee, task, d, 8)
        row = self._row_of(employee)
        assert row["missing_days"] == 0
        assert row["status"] == "NORMAL"
        assert row["avg_per_day"] == 8.0

    def test_log_qua_8h_mot_ngay_thi_over_limit(self, monkeypatch, employee, task):
        freeze_today(monkeypatch, date(2026, 5, 9))
        for d in self.NGAY_LAM_VIEC:
            self._log(employee, task, d, 8)
        self._log(employee, task, 9, 3)  # ngày 9 thành 11h -> vượt ngưỡng 8h
        row = self._row_of(employee)
        assert row["violations"] == 1
        assert row["status"] == "OVER_LIMIT"

    def test_log_du_ngay_nhung_thieu_gio_thi_warning(self, monkeypatch, employee, task):
        # Có mặt đủ 8 ngày nên không MISSING, nhưng chỉ 4h/ngày = 50% chỉ
        # tiêu, dưới ngưỡng 80% -> WARNING
        freeze_today(monkeypatch, date(2026, 5, 9))
        for d in self.NGAY_LAM_VIEC:
            self._log(employee, task, d, 4)
        row = self._row_of(employee)
        assert row["missing_days"] == 0
        assert row["violations"] == 0
        assert row["status"] == "WARNING"

    def test_avg_per_day_khong_bi_thoi_phong_boi_log_ngay_tuong_lai(self, monkeypatch, employee, task):
        """
        Chốt chặn cho bug cũ: backend KHÔNG cấm log ngày tương lai. Nếu tử số
        lấy cả tháng còn mẫu số chỉ tính tới hôm nay thì avg vọt lên vô lý
        (từng ra 10.4h/ngày). Tử và mẫu phải cùng một khoảng thời gian.
        """
        freeze_today(monkeypatch, date(2026, 5, 9))
        for d in self.NGAY_LAM_VIEC:
            self._log(employee, task, d, 8)
        self._log(employee, task, 28, 8)  # log trước cho ngày cuối tháng

        row = self._row_of(employee)
        assert row["month_hours"] == 72  # cả tháng: 8*8 + 8
        assert row["avg_per_day"] == 8.0  # nhưng trung bình vẫn đúng 8h

    def test_log_bi_VOIDED_khong_duoc_tinh_gio(self, monkeypatch, employee, task):
        freeze_today(monkeypatch, date(2026, 5, 9))
        LogWork.objects.create(
            user=employee,
            task=task,
            work_date=date(2026, 5, 4),
            hours_spent=Decimal("8"),
            description="huy",
            review_status=LogWork.ReviewStatus.VOIDED,
        )
        row = self._row_of(employee)
        assert row["month_hours"] == 0


@pytest.mark.django_db
class TestAdminTimesheetSummary:
    def test_thang_rong_tra_ve_so_0_khong_loi(self, monkeypatch, employee):
        freeze_today(monkeypatch, date(2026, 5, 15))
        data = svc.get_admin_timesheet_summary(month=5, year=2026)
        assert data["total_logged_hours"] == 0
        assert data["active_employees"] == 0
        assert data["timesheet_violations"] == 0
        assert data["missing_timesheets"] > 0  # chưa ai log -> đều thiếu

    def test_thang_tuong_lai_khong_bao_thieu(self, monkeypatch, employee):
        """Tháng chưa tới thì không được coi là ai đó chấm công thiếu."""
        freeze_today(monkeypatch, date(2026, 5, 15))
        data = svc.get_admin_timesheet_summary(month=9, year=2026)
        assert data["missing_timesheets"] == 0


@pytest.mark.django_db
class TestJoinedDate:
    """
    Nhân viên vào làm giữa tháng không được tính thiếu công những ngày họ
    chưa thuộc công ty. Trường joined_date đã có sẵn trong model từ lâu
    nhưng trước đây không chỗ nào trong phần tính công dùng tới.
    """

    def test_vao_lam_giua_thang_thi_moc_dem_doi_theo(self, monkeypatch):
        freeze_today(monkeypatch, date(2026, 5, 15))
        start, end = svc.get_month_range(5, 2026)

        tu_dau_thang = svc.get_elapsed_working_days(start, end)
        tu_ngay_vao = svc.get_elapsed_working_days(start, end, date(2026, 5, 11))

        assert tu_ngay_vao < tu_dau_thang
        assert tu_ngay_vao == svc.calculate_working_days(date(2026, 5, 11), date(2026, 5, 15))

    def test_vao_lam_truoc_thang_thi_khong_anh_huong(self, monkeypatch):
        freeze_today(monkeypatch, date(2026, 5, 15))
        start, end = svc.get_month_range(5, 2026)

        assert svc.get_elapsed_working_days(start, end, date(2020, 1, 1)) == (
            svc.get_elapsed_working_days(start, end)
        )

    def test_vao_lam_sau_hom_nay_thi_chua_co_ngay_cong_nao(self, monkeypatch):
        freeze_today(monkeypatch, date(2026, 5, 15))
        start, end = svc.get_month_range(5, 2026)
        assert svc.get_elapsed_working_days(start, end, date(2026, 5, 25)) == 0

    def test_nhan_vien_moi_khong_bi_bao_thieu_cong(self, monkeypatch, employee, task):
        """
        Tình huống thật: vào làm 11/5, hôm nay 15/5, đã log đủ từ ngày vào.
        Trước khi sửa, người này bị tính thiếu cả tuần đầu tháng -> MISSING.
        """
        freeze_today(monkeypatch, date(2026, 5, 15))
        employee.profile.joined_date = date(2026, 5, 11)
        employee.profile.save()

        # 11..15/5/2026 la thu Hai -> thu Sau, deu la ngay lam viec
        for d in [11, 12, 13, 14, 15]:
            self_log(employee, task, d, 8)

        row = next(
            r for r in svc.get_admin_employee_timesheet_list(month=5, year=2026)
            if r["user_id"] == employee.id
        )
        assert row["missing_days"] == 0
        assert row["status"] == "NORMAL"
        assert row["avg_per_day"] == 8.0


def self_log(user, task, day, hours, month=5, year=2026):
    """Ban dung chung cua TestEmployeeTimesheetList._log."""
    work_date = date(year, month, day)
    LogWork.objects.create(
        user=user, task=task, work_date=work_date,
        hours_spent=Decimal(str(hours)), description="test",
        review_status=LogWork.ReviewStatus.APPROVED,
    )
    row, _ = DailyUserTimesheet.objects.get_or_create(
        user=user, work_date=work_date, defaults={"total_hours": Decimal("0")}
    )
    row.total_hours = row.total_hours + Decimal(str(hours))
    row.save()
