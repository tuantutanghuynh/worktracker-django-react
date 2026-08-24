import { useQuery } from '@tanstack/react-query';
import { getDataQualityAlerts } from '../../../api/admin/notifications';

// Synthetic, not-persisted alerts computed live from current DB state
// (Department without manager, Employee without department, Client missing
// contact info) — no read/unread concept, they disappear once fixed. See
// useNotificationStore's seenAlertIds for the client-side "seen" tracking.
export function useAdminDataQualityAlerts(options = {}) {
  return useQuery({
    queryKey: ['admin-data-quality-alerts'],
    queryFn: getDataQualityAlerts,
    ...options,
  });
}
