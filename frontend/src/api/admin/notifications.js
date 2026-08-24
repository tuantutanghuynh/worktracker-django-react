import axiosClient from '../axiosClient';

// Synthetic, not-persisted alerts computed live from current DB state
// (Department without manager, Employee without department, Client missing
// contact info) — no read/unread concept, they disappear once fixed.
export const getDataQualityAlerts = () =>
  axiosClient.get('/admin/data-quality-alerts/').then((r) => r.data);
