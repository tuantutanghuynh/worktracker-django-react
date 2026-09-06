"""
Test cho lỗ hổng: /media/ được phục vụ không xác thực.

`django.views.static.serve` gắn ở MEDIA_ROOT không hỏi gì cả — ai đoán hoặc lấy
được đường dẫn là tải được file đính kèm của BẤT KỲ dự án nào, kể cả người chưa
đăng nhập. Giờ chỉ ảnh đại diện đi qua /media/; file đính kèm phải qua endpoint
có kiểm tra phạm vi dự án.
"""
import pytest
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.models import Permission, RolePermission


def _cap_quyen(role, *codes):
    for code in codes:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": code})
        RolePermission.objects.get_or_create(role=role, permission=perm)


def _nguoi_dung(role_code, **kwargs):
    # get_or_create chu khong baker.make: Role.code la unique, ma bai test nay
    # can HAI manager khac nhau cung vai tro.
    from accounts.models import Role

    role, _ = Role.objects.get_or_create(code=role_code, defaults={"name": role_code})
    _cap_quyen(role, "task:view", "job:view", "team:view")
    return baker.make(
        "accounts.CustomUser",
        role=role,
        is_active=True,
        must_change_password=False,
        **kwargs,
    )


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def boi_canh(db, tmp_path, settings):
    """Một file đính kèm có thật trên đĩa, thuộc dự án của manager_chu."""
    settings.MEDIA_ROOT = str(tmp_path)

    manager_chu = _nguoi_dung("MANAGER")
    manager_khac = _nguoi_dung("MANAGER")
    nhan_vien_trong_du_an = _nguoi_dung("EMPLOYEE")
    nguoi_ngoai = _nguoi_dung("EMPLOYEE")
    admin = _nguoi_dung("ADMIN")

    client = baker.make("projects.Client", client_name="Khach A", tax_code="0100000001")
    job = baker.make("projects.Job", client=client, manager=manager_chu)
    task = baker.make("tasks.Task", job=job, assignee=nhan_vien_trong_du_an)

    thu_muc = tmp_path / "task_attachments" / str(task.id)
    thu_muc.mkdir(parents=True)
    (thu_muc / "bimat.pdf").write_bytes(b"noi dung mat")

    attachment = baker.make(
        "tasks.TaskAttachment",
        task=task,
        user=nhan_vien_trong_du_an,
        file_name="bimat.pdf",
        file_url=f"/media/task_attachments/{task.id}/bimat.pdf",
    )

    return {
        "attachment": attachment,
        "task": task,
        "manager_chu": manager_chu,
        "manager_khac": manager_khac,
        "nhan_vien": nhan_vien_trong_du_an,
        "nguoi_ngoai": nguoi_ngoai,
        "admin": admin,
    }


def _url(attachment):
    return f"/api/attachments/{attachment.id}/download/"


@pytest.mark.django_db
class TestMediaKhongConPhucVuFileDinhKem:

    def test_duong_dan_media_cu_khong_con_tai_duoc(self, boi_canh):
        """Chính là lỗ hổng: URL này trước đây trả về file cho bất kỳ ai."""
        r = APIClient().get(boi_canh["attachment"].file_url)

        assert r.status_code == 404

    def test_dinh_tuyen_media_chi_con_nhan_avatar(self):
        """
        Kiem tra thang DINH TUYEN chu khong goi HTTP: `document_root` duoc doc
        MOT LAN luc import urlconf, nen doi settings.MEDIA_ROOT trong test
        khong co tac dung — bai test se do vi ly do sai.

        Avatar phai con duong ra (no duoc nhung bang <img src> o hang chuc cho),
        file dinh kem thi khong.
        """
        from django.urls import Resolver404, resolve

        assert resolve("/media/avatars/abc.png") is not None

        with pytest.raises(Resolver404):
            resolve("/media/task_attachments/1/bimat.pdf")


@pytest.mark.django_db
class TestQuyenTaiFileDinhKem:

    def test_chua_dang_nhap_bi_tu_choi(self, boi_canh):
        r = APIClient().get(_url(boi_canh["attachment"]))
        assert r.status_code in (401, 403)

    def test_manager_cua_du_an_tai_duoc(self, boi_canh):
        r = _client(boi_canh["manager_chu"]).get(_url(boi_canh["attachment"]))

        assert r.status_code == 200
        assert b"".join(r.streaming_content) == b"noi dung mat"

    def test_manager_du_an_KHAC_bi_chan(self, boi_canh):
        """Đúng thứ lỗ hổng cho phép: xem file đính kèm của dự án người khác."""
        r = _client(boi_canh["manager_khac"]).get(_url(boi_canh["attachment"]))

        assert r.status_code == 403

    def test_nhan_vien_trong_du_an_tai_duoc(self, boi_canh):
        r = _client(boi_canh["nhan_vien"]).get(_url(boi_canh["attachment"]))
        assert r.status_code == 200

    def test_nhan_vien_ngoai_du_an_bi_chan(self, boi_canh):
        r = _client(boi_canh["nguoi_ngoai"]).get(_url(boi_canh["attachment"]))
        assert r.status_code == 403

    def test_admin_tai_duoc(self, boi_canh):
        r = _client(boi_canh["admin"]).get(_url(boi_canh["attachment"]))
        assert r.status_code == 200

    def test_tai_ve_chu_khong_hien_thi_tren_trinh_duyet(self, boi_canh):
        """
        Content-Disposition: attachment. Mở thẳng một file độc hại trên chính
        origin của API thì script trong đó chạy với quyền của origin ấy.
        """
        r = _client(boi_canh["admin"]).get(_url(boi_canh["attachment"]))

        assert "attachment" in r.headers.get("Content-Disposition", "")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"


@pytest.mark.django_db
class TestChanPathTraversal:

    def test_file_url_co_dau_cham_cham_bi_tu_choi(self, boi_canh, tmp_path):
        """
        file_url chỉ là một cột văn bản. Một bản ghi hỏng hoặc bị sửa tay chứa
        "../../" sẽ biến endpoint này thành công cụ đọc mọi file trên ổ đĩa.
        """
        (tmp_path.parent / "ngoai_vung.txt").write_bytes(b"khong duoc doc")
        at = boi_canh["attachment"]
        at.file_url = "/media/../ngoai_vung.txt"
        at.save(update_fields=["file_url"])

        r = _client(boi_canh["admin"]).get(_url(at))
        assert r.status_code == 404
