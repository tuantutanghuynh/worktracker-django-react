"""
Module: accounts.services.account_email_service
Description: Service functions for account lifecycle email notifications.
"""

import logging

from django.conf import settings

from system.services.email_service import send_templated_email

logger = logging.getLogger(__name__)


def send_welcome_email(user, temp_password=None):
    """Send a welcome email with optional temporary credentials upon new user creation."""
    if not user.email:
        logger.warning("[Email] User id=%s has no email address, skipping welcome email.", user.id)
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
