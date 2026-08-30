"""
Test giới hạn tốc độ đăng nhập (chống dò mật khẩu).

Trước đây không có gì chặn: gõ sai mật khẩu bao nhiêu lần cũng được, nên một
script có thể thử hàng nghìn mật khẩu mà hệ thống không phản ứng.

Lưu ý về cache: conftest.py thay toàn bộ cache bằng DummyCache để test không
cần Redis. DummyCache KHÔNG lưu gì, mà bộ đếm của DRF throttle nằm trong
cache — nên nếu không ghi đè lại, throttle sẽ không bao giờ kích hoạt và test
sẽ xanh một cách giả tạo. Vì vậy mỗi test ở đây tự bật LocMemCache.
"""
import pytest
from django.core.cache import caches
from model_bakery import baker
from rest_framework.test import APIClient


LOCMEM = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "throttle-test",
    },
    "blacklist": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"},
}


@pytest.fixture
def throttle_cache(settings):
    """
    Bat LocMemCache that cho rieng test nay, va don sach bo dem truoc/sau.

    Phai lam trong MOT fixture: neu clear() o setup_method thi no chay TRUOC
    khi settings duoc ghi de, tuc la xoa nham DummyCache con bo dem that van
    con nguyen -> test sau thua ket qua cua test truoc.
    """
    settings.CACHES = LOCMEM
    caches["default"].clear()
    yield
    caches["default"].clear()


@pytest.fixture
def user(db):
    role = baker.make("accounts.Role", code="EMPLOYEE")
    u = baker.make(
        "accounts.CustomUser",
        email="thu@test.com",
        role=role,
        is_active=True,
        must_change_password=False,
    )
    u.set_password("DungMatKhau@123")
    u.save()
    return u


def login(client, password):
    return client.post(
        "/api/auth/login/",
        {"email": "thu@test.com", "password": password},
        format="json",
    )


@pytest.mark.django_db
class TestGioiHanDangNhap:

    def test_go_sai_mat_khau_qua_nhieu_lan_thi_bi_chan(self, throttle_cache, user):
        client = APIClient()
        statuses = [login(client, "SaiMatKhau@1").status_code for _ in range(15)]

        # 10/min -> 10 lan dau tra 400/401, tu lan 11 tra 429 Too Many Requests
        assert 429 in statuses, f"Khong bi chan lan nao: {statuses}"
        assert statuses.index(429) <= 10, (
            f"Bi chan qua muon (lan thu {statuses.index(429) + 1})"
        )

    def test_trong_gioi_han_thi_van_dang_nhap_binh_thuong(self, throttle_cache, user):
        """Chốt chặn không được cản trở người dùng thật."""
        client = APIClient()
        for _ in range(3):
            assert login(client, "SaiMatKhau@1").status_code != 429

        response = login(client, "DungMatKhau@123")
        assert response.status_code == 200
        assert "access" in response.data

    def test_bi_chan_thi_mat_khau_dung_cung_khong_vao_duoc(self, throttle_cache, user):
        """
        Điểm mấu chốt của việc chống dò: khi đã vượt ngưỡng thì chặn ở tầng
        throttle, TRƯỚC khi hệ thống kiểm tra mật khẩu. Nếu vẫn cho mật khẩu
        đúng đi qua thì kẻ dò chỉ cần thử tiếp là trúng.
        """
        client = APIClient()
        for _ in range(12):
            login(client, "SaiMatKhau@1")

        assert login(client, "DungMatKhau@123").status_code == 429


@pytest.mark.django_db
class TestGioiHanQuenMatKhau:

    def test_quen_mat_khau_bi_gioi_han_chat_hon(self, throttle_cache, user):
        """
        5/min — chặt hơn login vì endpoint này gửi email thật, có thể bị lạm
        dụng để spam hòm thư người khác.
        """
        client = APIClient()
        statuses = [
            client.post(
                "/api/auth/forgot-password/", {"email": "thu@test.com"}, format="json"
            ).status_code
            for _ in range(8)
        ]
        assert 429 in statuses, f"Khong bi chan lan nao: {statuses}"
        assert statuses.index(429) <= 5
