"""
Test chốt chặn tự khoá — Admin không được tự vô hiệu hoá quyền quản trị.

Không có chốt này thì hệ thống tự khoá được chính nó: Admin bấm Lock lên tài
khoản của mình hoặc hạ role mình xuống EMPLOYEE là không còn ai vào được trang
quản trị, phải sửa thẳng vào database mới cứu được.

Hai luật khác nhau:
  - assert_not_self       : cấm thao tác lên chính mình
  - assert_not_last_admin : cấm khoá/hạ role Admin cuối cùng, kể cả khi một
                            Admin KHÁC thao tác (hai Admin khoá lẫn nhau vẫn
                            dẫn tới không còn ai quản trị)
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import CustomUser, Permission, RolePermission


ADMIN_PERMS = ("user:update", "user:view", "user:lock")


def make_admin(role, email):
    user = baker.make(
        "accounts.CustomUser",
        email=email,
        role=role,
        is_active=True,
        must_change_password=False,
    )
    for code in ADMIN_PERMS:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=role, permission=perm)
    return user


@pytest.fixture
def roles(db):
    return {
        "admin": baker.make("accounts.Role", code="ADMIN"),
        "employee": baker.make("accounts.Role", code="EMPLOYEE"),
    }


@pytest.fixture
def solo_admin(db, roles):
    """Đúng một Admin trong hệ thống — trạng thái thật của DB hiện tại."""
    return make_admin(roles["admin"], "solo@test.com")


@pytest.fixture
def two_admins(db, roles):
    return (
        make_admin(roles["admin"], "admin1@test.com"),
        make_admin(roles["admin"], "admin2@test.com"),
    )


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
class TestKhongTuThaoTacLenMinh:

    def test_khong_tu_khoa_chinh_minh(self, two_admins):
        me, _other = two_admins
        response = client_for(me).patch(f"/api/auth/users/{me.id}/lock/")

        assert response.status_code == 400
        me.refresh_from_db()
        assert me.is_active is True

    def test_khong_tu_xoa_chinh_minh(self, two_admins):
        me, _other = two_admins
        response = client_for(me).delete(f"/api/auth/users/{me.id}/")

        assert response.status_code == 400
        me.refresh_from_db()
        assert me.is_active is True

    def test_khong_tu_ha_role_chinh_minh(self, two_admins, roles):
        me, _other = two_admins
        response = client_for(me).patch(
            f"/api/auth/users/{me.id}/", {"role": roles["employee"].id}, format="json"
        )

        assert response.status_code == 400
        me.refresh_from_db()
        assert me.role.code == "ADMIN"

    def test_van_sua_duoc_email_cua_chinh_minh(self, two_admins):
        """
        Chốt chặn chỉ nhắm vào thao tác đổi role, không được cản trở việc
        sửa thông tin thông thường của chính mình.
        """
        me, _other = two_admins
        response = client_for(me).patch(
            f"/api/auth/users/{me.id}/", {"email": "doi.email@test.com"}, format="json"
        )

        assert response.status_code == 200
        me.refresh_from_db()
        assert me.email == "doi.email@test.com"


@pytest.mark.django_db
class TestKhongKhoaAdminCuoiCung:

    def test_admin_khac_khong_khoa_duoc_admin_cuoi_cung(self, solo_admin, roles):
        """
        Trường hợp nguy hiểm nhất: một Admin thứ hai vừa được tạo rồi khoá
        Admin gốc. assert_not_self không bắt được vì không phải tự thao tác.
        """
        other = make_admin(roles["admin"], "khac@test.com")
        # Khoá `other` trước -> solo_admin thành Admin hoạt động cuối cùng
        other.is_active = False
        other.save()

        response = client_for(other).patch(f"/api/auth/users/{solo_admin.id}/lock/")

        assert response.status_code == 400
        solo_admin.refresh_from_db()
        assert solo_admin.is_active is True

    def test_khong_ha_role_admin_cuoi_cung(self, solo_admin, roles):
        other = make_admin(roles["admin"], "khac2@test.com")
        other.is_active = False
        other.save()

        response = client_for(other).patch(
            f"/api/auth/users/{solo_admin.id}/",
            {"role": roles["employee"].id},
            format="json",
        )

        assert response.status_code == 400
        solo_admin.refresh_from_db()
        assert solo_admin.role.code == "ADMIN"

    def test_con_admin_khac_thi_khoa_duoc_binh_thuong(self, two_admins):
        """Chốt chặn không được cản trở thao tác hợp lệ."""
        admin1, admin2 = two_admins
        response = client_for(admin1).patch(f"/api/auth/users/{admin2.id}/lock/")

        assert response.status_code == 200
        admin2.refresh_from_db()
        assert admin2.is_active is False

    def test_khoa_nhan_vien_thuong_khong_bi_can(self, solo_admin, roles):
        emp = baker.make(
            "accounts.CustomUser", role=roles["employee"], is_active=True,
            must_change_password=False,
        )
        response = client_for(solo_admin).patch(f"/api/auth/users/{emp.id}/lock/")

        assert response.status_code == 200
        emp.refresh_from_db()
        assert emp.is_active is False

    def test_admin_da_bi_khoa_khong_tinh_vao_so_con_lai(self, solo_admin, roles):
        """
        Admin đã khoá không cứu được hệ thống, nên không được tính là "còn
        Admin khác". Ở đây có 2 bản ghi ADMIN nhưng chỉ 1 đang hoạt động.
        """
        locked = make_admin(roles["admin"], "dakhoa@test.com")
        locked.is_active = False
        locked.save()

        assert CustomUser.objects.filter(role__code="ADMIN").count() == 2

        response = client_for(solo_admin).delete(f"/api/auth/users/{solo_admin.id}/")
        assert response.status_code == 400
        solo_admin.refresh_from_db()
        assert solo_admin.is_active is True
