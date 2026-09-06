"""
Test chuẩn hoá email ở phần Admin.

Vấn đề gốc: CustomUser.email là unique=True — so khớp CHÍNH XÁC. Nên
"Admin@x.com" và "admin@x.com" là hai tài khoản khác nhau, và người dùng
phải gõ đúng y hệt hoa thường lúc tạo mới đăng nhập được.

Chuẩn hoá tại tầng serializer của Admin: mọi email ghi xuống DB đều là chữ
thường. KHÔNG đụng tới phần đăng nhập (accounts/auth/) — đó là phần của
anh Tú, anh ấy tự sửa.
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import CustomUser, Permission, RolePermission


@pytest.fixture
def roles(db):
    return {
        "admin": baker.make("accounts.Role", code="ADMIN"),
        "employee": baker.make("accounts.Role", code="EMPLOYEE"),
    }


@pytest.fixture
def admin_client(db, roles):
    for code in ("user:create", "user:update", "user:view"):
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=roles["admin"], permission=perm)
    admin = baker.make(
        "accounts.CustomUser",
        email="quantri@test.com",
        role=roles["admin"],
        is_active=True,
        must_change_password=False,
    )
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


def tao(client, email, role):
    return client.post(
        "/api/auth/users/",
        {"email": email, "password": "Tam@12345", "role": role.id},
        format="json",
    )


@pytest.mark.django_db
class TestTaoUser:

    def test_email_chu_hoa_duoc_luu_thanh_chu_thuong(self, admin_client, roles):
        r = tao(admin_client, "NguoiMoi.TEST@Demo.VN", roles["employee"])
        assert r.status_code == 201
        assert CustomUser.objects.filter(email="nguoimoi.test@demo.vn").exists()
        assert not CustomUser.objects.filter(email="NguoiMoi.TEST@Demo.VN").exists()

    def test_khoang_trang_thua_bi_cat(self, admin_client, roles):
        r = tao(admin_client, "   CoKhoangTrang@Demo.VN   ", roles["employee"])
        assert r.status_code == 201
        assert CustomUser.objects.filter(email="cokhoangtrang@demo.vn").exists()

    def test_trung_email_khac_hoa_thuong_bi_chan(self, admin_client, roles):
        """
        Không có bước này thì UniqueValidator của DRF (so khớp chính xác) cho
        qua, rồi vỡ ở tầng database thành lỗi 500 thay vì 400 có thông báo.
        """
        tao(admin_client, "trung@demo.vn", roles["employee"])
        r = tao(admin_client, "TRUNG@Demo.VN", roles["employee"])

        assert r.status_code == 400
        assert "email" in r.data

    def test_thong_bao_giai_thich_ro_ly_do(self, admin_client, roles):
        """Admin phai hieu vi sao email nhin khac nhau ma he thong bao trung."""
        tao(admin_client, "giaithich@demo.vn", roles["employee"])
        r = tao(admin_client, "GiaiThich@Demo.VN", roles["employee"])

        thong_bao = str(r.data["email"][0])
        assert "giaithich@demo.vn" in thong_bao
        assert "case-insensitive" in thong_bao

    def test_bao_ro_khi_tai_khoan_kia_da_bi_khoa(self, admin_client, roles):
        """
        Tai khoan bi khoa la soft-delete, van chiem email. Admin khong thay no
        trong danh sach active nen thong bao phai noi ro.
        """
        u = baker.make(
            "accounts.CustomUser", email="dakhoa@demo.vn", role=roles["employee"], is_active=False
        )
        r = tao(admin_client, "DaKhoa@Demo.VN", roles["employee"])

        assert r.status_code == 400
        assert "deactivated" in str(r.data["email"][0]).lower()


@pytest.mark.django_db
class TestSuaUser:

    @pytest.fixture
    def nguoi_dung(self, roles):
        return baker.make(
            "accounts.CustomUser", email="cusan@demo.vn", role=roles["employee"], is_active=True
        )

    def test_email_KHONG_doi_duoc_khi_sua(self, admin_client, nguoi_dung):
        """
        Email là ĐỊNH DANH ĐĂNG NHẬP nên bất biến sau khi tạo.

        Đổi email nghĩa là người đó không còn đăng nhập được bằng địa chỉ cũ,
        và mọi liên kết cũ (thư mời tài khoản, bản ghi PasswordReset, email
        trong audit log) đều trỏ tới một địa chỉ không còn ai dùng.

        Field để read_only nên DRF bỏ qua giá trị gửi lên thay vì báo lỗi —
        đúng hành vi chuẩn, và phần còn lại của request vẫn được xử lý.
        """
        goc = nguoi_dung.email
        r = admin_client.patch(
            f"/api/auth/users/{nguoi_dung.id}/",
            {"email": "DoiTen.MOI@Demo.VN"},
            format="json",
        )

        assert r.status_code == 200
        nguoi_dung.refresh_from_db()
        assert nguoi_dung.email == goc

    def test_khong_the_chiem_email_cua_nguoi_khac_qua_luong_sua(
        self, admin_client, nguoi_dung, roles
    ):
        """Read_only cung chan luon duong cuop email cua tai khoan khac."""
        baker.make("accounts.CustomUser", email="nguoikhac@demo.vn", role=roles["employee"])
        goc = nguoi_dung.email

        admin_client.patch(
            f"/api/auth/users/{nguoi_dung.id}/",
            {"email": "NguoiKhac@Demo.VN"},
            format="json",
        )

        nguoi_dung.refresh_from_db()
        assert nguoi_dung.email == goc

    def test_sua_chinh_no_giu_nguyen_email_khong_bi_chan(self, admin_client, nguoi_dung):
        """
        Bay kinh dien: quen loai chinh ban ghi dang sua ra khoi phep kiem tra
        trung -> doi trang thai ma giu nguyen email cung bi bao "da ton tai".
        """
        r = admin_client.patch(
            f"/api/auth/users/{nguoi_dung.id}/",
            {"email": nguoi_dung.email, "is_active": True},
            format="json",
        )
        assert r.status_code == 200

    def test_sua_chinh_no_bang_email_viet_hoa_van_duoc(self, admin_client, nguoi_dung):
        """Go lai email cua chinh minh nhung viet hoa -> van la chinh no."""
        r = admin_client.patch(
            f"/api/auth/users/{nguoi_dung.id}/",
            {"email": nguoi_dung.email.upper()},
            format="json",
        )
        assert r.status_code == 200
        nguoi_dung.refresh_from_db()
        assert nguoi_dung.email == "cusan@demo.vn"
