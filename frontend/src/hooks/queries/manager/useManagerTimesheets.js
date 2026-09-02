import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import managerTimesheetService from '../../../services/manager/managerTimesheetService';
import { getErrorMessage } from '../../../utils/errorMessages';
import { managerDashboardKeys } from './useManagerDashboard';

/**
 * Query Key Factory for Manager Timesheets & TimeLocks
 */
export const managerTimesheetKeys = {
  all: ['manager-timesheets'],
  logWorks: (params = {}) => [...managerTimesheetKeys.all, 'log-works', { params }],
  logWorkDetail: (id) => [...managerTimesheetKeys.all, 'log-work-detail', id],
  timeLocks: (params = {}) => [...managerTimesheetKeys.all, 'time-locks', { params }],
  timeLockDetail: (id) => [...managerTimesheetKeys.all, 'time-lock-detail', id],
};

/**
 * Fetch log works list
 */
export function useLogWorks(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: managerTimesheetKeys.logWorks(params),
    queryFn: () => managerTimesheetService.getLogWorks(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Mac dinh true -> cac noi goi cu khong doi hanh vi. Sidebar truyen
    // false cho Admin/Employee de khong ban request luon nhan 403.
    enabled,
  });
}

/**
 * Fetch log work detail
 */
export function useLogWorkDetail(id) {
  return useQuery({
    queryKey: managerTimesheetKeys.logWorkDetail(id),
    queryFn: () => managerTimesheetService.getLogWorkDetail(id),
    enabled: Boolean(id),
  });
}

/**
 * Mutation: Approve a LogWork entry
 */
export function useApproveLogWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }) => managerTimesheetService.approveLogWork(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      queryClient.invalidateQueries({ queryKey: managerDashboardKeys.all });
      toast.success('LogWork entry approved successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to approve LogWork'));
    },
  });
}

/**
 * Mutation: Reject a LogWork entry
 */
export function useRejectLogWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => managerTimesheetService.rejectLogWork(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      queryClient.invalidateQueries({ queryKey: managerDashboardKeys.all });
      toast.success('LogWork entry rejected!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to reject LogWork'));
    },
  });
}

/**
 * Mutation: Correct / Adjust a LogWork entry
 */
export function useCorrectLogWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => managerTimesheetService.correctLogWork(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      queryClient.invalidateQueries({ queryKey: managerDashboardKeys.all });
      toast.success('LogWork hours adjusted successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to adjust LogWork'));
    },
  });
}

/**
 * Mutation: Void / Invalidate a LogWork entry
 */
export function useVoidLogWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => managerTimesheetService.voidLogWork(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      queryClient.invalidateQueries({ queryKey: managerDashboardKeys.all });
      toast.success('LogWork entry voided!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to void LogWork'));
    },
  });
}

/**
 * Fetch time locks list
 */
export function useTimeLocks(params = {}) {
  return useQuery({
    queryKey: managerTimesheetKeys.timeLocks(params),
    queryFn: () => managerTimesheetService.getTimeLocks(params),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}

/**
 * Mutation: Lock a time period for a job
 */
export function useCreateTimeLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => managerTimesheetService.createTimeLock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      toast.success('Period locked successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to lock period'));
    },
  });
}

/**
 * Mutation: Unlock a time period
 */
export function useUnlockTimeLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => managerTimesheetService.unlockTimeLock(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      toast.success('Period unlocked successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to unlock period'));
    },
  });
}
