"""
Lớp gửi email dùng chung cho toàn hệ thống.

Vì sao tách riêng file này thay vì gọi thẳng send_mail() ở từng chỗ:

  - Trước đây mỗi nơi tự gọi send_mail() với nội dung ghép chuỗi ngay trong
    view (accounts/auth/views_auth.py) hoặc trong Celery task
    (system/tasks.py). Muốn đổi tiêu đề, chữ ký, hay thêm logo là phải sửa
    từng chỗ.
  - Email chỉ có plain text thì client nào cũng đọc được nhưng trông thô.
    Gửi kèm cả bản HTML (multipart/alternative) để client hiện đẹp, client
    cũ vẫn rơi về bản text.

Giữ nguyên quy ước của phần email đã có:
  - Tiêu đề mở đầu bằng "[WorkTracker]" (giống system/tasks.py).
  - from_email = None để Django tự lấy DEFAULT_FROM_EMAIL (giống
    ForgotPasswordView).
"""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.template import TemplateDoesNotExist

logger = logging.getLogger(__name__)

SUBJECT_PREFIX = "[WorkTracker]"


def build_common_context(extra=None):
    """
    Các biến mọi email đều cần: link vào hệ thống, tên sản phẩm.

    Gom vào một chỗ để template không phải nhận từng biến rời rạc, và để
    sau này thêm biến chung (logo, số hotline) chỉ phải sửa ở đây.
    """
    context = {
        "app_name": "WorkTracker Pro",
        "frontend_url": getattr(settings, "FRONTEND_URL", "http://localhost:5173"),
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", ""),
    }
    if extra:
        context.update(extra)
    return context


def send_templated_email(*, template_name, subject, to, context=None, fail_silently=True):
    """
    Render một cặp template .txt + .html rồi gửi đi.

    Args:
        template_name: tên gốc, không đuôi. Ví dụ "welcome_new_user" sẽ đọc
                       templates/emails/welcome_new_user.txt và .html
        subject:       tiêu đề, sẽ được tự thêm tiền tố [WorkTracker]
        to:            một email hoặc list email
        context:       dict biến truyền vào template
        fail_silently: True (mặc định) thì lỗi SMTP chỉ ghi log, KHÔNG ném
                       ngoại lệ. Đây là lựa chọn có chủ đích: việc tạo tài
                       khoản không được thất bại chỉ vì máy chủ mail chết.
                       Đặt False khi email là phần bắt buộc của nghiệp vụ.

    Returns:
        True nếu gửi được, False nếu không (đã ghi log).
    """
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [e for e in recipients if e]
    if not recipients:
        logger.warning("[Email] Khong co nguoi nhan, bo qua: %s", template_name)
        return False

    ctx = build_common_context(context)
    full_subject = f"{SUBJECT_PREFIX} {subject}"

    try:
        # Bản text là bắt buộc — nó là nội dung gốc của email. Bản HTML chỉ
        # là "alternative" đính kèm thêm, thiếu cũng vẫn gửi được.
        text_body = render_to_string(f"emails/{template_name}.txt", ctx)
    except TemplateDoesNotExist:
        logger.error("[Email] Thieu template text: emails/%s.txt", template_name)
        if not fail_silently:
            raise
        return False

    message = EmailMultiAlternatives(
        subject=full_subject,
        body=text_body,
        from_email=None,  # Django tu dung DEFAULT_FROM_EMAIL
        to=recipients,
    )

    try:
        html_body = render_to_string(f"emails/{template_name}.html", ctx)
        message.attach_alternative(html_body, "text/html")
    except TemplateDoesNotExist:
        # Khong co ban HTML thi van gui ban text, khong coi la loi.
        logger.info("[Email] Khong co ban HTML cho %s, gui text.", template_name)

    try:
        message.send(fail_silently=False)
        logger.info("[Email] Da gui '%s' toi %s", template_name, ", ".join(recipients))
        return True
    except Exception as exc:
        logger.error(
            "[Email] Gui that bai '%s' toi %s: %s", template_name, ", ".join(recipients), exc
        )
        if not fail_silently:
            raise
        return False
