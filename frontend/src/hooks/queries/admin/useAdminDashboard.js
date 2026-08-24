import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../../api/admin/dashboard';

// GET /api/admin/dashboard/ is cached server-side for 30s (DashboardView),
// so this doesn't need its own aggressive polling on top of that.
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboard,
  });
}
