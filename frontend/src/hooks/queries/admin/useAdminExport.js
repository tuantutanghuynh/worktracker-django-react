import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import axiosClient from '../../../api/axiosClient';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Downloads one admin table as Excel. Each admin list endpoint exposes its
 * own `export` action that reuses that endpoint's filters, so passing the
 * page's current filter params here produces a file matching exactly what
 * the user sees on screen.
 *
 * responseType 'blob' keeps axios from JSON-parsing the .xlsx body; on an
 * error response that same setting means the error body arrives as a Blob,
 * so it's re-parsed back to JSON for getErrorMessage().
 */
async function downloadExport({ url, params, filename }) {
  try {
    const response = await axiosClient.get(url, { params, responseType: 'blob' });
    const objectUrl = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      try {
        err.response.data = JSON.parse(text);
      } catch {
        // Not JSON (e.g. an HTML error page) — leave the Blob as-is.
      }
    }
    throw err;
  }
}

export function useAdminExport() {
  return useMutation({
    mutationFn: downloadExport,
    onSuccess: () => toast.success('Export downloaded.'),
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to export.')),
  });
}
