"""
Module: system.services.email_service
Description: Shared email delivery service supporting multipart HTML and plain-text templating.
"""

import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.template import TemplateDoesNotExist

logger = logging.getLogger(__name__)

SUBJECT_PREFIX = "[WorkTracker]"


def build_common_context(extra=None):
    """Build shared template context containing application name, URLs, and support email."""
    context = {
        "app_name": "WorkTracker Pro",
        "frontend_url": getattr(settings, "FRONTEND_URL", "http://localhost:5173"),
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", ""),
    }
    if extra:
        context.update(extra)
    return context


def send_templated_email(*, template_name, subject, to, context=None, fail_silently=True):
    """Render plain-text and HTML email templates and dispatch via configured email backend."""
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [e for e in recipients if e]
    if not recipients:
        logger.warning("[Email] No recipients provided, skipping: %s", template_name)
        return False

    ctx = build_common_context(context)
    full_subject = f"{SUBJECT_PREFIX} {subject}"

    try:
        text_body = render_to_string(f"emails/{template_name}.txt", ctx)
    except TemplateDoesNotExist:
        logger.error("[Email] Missing text template: emails/%s.txt", template_name)
        if not fail_silently:
            raise
        return False

    message = EmailMultiAlternatives(
        subject=full_subject,
        body=text_body,
        from_email=None,
        to=recipients,
    )

    try:
        html_body = render_to_string(f"emails/{template_name}.html", ctx)
        message.attach_alternative(html_body, "text/html")
    except TemplateDoesNotExist:
        logger.info("[Email] No HTML template for %s, sending plain text.", template_name)

    def _do_send():
        try:
            message.send(fail_silently=False)
            logger.info("[Email] Sent '%s' to %s", template_name, ", ".join(recipients))
            return True
        except Exception as exc:
            logger.error(
                "[Email] Failed sending '%s' to %s: %s", template_name, ", ".join(recipients), exc
            )
            if not fail_silently:
                raise
            return False

    backend_name = getattr(settings, "EMAIL_BACKEND", "") or ""
    is_testing_backend = "locmem" in backend_name or "console" in backend_name

    if is_testing_backend:
        return _do_send()

    import threading
    thread = threading.Thread(target=_do_send, daemon=True)
    thread.start()
    return True
