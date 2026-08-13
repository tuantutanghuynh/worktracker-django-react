import { useQuery } from '@tanstack/react-query';
import managerReportService from '../../../services/manager/managerReportService';

/**
 * Query Key Factory for Manager Dashboard
 */
export const managerDashboardKeys = {
  all: ['manager-dashboard'],
  summary: (params = {}) => [...managerDashboardKeys.all, 'summary', { params }],
};

/**
 * Fetch manager dashboard summary metrics & charts data
 */
export function useManagerDashboard(params = {}) {
  return useQuery({
    queryKey: managerDashboardKeys.summary(params),
    queryFn: () => managerReportService.getDashboard(params),
    staleTime: 60 * 1000, // 1 minute stale time for dashboard metrics
    refetchOnWindowFocus: true,
  });
}
