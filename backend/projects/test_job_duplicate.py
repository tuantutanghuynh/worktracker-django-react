"""
Test chống trùng khi tạo/sửa Job.

Bug nghiêm trọng nhất được canh ở đây: Job.job_code có unique=True và cho
phép NULL. Postgres chấp nhận nhiều NULL dưới một ràng buộc unique, nhưng
chuỗi rỗng '' KHÔNG phải NULL — nên tạo Job thứ hai với ô Job Code bỏ trống
sẽ đụng ràng buộc và vỡ thành lỗi 500 kèm nguyên traceback, thay vì một
thông báo 400 đọc được.
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import Permission, RolePermission
from projects.models import Job


@pytest.fixture
def admin_client(db):
    role = baker.make("accounts.Role", code="ADMIN")
    for code in ("job:create", "job:update", "job:view"):
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=role, permission=perm)
    admin = baker.make(
        "accounts.CustomUser", role=role, is_active=True, must_change_password=False
    )
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def boi_canh(db):
    manager_role = baker.make("accounts.Role", code="MANAGER")
    return {
        "client": baker.make("projects.Client", client_name="Khach Hang A", tax_code="0100000001"),
        "manager": baker.make("accounts.CustomUser", role=manager_role, is_active=True),
    }


def tao_job(client, boi_canh, ten, code=None):
    payload = {
        "job_name": ten,
        "client": boi_canh["client"].id,
        "manager": boi_canh["manager"].id,
        "priority": "MEDIUM",
        "status": "PLANNING",
        "start_date": "2026-09-01",
        "deadline": "2026-12-01",
    }
    if code is not None:
        payload["job_code"] = code
    return client.post("/api/admin/jobs/", payload, format="json")


@pytest.mark.django_db
class TestJobCodeBoTrong:
    """
    Job Code là trường KHÔNG bắt buộc, nên bỏ trống nhiều lần phải là chuyện
    bình thường.
    """

    def test_hai_job_cung_bo_trong_deu_tao_duoc(self, admin_client, boi_canh):
        assert tao_job(admin_client, boi_canh, "Job A", "").status_code == 201
        assert tao_job(admin_client, boi_canh, "Job B", "").status_code == 201

    def test_bo_trong_duoc_luu_thanh_NULL_khong_phai_chuoi_rong(
        self, admin_client, boi_canh
    ):
        """
        Mấu chốt của cả bug: '' đụng ràng buộc unique, NULL thì không.
        """
        r = tao_job(admin_client, boi_canh, "Job Trong", "")
        assert r.status_code == 201
        assert Job.objects.get(id=r.data["id"]).job_code is None

    def test_khong_gui_truong_job_code_cung_duoc(self, admin_client, boi_canh):
        r = tao_job(admin_client, boi_canh, "Job Khong Gui")
        assert r.status_code == 201
        assert Job.objects.get(id=r.data["id"]).job_code is None

    def test_chi_co_khoang_trang_cung_thanh_NULL(self, admin_client, boi_canh):
        r = tao_job(admin_client, boi_canh, "Job Khoang Trang", "   ")
        assert r.status_code == 201
        assert Job.objects.get(id=r.data["id"]).job_code is None


@pytest.mark.django_db
class TestJobCodeTrung:

    def test_trung_y_het_bi_chan(self, admin_client, boi_canh):
        tao_job(admin_client, boi_canh, "Job Goc", "JOB-001")
        r = tao_job(admin_client, boi_canh, "Job Sau", "JOB-001")

        assert r.status_code == 400
        assert "job_code" in r.data

    def test_khac_hoa_thuong_van_tinh_la_trung(self, admin_client, boi_canh):
        tao_job(admin_client, boi_canh, "Job Goc", "JOB-001")
        r = tao_job(admin_client, boi_canh, "Job Sau", "job-001")

        assert r.status_code == 400
        assert "job_code" in r.data

    def test_thong_bao_neu_ro_job_nao_dang_giu_ma(self, admin_client, boi_canh):
        """Admin phai tim ra Job kia ma khong phai tra thu cong."""
        tao_job(admin_client, boi_canh, "Job Giu Ma", "JOB-001")
        r = tao_job(admin_client, boi_canh, "Job Sau", "JOB-001")

        thong_bao = str(r.data["job_code"][0])
        assert "Job Giu Ma" in thong_bao

    def test_ma_moi_hoan_toan_thi_tao_duoc(self, admin_client, boi_canh):
        tao_job(admin_client, boi_canh, "Job Goc", "JOB-001")
        assert tao_job(admin_client, boi_canh, "Job Khac", "JOB-002").status_code == 201


@pytest.mark.django_db
class TestSuaJob:

    def test_sua_chinh_no_giu_nguyen_ma_khong_bi_chan(self, admin_client, boi_canh):
        """
        Bẫy kinh điển: quên loại chính bản ghi đang sửa ra khỏi phép kiểm tra
        trùng — đổi tên mà giữ nguyên job code cũng bị báo "đã tồn tại".
        """
        r = tao_job(admin_client, boi_canh, "Job Goc", "JOB-001")
        job_id = r.data["id"]

        r2 = admin_client.patch(
            f"/api/admin/jobs/{job_id}/",
            {"job_code": "JOB-001", "job_name": "Ten Moi"},
            format="json",
        )
        assert r2.status_code == 200

    def test_sua_sang_ma_cua_job_khac_bi_chan(self, admin_client, boi_canh):
        tao_job(admin_client, boi_canh, "Job Mot", "JOB-001")
        r = tao_job(admin_client, boi_canh, "Job Hai", "JOB-002")

        r2 = admin_client.patch(
            f"/api/admin/jobs/{r.data['id']}/", {"job_code": "JOB-001"}, format="json"
        )
        assert r2.status_code == 400
        assert "job_code" in r2.data


@pytest.mark.django_db
class TestDepartmentTrungTen:
    """
    Department.name có unique=True nhưng chỉ so khớp CHÍNH XÁC, nên "IT" và
    "it" vẫn tạo được thành hai phòng ban khác nhau.
    """

    @pytest.fixture
    def admin_dept_client(self, db):
        role = baker.make("accounts.Role", code="ADMIN")
        for code in ("department:create", "department:update", "department:view"):
            perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
            RolePermission.objects.get_or_create(role=role, permission=perm)
        admin = baker.make(
            "accounts.CustomUser", role=role, is_active=True, must_change_password=False
        )
        c = APIClient()
        c.force_authenticate(user=admin)
        return c

    def _tao(self, client, ten):
        return client.post("/api/auth/departments/", {"name": ten}, format="json")

    def test_trung_y_het_bi_chan(self, admin_dept_client):
        self._tao(admin_dept_client, "Information Technology")
        assert self._tao(admin_dept_client, "Information Technology").status_code == 400

    @pytest.mark.parametrize("ten", ["information technology", "INFORMATION TECHNOLOGY"])
    def test_khac_hoa_thuong_van_tinh_la_trung(self, admin_dept_client, ten):
        self._tao(admin_dept_client, "Information Technology")
        r = self._tao(admin_dept_client, ten)

        assert r.status_code == 400
        assert "name" in r.data

    def test_khoang_trang_thua_van_tinh_la_trung(self, admin_dept_client):
        self._tao(admin_dept_client, "Information Technology")
        assert self._tao(admin_dept_client, "  Information Technology  ").status_code == 400

    def test_ten_khac_han_thi_tao_duoc(self, admin_dept_client):
        self._tao(admin_dept_client, "Information Technology")
        assert self._tao(admin_dept_client, "Digital Marketing").status_code == 201

    def test_rang_buoc_DB_chan_ca_khi_ghi_thang_vao_model(self, admin_dept_client):
        """Lop chan cuoi cho seed/shell/hai request cung luc."""
        from django.db import IntegrityError, transaction

        from accounts.models import Department

        Department.objects.create(name="Phong Ky Thuat")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Department.objects.create(name="phong ky thuat")
