import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import managerReportService from '../../../services/manager/managerReportService';

/**
 * Query Key Factory for Manager Audit Logs & System Notifications
 */
export const managerAuditKeys = {
  all: ['manager-audit-logs'],
  list: (params = {}) => [...managerAuditKeys.all, 'list', { params }],
  notifications: (params = {}) => ['manager-notifications', { params }],
};

/**
 * Fetch audit logs list with caching
 */
export function useManagerAuditLogs(params = {}) {
  return useQuery({
    queryKey: managerAuditKeys.list(params),
    queryFn: () => managerReportService.getAuditLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch manager system notifications
 */
export function useManagerNotifications(params = {}) {
  return useQuery({
    queryKey: managerAuditKeys.notifications(params),
    queryFn: () => managerReportService.getNotifications(params),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  });
}

/**
 * Mutation: Mark single notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => managerReportService.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-notifications'] });
    },
  });
}

/**
 * Mutation: Mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => managerReportService.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-notifications'] });
      toast.success('All notifications marked as read!');
    },
  });
}
