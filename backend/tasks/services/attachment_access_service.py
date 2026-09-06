"""
Module: tasks.services.attachment_access_service
Description: Authorization rules and file resolution for downloading task attachments.
"""

import os

from django.conf import settings
from rest_framework.exceptions import NotFound, PermissionDenied

from system.security.scoping_manager import employee_job_ids

ADMIN_ROLE_CODE = "ADMIN"
MANAGER_ROLE_CODE = "MANAGER"


def assert_can_download_attachment(user, attachment):
    """Ensure the requesting user is allowed to read this task attachment."""
    # Truoc day khong co lop nay: file nam duoi /media/ va Django phuc vu thang
    # bang django.views.static.serve, khong xac thuc gi ca. Ai doan hoac lay
    # duoc duong dan la tai duoc file dinh kem cua BAT KY du an nao, ke ca
    # nguoi ngoai he thong.
    role_code = getattr(getattr(user, "role", None), "code", None)

    if role_code == ADMIN_ROLE_CODE:
        return

    job = attachment.task.job

    if role_code == MANAGER_ROLE_CODE:
        if job.manager_id == user.id:
            return
        raise PermissionDenied(
            "This file belongs to a project you do not manage."
        )

    # Nhan vien: chi doc duoc file cua nhung du an minh that su tham gia.
    if job.id in set(employee_job_ids(user)):
        return

    raise PermissionDenied("This file belongs to a project you are not part of.")


def resolve_attachment_path(attachment):
    """Return the absolute on-disk path of an attachment, refusing paths outside the media root."""
    stored = attachment.file_url or ""

    media_url = settings.MEDIA_URL
    relative = stored[len(media_url):] if stored.startswith(media_url) else stored
    relative = relative.lstrip("/")

    media_root = os.path.realpath(settings.MEDIA_ROOT)
    absolute = os.path.realpath(os.path.join(media_root, relative))

    # Chan path traversal: file_url la mot cot van ban, mot ban ghi hong hoac
    # bi sua tay co the chua "../../" va bien endpoint nay thanh cong cu doc
    # bat ky file nao tren o dia.
    if not absolute.startswith(media_root + os.sep):
        raise NotFound("Attachment file not found.")

    if not os.path.exists(absolute):
        raise NotFound("Attachment file no longer exists on the server.")

    return absolute
