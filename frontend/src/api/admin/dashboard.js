import axiosClient from '../axiosClient';

export const getDashboard = () =>
  axiosClient.get('/admin/dashboard/').then((r) => r.data);

// Excel workbook (Clients/Jobs/Users sheets) — responseType 'blob' so axios
// hands back raw binary instead of trying to JSON-parse the .xlsx body. On
// an error response (e.g. 403), that same setting means err.response.data
// arrives as a Blob instead of parsed JSON — re-parsed here as text/JSON so
// getErrorMessage() still finds the real `detail` message instead of just
// falling back to its generic default.
export const getAdminReport = async (params) => {
  try {
    const r = await axiosClient.get('/admin/reports/', { params, responseType: 'blob' });
    return r.data;
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      try {
        err.response.data = JSON.parse(text);
      } catch {
        // Not JSON (e.g. an HTML error page) — leave err.response.data as-is.
      }
    }
    throw err;
  }
};
