"""
Test chặn trùng khách hàng.

Hai luật:
  - Tên khách hàng không được trùng (không phân biệt hoa thường, đã cắt
    khoảng trắng).
  - Mã số thuế không được trùng — nó là định danh pháp lý, mỗi mã chỉ thuộc
    về đúng một công ty.

Mỗi lỗi phải nói rõ đang đụng bản ghi nào, và bản ghi đó còn hoạt động hay
đã bị khoá — nếu không Admin sẽ tìm mãi trong danh sách mà không thấy.
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import Permission, RolePermission
from projects.models import Client


@pytest.fixture
def admin_client(db):
    role = baker.make("accounts.Role", code="ADMIN")
    for code in ("client:create", "client:update", "client:view"):
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=role, permission=perm)
    admin = baker.make(
        "accounts.CustomUser", role=role, is_active=True, must_change_password=False
    )
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def khach_cu(db):
    return Client.objects.create(
        client_name="TechCorp Solutions", tax_code="0101234567", is_active=True
    )


def tao(client, ten, ma_so_thue):
    return client.post(
        "/api/admin/clients/",
        {"client_name": ten, "tax_code": ma_so_thue},
        format="json",
    )


@pytest.mark.django_db
class TestTrungTen:

    def test_trung_ten_y_het_thi_bi_chan(self, admin_client, khach_cu):
        r = tao(admin_client, "TechCorp Solutions", "9999900001")
        assert r.status_code == 400
        assert "client_name" in r.data

    def test_khac_hoa_thuong_van_tinh_la_trung(self, admin_client, khach_cu):
        """"techcorp solutions" va "TechCorp Solutions" la cung mot cong ty."""
        r = tao(admin_client, "techcorp solutions", "9999900002")
        assert r.status_code == 400
        assert "client_name" in r.data

    def test_thua_khoang_trang_van_tinh_la_trung(self, admin_client, khach_cu):
        r = tao(admin_client, "  TechCorp Solutions  ", "9999900003")
        assert r.status_code == 400
        assert "client_name" in r.data

    def test_thong_bao_neu_ro_ma_so_thue_cua_ban_ghi_dang_giu_ten(
        self, admin_client, khach_cu
    ):
        """Admin phai tra cuu duoc ban ghi kia ma khong phai tim thu cong."""
        r = tao(admin_client, "TechCorp Solutions", "9999900004")
        assert khach_cu.tax_code in str(r.data["client_name"][0])

    def test_ten_moi_hoan_toan_thi_tao_duoc(self, admin_client, khach_cu):
        r = tao(admin_client, "Cong Ty Hoan Toan Moi", "9999900005")
        assert r.status_code == 201

    def test_ten_da_cat_khoang_trang_truoc_khi_luu(self, admin_client):
        r = tao(admin_client, "   Cong Ty Co Khoang Trang   ", "9999900006")
        assert r.status_code == 201
        assert Client.objects.get(id=r.data["id"]).client_name == "Cong Ty Co Khoang Trang"


@pytest.mark.django_db
class TestTrungMaSoThue:

    def test_trung_ma_so_thue_khac_ten_thi_bi_chan(self, admin_client, khach_cu):
        """
        Đây là tình huống nguy hiểm nhất: hai bản ghi khác tên nhưng cùng mã
        số thuế nghĩa là một trong hai đã nhập sai. Thông báo phải chỉ đích
        danh bản ghi kia để Admin đối chiếu.
        """
        r = tao(admin_client, "Mot Cai Ten Khac Han", "0101234567")
        assert r.status_code == 400
        assert "tax_code" in r.data
        assert "TechCorp Solutions" in str(r.data["tax_code"][0])

    def test_ma_so_thue_khac_hoa_thuong_van_la_trung(self, admin_client):
        Client.objects.create(client_name="Cong Ty A", tax_code="MST001abc")
        r = tao(admin_client, "Cong Ty B", "mst001ABC")
        assert r.status_code == 400
        assert "tax_code" in r.data


@pytest.mark.django_db
class TestBanGhiDaKhoa:
    """
    Client bị xoá là soft-delete (is_active=False), bản ghi vẫn nằm trong DB
    và vẫn giữ tên lẫn mã số thuế. Admin không thấy nó trong danh sách nên
    thông báo bắt buộc phải nói rõ, nếu không họ sẽ tưởng hệ thống lỗi.
    """

    def test_thong_bao_noi_ro_ban_ghi_da_bi_khoa(self, admin_client):
        Client.objects.create(
            client_name="Cong Ty Da Ngung", tax_code="7777700001", is_active=False
        )
        r = tao(admin_client, "Cong Ty Da Ngung", "7777700002")

        assert r.status_code == 400
        thong_bao = str(r.data["client_name"][0])
        assert "deactivated" in thong_bao.lower()
        assert "Reactivate" in thong_bao


@pytest.mark.django_db
class TestRangBuocTangDatabase:
    """
    Lớp chặn cuối: UniqueConstraint(Lower(Trim("client_name"))).

    Serializer chỉ bảo vệ đường đi qua API. Ràng buộc này bắt những đường
    không qua serializer — lệnh seed, shell, script quản trị — và cả trường
    hợp hai request gửi lên đúng cùng lúc mà cả hai đều thấy "chưa trùng".
    """

    def test_ghi_thang_vao_model_van_bi_chan(self, khach_cu):
        from django.db import IntegrityError, transaction

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Client.objects.create(
                    client_name="TechCorp Solutions", tax_code="8888800001"
                )

    def test_khac_hoa_thuong_ghi_thang_cung_bi_chan(self, khach_cu):
        from django.db import IntegrityError, transaction

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Client.objects.create(
                    client_name="techcorp solutions", tax_code="8888800002"
                )

    def test_khoang_trang_thua_ghi_thang_cung_bi_chan(self, khach_cu):
        """Nho Trim() trong rang buoc."""
        from django.db import IntegrityError, transaction

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Client.objects.create(
                    client_name="  TechCorp Solutions  ", tax_code="8888800003"
                )

    def test_ten_khac_han_ghi_thang_van_duoc(self, khach_cu):
        Client.objects.create(client_name="Cong Ty Rat Khac", tax_code="8888800004")
        assert Client.objects.filter(client_name="Cong Ty Rat Khac").exists()


@pytest.mark.django_db
class TestSuaKhachHangCu:

    def test_sua_chinh_no_giu_nguyen_ten_thi_khong_bi_chan(self, admin_client, khach_cu):
        """
        Bẫy kinh điển: phép kiểm tra trùng quên loại chính bản ghi đang sửa
        ra, nên sửa số điện thoại mà giữ nguyên tên cũng bị báo "tên đã tồn
        tại" — chính nó đang dùng.
        """
        r = admin_client.patch(
            f"/api/admin/clients/{khach_cu.id}/",
            {"client_name": khach_cu.client_name, "industry": "Technology"},
            format="json",
        )
        assert r.status_code == 200

    def test_sua_sang_ten_cua_khach_khac_thi_bi_chan(self, admin_client, khach_cu):
        khac = Client.objects.create(client_name="Cong Ty Khac", tax_code="2222200001")
        r = admin_client.patch(
            f"/api/admin/clients/{khac.id}/",
            {"client_name": "TechCorp Solutions"},
            format="json",
        )
        assert r.status_code == 400
        assert "client_name" in r.data

    def test_sua_sang_ma_so_thue_cua_khach_khac_thi_bi_chan(self, admin_client, khach_cu):
        khac = Client.objects.create(client_name="Cong Ty Khac", tax_code="2222200002")
        r = admin_client.patch(
            f"/api/admin/clients/{khac.id}/",
            {"tax_code": khach_cu.tax_code},
            format="json",
        )
        assert r.status_code == 400
        assert "tax_code" in r.data
        assert khach_cu.client_name in str(r.data["tax_code"][0])

    def test_sua_chinh_no_giu_nguyen_ma_so_thue_thi_khong_bi_chan(
        self, admin_client, khach_cu
    ):
        r = admin_client.patch(
            f"/api/admin/clients/{khach_cu.id}/",
            {"tax_code": khach_cu.tax_code, "industry": "Banking"},
            format="json",
        )
        assert r.status_code == 200

    def test_sua_ten_khac_hoa_thuong_cua_khach_khac_van_bi_chan(
        self, admin_client, khach_cu
    ):
        khac = Client.objects.create(client_name="Cong Ty Khac", tax_code="2222200003")
        r = admin_client.patch(
            f"/api/admin/clients/{khac.id}/",
            {"client_name": khach_cu.client_name.lower()},
            format="json",
        )
        assert r.status_code == 400
        assert "client_name" in r.data
