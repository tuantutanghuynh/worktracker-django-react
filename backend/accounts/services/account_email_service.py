"""
Các email liên quan tới vòng đời tài khoản.

Tách khỏi view để:
  - View chỉ lo HTTP, không phải biết template tên gì, biến gì.
  - Muốn đổi nội dung email chỉ sửa một chỗ, không phải lần trong view.
  - Sau này chuyển sang gửi bất đồng bộ qua Celery (như
    system/tasks.py::send_notification_email) thì chỉ đổi bên trong hàm
    này, nơi gọi không phải sửa gì.
"""
import logging

from django.conf import settings

from system.services.email_service import send_templated_email

logger = logging.getLogger(__name__)


def send_welcome_email(user, temp_password=None):
    """
    Gửi email chào mừng khi Admin vừa tạo tài khoản.

    Args:
        user:          CustomUser vừa được tạo.
        temp_password: mật khẩu Admin đặt. Truyền None thì email vẫn gửi
                       nhưng không kèm mật khẩu — dùng khi công ty muốn
                       Admin báo mật khẩu qua kênh khác.

    Returns:
        True nếu gửi được, False nếu không.

    Không bao giờ ném ngoại lệ: việc tạo tài khoản đã thành công rồi, không
    được để máy chủ mail chết làm hỏng cả thao tác. Lỗi chỉ ghi vào log.
    """
    if not user.email:
        logger.warning("[Email] User id=%s khong co email, bo qua thu chao mung.", user.id)
        return False

    profile = getattr(user, "profile", None)
    department = getattr(profile, "department", None)
    manager = getattr(profile, "manager", None)

    context = {
        "user_email": user.email,
        "full_name": getattr(profile, "full_name", "") or user.email,
        "temp_password": temp_password,
        "role_name": getattr(user.role, "name", None) or getattr(user.role, "code", "—"),
        "department_name": getattr(department, "name", None),
        "manager_email": getattr(manager, "email", None),
        "login_url": f"{getattr(settings, 'FRONTEND_URL', '')}/login",
    }

    return send_templated_email(
        template_name="welcome_new_user",
        subject="Your account is ready",
        to=user.email,
        context=context,
    )
