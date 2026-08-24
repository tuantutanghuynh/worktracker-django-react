import { useQuery } from '@tanstack/react-query';
import { listAuditLogs, getAuditLogFilterOptions, getAuditLogSummary } from '../../../api/admin/auditLogs';

/**
 * Query Key Factory for Admin Audit Logs
 */
export const adminAuditLogKeys = {
  all: ['admin-audit-logs'],
  list: (params = {}) => [...adminAuditLogKeys.all, 'list', params],
  filterOptions: () => [...adminAuditLogKeys.all, 'filter-options'],
  summary: (params = {}) => [...adminAuditLogKeys.all, 'summary', params],
};

export function useAdminAuditLogs(params = {}) {
  return useQuery({
    queryKey: adminAuditLogKeys.list(params),
    queryFn: () => listAuditLogs(params),
  });
}

// Powers the Action/Table filter dropdowns with the values actually present
// in the table (see AuditLogViewSet.filter_options), not a hardcoded list
// that would drift as new action types get added elsewhere in the app.
export function useAdminAuditLogFilterOptions() {
  return useQuery({
    queryKey: adminAuditLogKeys.filterOptions(),
    queryFn: getAuditLogFilterOptions,
  });
}

// Powers the 5 KPI cards on the Audit Logs page.
export function useAdminAuditLogSummary(params = {}) {
  return useQuery({
    queryKey: adminAuditLogKeys.summary(params),
    queryFn: () => getAuditLogSummary(params),
  });
}
