import pytest


@pytest.mark.django_db
class TestPasswordChangeRevokesOldTokens:

    def test_old_access_token_rejected_after_password_change(self, api_client, admin_user):
        # Workaround cục bộ: fixture admin_user chưa set must_change_password=False
        # (bug có sẵn, không thuộc scope bài này — xem ghi chú riêng cho team) —
        # nếu không tắt, MỌI endpoint dùng HasPermission sẽ trả 403 ngay từ bước baseline.
        admin_user.must_change_password = False
        admin_user.save()

        # 1. Login qua API thật (không force_authenticate) để lấy access token thật
        login_resp = api_client.post("/api/auth/login/", {
            "email": admin_user.email,
            "password": "Test@1234",
        })
        old_access = login_resp.data["access"]

        # 2. Baseline — gắn token vào header, xác nhận nó ĐANG hoạt động bình thường
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
        resp_before = api_client.get("/api/auth/users/")
        assert resp_before.status_code == 200

        # 3. Đổi mật khẩu — vẫn dùng old_access vì tại thời điểm gọi, nó còn hợp lệ
        change_resp = api_client.post("/api/auth/change-password/", {
            "old_password": "Test@1234",
            "new_password": "NewPass@5678",
        })
        assert change_resp.status_code == 200

        # 4. Dùng LẠI đúng old_access (chưa refresh, chưa login lại) → kỳ vọng bị chặn
        resp_after = api_client.get("/api/auth/users/")
        assert resp_after.status_code == 401
