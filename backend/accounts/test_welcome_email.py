"""
Test thư chào mừng gửi khi Admin tạo tài khoản mới.

Điều quan trọng nhất được canh ở đây KHÔNG phải là nội dung thư, mà là:
việc tạo tài khoản không bao giờ được thất bại chỉ vì máy chủ mail chết.
"""
from unittest.mock import patch

import pytest
from django.core import mail
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import CustomUser, Permission, RolePermission, EmployeeProfile
from accounts.services.account_email_service import send_welcome_email


LOCMEM_MAIL = "django.core.mail.backends.locmem.EmailBackend"


@pytest.fixture
def mail_backend(settings):
    """Gui thu vao bo nho thay vi SMTP that, va don sach hop thu truoc moi test."""
    settings.EMAIL_BACKEND = LOCMEM_MAIL
    mail.outbox = []
    yield
    mail.outbox = []


@pytest.fixture
def roles(db):
    return {
        "admin": baker.make("accounts.Role", code="ADMIN", name="Administrator"),
        "employee": baker.make("accounts.Role", code="EMPLOYEE", name="Employee"),
        "manager": baker.make("accounts.Role", code="MANAGER", name="Manager"),
    }


@pytest.fixture
def admin_client(db, roles):
    for code in ("user:create", "user:view"):
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=roles["admin"], permission=perm)
    admin = baker.make(
        "accounts.CustomUser", role=roles["admin"], is_active=True, must_change_password=False
    )
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.mark.django_db(transaction=True)
class TestGuiThuKhiTaoTaiKhoan:
    """
    transaction=True la BAT BUOC: view dung transaction.on_commit(), ma
    trong test binh thuong pytest-django boc moi test trong mot transaction
    khong bao gio commit -> callback khong chay va outbox luon rong.
    """

    def test_tao_user_thi_gui_dung_mot_thu(self, admin_client, roles, mail_backend):
        response = admin_client.post(
            "/api/auth/users/",
            {"email": "nhanvienmoi@test.com", "password": "Tam@12345", "role": roles["employee"].id},
            format="json",
        )

        assert response.status_code == 201
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["nhanvienmoi@test.com"]

    def test_thu_co_ca_ban_text_va_html(self, admin_client, roles, mail_backend):
        admin_client.post(
            "/api/auth/users/",
            {"email": "haiban@test.com", "password": "Tam@12345", "role": roles["employee"].id},
            format="json",
        )
        m = mail.outbox[0]

        assert m.body, "Ban text la noi dung goc, khong duoc rong"
        assert len(m.alternatives) == 1, "Phai dinh kem dung mot ban HTML"
        assert m.alternatives[0][1] == "text/html"

    def test_thu_chua_email_va_mat_khau_tam(self, admin_client, roles, mail_backend):
        admin_client.post(
            "/api/auth/users/",
            {"email": "codulieu@test.com", "password": "Tam@12345", "role": roles["employee"].id},
            format="json",
        )
        m = mail.outbox[0]
        html = m.alternatives[0][0]

        for noi_dung in (m.body, html):
            assert "codulieu@test.com" in noi_dung
            assert "Tam@12345" in noi_dung

    def test_tieu_de_theo_dung_quy_uoc_cua_he_thong(self, admin_client, roles, mail_backend):
        """Giong system/tasks.py: moi thu deu mo dau bang [WorkTracker]."""
        admin_client.post(
            "/api/auth/users/",
            {"email": "tieude@test.com", "password": "Tam@12345", "role": roles["employee"].id},
            format="json",
        )
        assert mail.outbox[0].subject.startswith("[WorkTracker]")

    def test_smtp_chet_thi_van_tao_duoc_tai_khoan(self, admin_client, roles, mail_backend):
        """
        Chốt chặn quan trọng nhất của cả file này.

        Máy chủ mail chết là chuyện thường. Nếu lỗi đó nổi lên thành 500 thì
        Admin không tạo được tài khoản nào cho tới khi ai đó sửa xong SMTP —
        một sự cố phụ làm tê liệt nghiệp vụ chính.
        """
        with patch(
            "django.core.mail.EmailMultiAlternatives.send",
            side_effect=Exception("SMTP server unreachable"),
        ):
            response = admin_client.post(
                "/api/auth/users/",
                {"email": "smtpchet@test.com", "password": "Tam@12345", "role": roles["employee"].id},
                format="json",
            )

        assert response.status_code == 201
        assert CustomUser.objects.filter(email="smtpchet@test.com").exists()


@pytest.mark.django_db
class TestSendWelcomeEmailTrucTiep:
    """Goi thang service, khong qua HTTP."""

    def test_user_khong_co_email_thi_bo_qua(self, roles, mail_backend):
        user = baker.make("accounts.CustomUser", email="", role=roles["employee"])
        assert send_welcome_email(user) is False
        assert len(mail.outbox) == 0

    def test_khong_truyen_mat_khau_thi_thu_khong_co_mat_khau(self, roles, mail_backend):
        """
        Cho phep gui thu ma khong kem mat khau — dung khi cong ty muon bao
        mat khau qua kenh khac.
        """
        user = baker.make(
            "accounts.CustomUser", email="khongmatkhau@test.com", role=roles["employee"]
        )
        assert send_welcome_email(user, temp_password=None) is True

        m = mail.outbox[0]
        assert "Temporary password" not in m.body
        assert "Temporary password" not in m.alternatives[0][0]

    def test_thu_kem_phong_ban_va_manager_khi_co(self, roles, mail_backend):
        manager = baker.make(
            "accounts.CustomUser", email="sep@test.com", role=roles["manager"]
        )
        dept = baker.make("accounts.Department", name="Information Technology")
        user = baker.make(
            "accounts.CustomUser", email="daydu@test.com", role=roles["employee"]
        )
        EmployeeProfile.objects.create(
            user=user, full_name="Nhan Vien", department=dept, manager=manager
        )

        assert send_welcome_email(user, temp_password="Tam@12345") is True

        body = mail.outbox[0].body
        assert "Information Technology" in body
        assert "sep@test.com" in body
