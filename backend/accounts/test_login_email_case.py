"""
Test đăng nhập không phân biệt hoa thường của email.

Người dùng không nhớ chính xác hoa thường mà Admin đã gõ lúc tạo tài khoản
cho họ. Email vốn không phân biệt hoa thường trên thực tế, nên hệ thống cũng
phải vậy.

Đi kèm với chuẩn hoá phía Admin (accounts/test_email_normalize.py): Admin
luôn lưu email chữ thường, còn phần này dùng __iexact nên vẫn đúng kể cả với
bản ghi cũ đã lỡ lưu chữ hoa.
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import PasswordReset


@pytest.fixture
def nguoi_dung(db):
    role = baker.make("accounts.Role", code="EMPLOYEE")
    u = baker.make(
        "accounts.CustomUser",
        email="nhanvien@congty.vn",
        role=role,
        is_active=True,
        must_change_password=False,
    )
    u.set_password("MatKhau@123")
    u.save()
    return u


def dang_nhap(email, password="MatKhau@123"):
    return APIClient().post(
        "/api/auth/login/", {"email": email, "password": password}, format="json"
    )


@pytest.mark.django_db
class TestDangNhapKhongPhanBietHoaThuong:

    @pytest.mark.parametrize(
        "email",
        [
            "nhanvien@congty.vn",
            "NHANVIEN@CONGTY.VN",
            "NhanVien@CongTy.vn",
            "nhanVIEN@congty.VN",
        ],
    )
    def test_moi_kieu_hoa_thuong_deu_vao_duoc(self, nguoi_dung, email):
        assert dang_nhap(email).status_code == 200

    def test_khoang_trang_thua_van_vao_duoc(self, nguoi_dung):
        assert dang_nhap("   NhanVien@CongTy.vn   ").status_code == 200

    def test_mat_khau_sai_van_bi_tu_choi(self, nguoi_dung):
        """
        Chuẩn hoá email KHÔNG được nới lỏng phần kiểm tra mật khẩu.
        """
        assert dang_nhap("NHANVIEN@CONGTY.VN", "SaiMatKhau").status_code == 401

    def test_email_khong_ton_tai_van_bi_tu_choi(self, nguoi_dung):
        assert dang_nhap("KhongCo@CongTy.vn").status_code == 401

    def test_tai_khoan_bi_khoa_van_bi_chan(self, nguoi_dung):
        """Tài khoản đã khoá phải trả 403, không phải 200."""
        nguoi_dung.is_active = False
        nguoi_dung.save()
        assert dang_nhap("NHANVIEN@CONGTY.VN").status_code == 403

    def test_ban_ghi_cu_luu_chu_hoa_van_dang_nhap_duoc(self, db):
        """
        __iexact chu khong phai so khop chuoi da lowercase — nho vay tai
        khoan tao TRUOC khi co chuan hoa (email luu chu hoa trong DB) van
        dang nhap duoc bang chu thuong.
        """
        role = baker.make("accounts.Role", code="EMPLOYEE")
        u = baker.make(
            "accounts.CustomUser",
            email="CuKy@CongTy.VN",
            role=role,
            is_active=True,
            must_change_password=False,
        )
        u.set_password("MatKhau@123")
        u.save()

        assert dang_nhap("cuky@congty.vn").status_code == 200


@pytest.mark.django_db
class TestQuenMatKhau:

    def test_go_chu_hoa_van_tim_ra_tai_khoan(self, nguoi_dung):
        """
        Endpoint nay luon tra 200 de khong lo email nao ton tai, nen phai
        kiem tra o DB xem token co that su duoc tao khong.
        """
        r = APIClient().post(
            "/api/auth/forgot-password/", {"email": "NHANVIEN@CongTy.vn"}, format="json"
        )
        assert r.status_code == 200
        assert PasswordReset.objects.filter(email="nhanvien@congty.vn").exists()

    def test_ban_ghi_reset_luu_email_chu_thuong(self, nguoi_dung):
        """
        Neu luu nguyen chu hoa thi buoc dat lai mat khau se tra cuu lai bang
        chuoi do — phai chuan hoa ngay tu dau cho nhat quan.
        """
        APIClient().post(
            "/api/auth/forgot-password/", {"email": "NhanVien@CONGTY.vn"}, format="json"
        )
        reset = PasswordReset.objects.latest("id")
        assert reset.email == reset.email.lower()

    def test_email_khong_ton_tai_khong_tao_token(self, nguoi_dung):
        r = APIClient().post(
            "/api/auth/forgot-password/", {"email": "KhongCo@CongTy.vn"}, format="json"
        )
        assert r.status_code == 200  # khong lo email nao ton tai
        assert not PasswordReset.objects.filter(email="khongco@congty.vn").exists()
