"""
Module: tasks.services.file_upload_service
Description: Service managing storage, validation, and deletion of physical task file attachments.
"""

import os
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    ".zip", ".rar", ".7z",
}


def _validate_file(uploaded_file):
    """Validate upload file size limit and allowed file extensions."""
    if uploaded_file.size > MAX_FILE_SIZE_BYTES:
        raise ValidationError(
            {
                "file": f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
            }
        )

    _, ext = os.path.splitext(uploaded_file.name)

    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            {
                "file": f"File extension '{ext}' is not supported."
            }
        )


def save_task_attachment(task_id, uploaded_file):
    """Persist uploaded file to storage under task attachments directory with UUID naming."""
    _validate_file(uploaded_file)

    original_name = uploaded_file.name
    _, ext = os.path.splitext(original_name)

    safe_filename = f"{uuid.uuid4().hex}{ext.lower()}"
    relative_path = os.path.join("task_attachments", str(task_id), safe_filename)

    saved_path = default_storage.save(relative_path, ContentFile(uploaded_file.read()))
    file_url = settings.MEDIA_URL + saved_path

    return {
        "file_name": original_name,
        "file_url": file_url,
        "file_size": uploaded_file.size,
    }


def delete_task_attachment_file(file_url):
    """Remove physical attachment file from storage during rollback operations."""
    if not file_url:
        return

    media_url = settings.MEDIA_URL
    if file_url.startswith(media_url):
        relative_path = file_url[len(media_url):]

        if default_storage.exists(relative_path):
            default_storage.delete(relative_path)
