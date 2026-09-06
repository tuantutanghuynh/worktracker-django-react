"""
Module: tasks.views_attachments
Description: Authenticated, permission-checked download endpoint for task file attachments.
"""

import os

from django.http import FileResponse
from rest_framework.generics import get_object_or_404
from rest_framework.views import APIView

from system.security.permissions_manager import IsActiveAuthenticated
from tasks.models import TaskAttachment
from tasks.services.attachment_access_service import (
    assert_can_download_attachment,
    resolve_attachment_path,
)


class TaskAttachmentDownloadView(APIView):
    """Stream a task attachment to users authorized to see the project it belongs to."""

    # Diem vao DUY NHAT de doc file dinh kem. Thu muc chua file khong con duoc
    # phuc vu truc tiep qua /media/ nua (xem worktracker_core/urls.py), nen moi
    # luot tai deu phai di qua day va bi kiem tra pham vi du an.
    permission_classes = [IsActiveAuthenticated]

    def get(self, request, attachment_id):
        """Return the attachment file after verifying the caller may access its project."""
        attachment = get_object_or_404(
            TaskAttachment.objects.select_related("task", "task__job"),
            pk=attachment_id,
        )

        assert_can_download_attachment(request.user, attachment)
        path = resolve_attachment_path(attachment)

        # as_attachment=True: trinh duyet TAI file ve chu khong hien thi noi
        # dung ngay tren origin cua API. Mot file HTML/SVG doc hai duoc mo truc
        # tiep se chay script tren chinh origin nay.
        response = FileResponse(
            open(path, "rb"),
            as_attachment=True,
            filename=attachment.file_name or os.path.basename(path),
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response
