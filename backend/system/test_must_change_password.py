"""
Test cho lỗ hổng: buộc đổi mật khẩu chỉ được canh ở MỘT trong hai lớp RBAC.

Hệ thống có hai lớp quyền song song:
  - accounts.permissions.HasPermission        -> các endpoint Admin
  - system.security.permissions_manager.*     -> các endpoint Manager/Employee

Chỉ lớp thứ nhất kiểm tra `must_change_password`. Nghĩa là một tài khoản vừa
được tạo, đang bị buộc đổi mật khẩu, vẫn gọi được toàn bộ API của Manager như
bình thường — bước buộc đổi mật khẩu tụt xuống thành một gợi ý trên giao diện
chứ không còn là một ràng buộc.
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import Permission, RolePermission


def _cap_quyen(role, *codes):
    for code in codes:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=role, permission=perm)


@pytest.fixture
def manager_chua_doi_mat_khau(db):
    """Manager vừa được Admin tạo: đăng nhập được nhưng bị buộc đổi mật khẩu."""
    role = baker.make("accounts.Role", code="MANAGER")
    _cap_quyen(role, "team:view", "job:view", "task:view", "timesheet:view")
    user = baker.make(
        "accounts.CustomUser",
        role=role,
        is_active=True,
        must_change_password=True,
    )
    c = APIClient()
    c.force_authenticate(user=user)
    return c, user


@pytest.fixture
def manager_binh_thuong(db):
    role = baker.make("accounts.Role", code="MANAGER")
    _cap_quyen(role, "team:view", "job:view", "task:view", "timesheet:view")
    user = baker.make(
        "accounts.CustomUser",
        role=role,
        is_active=True,
        must_change_password=False,
    )
    c = APIClient()
    c.force_authenticate(user=user)
    return c, user


@pytest.mark.django_db
class TestChanApiKhiChuaDoiMatKhau:

    @pytest.mark.parametrize(
        "url",
        [
            "/api/manager/accounts/employees/",
            "/api/manager/accounts/departments/",
        ],
    )
    def test_api_manager_bi_chan(self, manager_chua_doi_mat_khau, url):
        c, _ = manager_chua_doi_mat_khau
        r = c.get(url)

        assert r.status_code == 403, (
            f"{url} van tra ve {r.status_code} — buoc doi mat khau bi bo qua."
        )

    def test_thong_bao_noi_ro_ly_do(self, manager_chua_doi_mat_khau):
        """403 chung chung thì người dùng không biết phải làm gì tiếp."""
        c, _ = manager_chua_doi_mat_khau
        r = c.get("/api/manager/accounts/departments/")

        assert "password" in str(r.data).lower()

    def test_manager_da_doi_mat_khau_thi_vao_duoc(self, manager_binh_thuong):
        """Lớp chặn không được vạ lây sang tài khoản bình thường."""
        c, _ = manager_binh_thuong
        assert c.get("/api/manager/accounts/departments/").status_code == 200


@pytest.mark.django_db
class TestVanDoiDuocMatKhau:
    """
    Nếu chặn hết mọi thứ thì người dùng bị nhốt: không đổi được mật khẩu nên
    không bao giờ thoát ra khỏi trạng thái này. Hai endpoint dưới đây dùng
    IsAuthenticated của DRF nên không đi qua lớp quyền vừa sửa.
    """

    def test_van_doi_duoc_mat_khau(self, manager_chua_doi_mat_khau):
        c, user = manager_chua_doi_mat_khau
        user.set_password("CuKyLa123@")
        user.save()

        r = c.post(
            "/api/auth/change-password/",
            {"old_password": "CuKyLa123@", "new_password": "MoiHoanToan456@"},
            format="json",
        )
        assert r.status_code == 200, r.data

    def test_van_xem_duoc_ho_so_cua_minh(self, manager_chua_doi_mat_khau):
        c, _ = manager_chua_doi_mat_khau
        assert c.get("/api/employee/me/profile/").status_code == 200
