import os
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError


# ============================================================
# File Upload Service
# Xử lý lưu trữ file vật lý vào thư mục media/
#
# Quy ước lưu trữ:
#   media/task_attachments/<task_id>/<uuid>_<original_filename>
#
# Ràng buộc:
# - Giới hạn kích thước file: 20MB (FR-54 tham chiếu)
# - Chỉ cho phép một số định dạng file cụ thể
# - Tên file được hash để tránh trùng lặp và directory traversal
# ============================================================

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20MB

ALLOWED_EXTENSIONS = {
    # Tài liệu
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    # Ảnh
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    # Nén
    ".zip", ".rar", ".7z",
}


def _validate_file(uploaded_file):
    """
    Kiểm tra kích thước và định dạng file trước khi lưu.
    """
    if uploaded_file.size > MAX_FILE_SIZE_BYTES:
        raise ValidationError(
            {
                "file": f"File quá lớn. Tối đa {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
            }
        )

    _, ext = os.path.splitext(uploaded_file.name)

    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            {
                "file": f"Định dạng file '{ext}' không được hỗ trợ."
            }
        )


def save_task_attachment(task_id, uploaded_file):
    """
    Lưu file đính kèm task vào đĩa cứng.

    Args:
        task_id (int): ID của Task mà file này thuộc về.
        uploaded_file: InMemoryUploadedFile hoặc TemporaryUploadedFile từ request.FILES.

    Returns:
        dict với các key:
            - file_name (str): Tên file gốc của người dùng.
            - file_url (str): URL tương đối để truy cập file qua /media/.
            - file_size (int): Kích thước file (bytes).

    Raises:
        ValidationError nếu file không hợp lệ.
    """
    _validate_file(uploaded_file)

    original_name = uploaded_file.name
    _, ext = os.path.splitext(original_name)

    # Tạo tên file an toàn: <uuid><extension>
    safe_filename = f"{uuid.uuid4().hex}{ext.lower()}"

    # Đường dẫn tương đối bên trong MEDIA_ROOT
    relative_path = os.path.join("task_attachments", str(task_id), safe_filename)

    # Lưu file thực sự xuống đĩa
    saved_path = default_storage.save(relative_path, ContentFile(uploaded_file.read()))

    # URL để truy cập file qua HTTP (bắt đầu bằng /media/)
    file_url = settings.MEDIA_URL + saved_path

    return {
        "file_name": original_name,
        "file_url": file_url,
        "file_size": uploaded_file.size,
    }


def delete_task_attachment_file(file_url):
    """
    Xóa file vật lý ra khỏi đĩa cứng khi cần.

    Args:
        file_url (str): URL đã lưu trong DB (dạng /media/task_attachments/...).

    Ghi chú:
        Chỉ dùng khi cần rollback khi transaction DB thất bại.
        Trong luồng bình thường không xóa file vật lý để bảo toàn lịch sử.
    """
    if not file_url:
        return

    # Lấy relative path từ URL: bỏ phần /media/ ở đầu
    media_url = settings.MEDIA_URL
    if file_url.startswith(media_url):
        relative_path = file_url[len(media_url):]

        if default_storage.exists(relative_path):
            default_storage.delete(relative_path)
