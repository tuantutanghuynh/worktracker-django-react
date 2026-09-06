import { toast } from 'sonner';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from './errorMessages';

/**
 * Tải một file đính kèm của task.
 *
 * Không dùng `<a href>` thẳng được nữa: thư mục chứa file đính kèm không còn
 * được phục vụ công khai qua /media/, mọi lượt tải phải đi qua endpoint có
 * kiểm tra quyền — mà endpoint đó cần header Authorization, thứ một thẻ <a>
 * không bao giờ gửi kèm. Nên phải tải bằng axios rồi dựng blob để lưu.
 *
 * @param {{id: number, file_name?: string, download_url?: string}} attachment
 */
export async function downloadAttachment(attachment) {
  const url = attachment?.download_url || `/attachments/${attachment?.id}/download/`;

  try {
    const response = await axiosClient.get(url.replace(/^\/api/, ''), {
      responseType: 'blob',
    });

    const objectUrl = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = attachment?.file_name || 'attachment';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    // responseType 'blob' làm thân lỗi cũng về dạng Blob, nên phải đọc ngược
    // lại thành JSON thì getErrorMessage mới hiểu được.
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      try {
        err.response.data = JSON.parse(text);
      } catch {
        // Không phải JSON (vd: một trang lỗi HTML) — cứ để nguyên.
      }
    }
    toast.error(getErrorMessage(err, 'Could not download this file.'));
  }
}
