"""
Test chống trùng khi tạo/sửa Job.

Bug nghiêm trọng nhất được canh ở đây: Job.job_code có unique=True và cho
phép NULL. Postgres chấp nhận nhiều NULL dưới một ràng buộc unique, nhưng
chuỗi rỗng '' KHÔNG phải NULL — nên tạo Job thứ hai với ô Job Code bỏ trống
sẽ đụng ràng buộc và vỡ thành lỗi 500 kèm nguyên traceback, thay vì một
thông báo 400 đọc được.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
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


# Ngay phai tinh theo hom nay chu khong hardcode: JobSerializer.validate()
# chan start_date som hon ngay tao Client, ma Client trong fixture duoc tao
# ngay luc chay test.
HOM_NAY = timezone.localdate()


def tao_job(client, boi_canh, ten, code=None):
    payload = {
        "job_name": ten,
        "client": boi_canh["client"].id,
        "manager": boi_canh["manager"].id,
        "priority": "MEDIUM",
        "status": "PLANNING",
        "start_date": str(HOM_NAY),
        "deadline": str(HOM_NAY + timedelta(days=90)),
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


@pytest.mark.django_db
class TestJobTheoClient:
    """
    Man hinh "Jobs of this client" mo tu trang Clients: loc bang ?client=<id>
    o backend chu khong tai het roi loc tren trinh duyet — neu loc o frontend
    thi so trang va tong so dem deu sai.
    """

    def test_chi_tra_ve_job_cua_dung_client_do(self, admin_client, boi_canh):
        khach_khac = baker.make("projects.Client", client_name="Khach Hang B", tax_code="0100000002")
        tao_job(admin_client, boi_canh, "Job Cua A")

        r = admin_client.get(f"/api/admin/jobs/?client={boi_canh['client'].id}")
        assert r.status_code == 200
        assert r.data["count"] == 1
        assert r.data["results"][0]["job_name"] == "Job Cua A"

        r2 = admin_client.get(f"/api/admin/jobs/?client={khach_khac.id}")
        assert r2.data["count"] == 0

    def test_khong_truyen_client_thi_tra_ve_het(self, admin_client, boi_canh):
        tao_job(admin_client, boi_canh, "Job Mot")
        tao_job(admin_client, boi_canh, "Job Hai")

        assert admin_client.get("/api/admin/jobs/").data["count"] == 2


@pytest.mark.django_db
class TestStartDateSoVoiNgayTaoClient:
    """
    Job khong the bat dau TRUOC khi khach hang ton tai trong he thong.
    """

    def test_start_date_truoc_ngay_tao_client_bi_chan(self, admin_client, boi_canh):
        r = admin_client.post(
            "/api/admin/jobs/",
            {
                "job_name": "Job Qua Khu",
                "client": boi_canh["client"].id,
                "manager": boi_canh["manager"].id,
                "priority": "MEDIUM",
                "start_date": str(HOM_NAY - timedelta(days=1)),
                "deadline": str(HOM_NAY + timedelta(days=30)),
            },
            format="json",
        )
        assert r.status_code == 400
        assert "start_date" in r.data

    def test_dung_ngay_tao_client_thi_tao_duoc(self, admin_client, boi_canh):
        assert tao_job(admin_client, boi_canh, "Job Dung Ngay").status_code == 201

    def test_sua_job_cu_vi_pham_van_khong_bi_chan(self, admin_client, boi_canh):
        """
        Du lieu cu (seed) co the co start_date som hon ngay tao client. Neu
        bat moi lan update thi nhung job do bi khoa cung — doi status hay doi
        manager cung 400 trong khi nguoi dung khong he dong vao ngay.
        """
        job = baker.make(
            "projects.Job",
            client=boi_canh["client"],
            manager=boi_canh["manager"],
            job_name="Job Seed Cu",
            status="PLANNING",
            start_date=HOM_NAY - timedelta(days=365),
            deadline=HOM_NAY + timedelta(days=30),
        )

        r = admin_client.patch(
            f"/api/admin/jobs/{job.id}/", {"status": "ACTIVE"}, format="json"
        )
        assert r.status_code == 200

    def test_sua_start_date_sang_gia_tri_moi_van_bi_chan(self, admin_client, boi_canh):
        r = tao_job(admin_client, boi_canh, "Job Goc")
        r2 = admin_client.patch(
            f"/api/admin/jobs/{r.data['id']}/",
            {"start_date": str(HOM_NAY - timedelta(days=10))},
            format="json",
        )
        assert r2.status_code == 400
        assert "start_date" in r2.data
