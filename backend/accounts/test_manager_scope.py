"""
Test cho tuyến báo cáo cố định Employee → Manager.

Ba luật cần được bảo vệ:
  1. Manager chỉ NHÌN THẤY nhân viên thuộc tuyến của mình.
  2. Manager chỉ GIAO VIỆC được cho nhân viên thuộc tuyến của mình.
  3. Chỉ Admin mới đổi được tuyến báo cáo, và thao tác đó phải vào audit log.

Trước khi có tuyến báo cáo, endpoint danh sách nhân viên trả về toàn bộ công
ty và validate_assignee_id chỉ kiểm role — nghĩa là bất kỳ Manager nào cũng
giao việc được cho bất kỳ ai.
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import CustomUser, Role, Permission, RolePermission, EmployeeProfile
from system.models import AuditLog


def make_user_with_perms(role, *permission_codes):
    # must_change_password phai dat tuong minh: baker sinh ngau nhien gia tri
    # boolean, va HasPermission nem PermissionDenied neu co True.
    user = baker.make(
        "accounts.CustomUser", role=role, is_active=True, must_change_password=False
    )
    for code in permission_codes:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=role, permission=perm)
    return user


@pytest.fixture
def roles(db):
    return {
        "manager": baker.make("accounts.Role", code="MANAGER"),
        "employee": baker.make("accounts.Role", code="EMPLOYEE"),
        "admin": baker.make("accounts.Role", code="ADMIN"),
    }


@pytest.fixture
def team(db, roles):
    """Hai Manager, mỗi người một nhân viên, cộng một nhân viên chưa gán ai."""
    manager_a = make_user_with_perms(roles["manager"], "team:view")
    manager_b = baker.make("accounts.CustomUser", role=roles["manager"], is_active=True)

    emp_a = baker.make("accounts.CustomUser", role=roles["employee"], is_active=True)
    emp_b = baker.make("accounts.CustomUser", role=roles["employee"], is_active=True)
    emp_none = baker.make("accounts.CustomUser", role=roles["employee"], is_active=True)

    baker.make("accounts.EmployeeProfile", user=emp_a, full_name="Nhan vien A", manager=manager_a)
    baker.make("accounts.EmployeeProfile", user=emp_b, full_name="Nhan vien B", manager=manager_b)
    baker.make("accounts.EmployeeProfile", user=emp_none, full_name="Chua gan", manager=None)

    return {
        "manager_a": manager_a, "manager_b": manager_b,
        "emp_a": emp_a, "emp_b": emp_b, "emp_none": emp_none,
    }


@pytest.mark.django_db
class TestManagerNhinThayAi:
    """GET /api/manager/accounts/employees/ — phạm vi hiển thị."""

    def _emails(self, response):
        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        return {r["email"] for r in rows}

    def test_manager_chi_thay_nhan_vien_cua_minh(self, team):
        client = APIClient()
        client.force_authenticate(user=team["manager_a"])
        response = client.get("/api/manager/accounts/employees/")

        assert response.status_code == 200
        emails = self._emails(response)
        assert team["emp_a"].email in emails
        assert team["emp_b"].email not in emails, "Khong duoc thay nhan vien cua Manager khac"

    def test_nhan_vien_chua_gan_manager_thi_khong_ai_thay(self, team):
        client = APIClient()
        client.force_authenticate(user=team["manager_a"])
        emails = self._emails(client.get("/api/manager/accounts/employees/"))
        assert team["emp_none"].email not in emails


@pytest.mark.django_db
class TestGiaoViecTheoTuyen:
    """
    Kiểm tra thẳng trên get_active_employee_or_error() — điểm nghẽn duy nhất
    mà cả create_task lẫn update_task đều đi qua.
    """

    def test_giao_cho_nhan_vien_cua_minh_thi_duoc(self, team):
        from tasks.services.task_manager_service import get_active_employee_or_error

        result = get_active_employee_or_error(team["emp_a"].id, manager=team["manager_a"])
        assert result.id == team["emp_a"].id

    def test_giao_cho_nhan_vien_cua_manager_khac_bi_tu_choi(self, team):
        from rest_framework.exceptions import ValidationError
        from tasks.services.task_manager_service import get_active_employee_or_error

        with pytest.raises(ValidationError) as exc:
            get_active_employee_or_error(team["emp_b"].id, manager=team["manager_a"])
        assert "assignee_id" in exc.value.detail

    def test_giao_cho_nhan_vien_chua_gan_manager_bi_tu_choi(self, team):
        from rest_framework.exceptions import ValidationError
        from tasks.services.task_manager_service import get_active_employee_or_error

        with pytest.raises(ValidationError):
            get_active_employee_or_error(team["emp_none"].id, manager=team["manager_a"])

    def test_khong_truyen_manager_thi_giu_hanh_vi_cu(self, team):
        """
        Tương thích ngược: bỏ trống tham số manager thì hàm chỉ kiểm role như
        trước. Cần thiết vì hàm này là API nội bộ, có thể được gọi từ chỗ
        không có ngữ cảnh Manager (lệnh seed, script quản trị).
        """
        from tasks.services.task_manager_service import get_active_employee_or_error

        assert get_active_employee_or_error(team["emp_b"].id).id == team["emp_b"].id


@pytest.mark.django_db
class TestAdminGanManager:
    """PATCH /api/auth/users/{id}/assign-manager/"""

    @pytest.fixture
    def admin_client(self, roles):
        admin = make_user_with_perms(roles["admin"], "user:update", "user:view")
        client = APIClient()
        client.force_authenticate(user=admin)
        return client

    def test_gan_manager_thanh_cong_va_ghi_audit(self, admin_client, team):
        url = f"/api/auth/users/{team['emp_none'].id}/assign-manager/"
        response = admin_client.patch(url, {"manager": team["manager_a"].id}, format="json")

        assert response.status_code == 200
        profile = EmployeeProfile.objects.get(user=team["emp_none"])
        assert profile.manager_id == team["manager_a"].id

        log = AuditLog.objects.filter(
            table_name="employee_profiles", record_id=team["emp_none"].id
        ).latest("id")
        assert log.new_values["manager_id"] == team["manager_a"].id
        assert log.severity == AuditLog.Severity.WARNING

    def test_go_manager_bang_null(self, admin_client, team):
        url = f"/api/auth/users/{team['emp_a'].id}/assign-manager/"
        response = admin_client.patch(url, {"manager": None}, format="json")

        assert response.status_code == 200
        assert EmployeeProfile.objects.get(user=team["emp_a"]).manager_id is None

    def test_khong_gan_duoc_nguoi_khong_phai_manager(self, admin_client, team):
        url = f"/api/auth/users/{team['emp_a'].id}/assign-manager/"
        response = admin_client.patch(url, {"manager": team["emp_b"].id}, format="json")
        assert response.status_code == 400

    def test_khong_gan_duoc_manager_da_bi_khoa(self, admin_client, team):
        team["manager_b"].is_active = False
        team["manager_b"].save()

        url = f"/api/auth/users/{team['emp_a'].id}/assign-manager/"
        response = admin_client.patch(url, {"manager": team["manager_b"].id}, format="json")
        assert response.status_code == 400

    def test_khong_gan_manager_cho_tai_khoan_khong_phai_employee(self, admin_client, team):
        """Manager và Admin không nằm trong tuyến báo cáo của mô hình này."""
        url = f"/api/auth/users/{team['manager_b'].id}/assign-manager/"
        response = admin_client.patch(url, {"manager": team["manager_a"].id}, format="json")
        assert response.status_code == 400


@pytest.mark.django_db
class TestBoLocManagerTrenUserList:
    """GET /api/auth/users/?manager=..."""

    @pytest.fixture
    def admin_client(self, roles):
        admin = make_user_with_perms(roles["admin"], "user:view")
        client = APIClient()
        client.force_authenticate(user=admin)
        return client

    def test_loc_theo_manager_cu_the(self, admin_client, team):
        response = admin_client.get(f"/api/auth/users/?manager={team['manager_a'].id}")
        emails = {r["email"] for r in response.data["results"]}
        assert emails == {team["emp_a"].email}

    def test_loc_chua_gan_manager(self, admin_client, team):
        """Bộ lọc Admin dùng để tìm những người vô hình với mọi Manager."""
        response = admin_client.get("/api/auth/users/?manager=none")
        emails = {r["email"] for r in response.data["results"]}
        assert team["emp_none"].email in emails
        assert team["emp_a"].email not in emails


@pytest.mark.django_db
class TestHaRoleManagerThiGoTuyenBaoCao:
    """
    Ha mot Manager xuong role khac -> nhan vien truc thuoc duoc go ve
    "chua gan" thay vi tro toi mot tai khoan khong con la Manager.

    Khong go thi trang thai do lang le hong: nhan vien vo hinh voi moi
    Manager ma khong co dau hieu nao bao cho Admin biet.
    """

    @pytest.fixture
    def admin_client(self, roles):
        admin = make_user_with_perms(roles["admin"], "user:update", "user:view")
        client = APIClient()
        client.force_authenticate(user=admin)
        return client

    def test_ha_manager_xuong_employee_thi_nhan_vien_bi_go(self, admin_client, team, roles):
        manager_a = team["manager_a"]
        assert EmployeeProfile.objects.filter(manager=manager_a).count() == 1

        response = admin_client.patch(
            f"/api/auth/users/{manager_a.id}/",
            {"role": roles["employee"].id},
            format="json",
        )

        assert response.status_code == 200
        assert EmployeeProfile.objects.filter(manager=manager_a).count() == 0
        assert EmployeeProfile.objects.get(user=team["emp_a"]).manager_id is None

    def test_go_tuyen_duoc_ghi_audit_kem_danh_sach_bi_anh_huong(self, admin_client, team, roles):
        manager_a = team["manager_a"]
        admin_client.patch(
            f"/api/auth/users/{manager_a.id}/",
            {"role": roles["employee"].id},
            format="json",
        )

        log = AuditLog.objects.filter(
            table_name="employee_profiles", record_id=manager_a.id
        ).latest("id")
        assert log.new_values["affected_count"] == 1
        assert team["emp_a"].id in log.old_values["affected_user_ids"]
        assert log.severity == AuditLog.Severity.WARNING

    def test_doi_role_giua_2_role_khong_phai_manager_thi_khong_dung_gi(
        self, admin_client, team, roles
    ):
        """Chi go khi role CU la MANAGER — doi Employee sang Admin khong lien quan."""
        emp = team["emp_a"]
        admin_client.patch(
            f"/api/auth/users/{emp.id}/", {"role": roles["admin"].id}, format="json"
        )
        # Nhan vien cua manager_b khong bi anh huong
        assert EmployeeProfile.objects.get(user=team["emp_b"]).manager_id == team["manager_b"].id

    def test_khoa_tai_khoan_manager_KHONG_go_tuyen(self, admin_client, team, roles):
        """
        Khoa la thao tac dao nguoc duoc nen khong duoc go du lieu — mo khoa lai
        se khong khoi phuc noi. Thay vao do serializer tra ve manager_is_active
        de giao dien canh bao.
        """
        manager_a = team["manager_a"]
        admin = make_user_with_perms(roles["admin"], "user:lock", "user:view")
        c = APIClient()
        c.force_authenticate(user=admin)

        response = c.patch(f"/api/auth/users/{manager_a.id}/lock/")

        assert response.status_code == 200
        assert EmployeeProfile.objects.get(user=team["emp_a"]).manager_id == manager_a.id
