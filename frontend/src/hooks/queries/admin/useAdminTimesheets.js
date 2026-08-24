import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getTimesheetSummary,
  listTimesheetEmployees,
  getTimesheetEmployeeDetail,
  listGlobalTimeLocks,
  lockGlobalPeriod,
  unlockGlobalPeriod,
} from '../../../api/admin/timesheets';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Admin Timesheet Control
 */
export const adminTimesheetKeys = {
  all: ['admin-timesheets'],
  summary: (params = {}) => [...adminTimesheetKeys.all, 'summary', params],
  employees: (params = {}) => [...adminTimesheetKeys.all, 'employees', params],
  employeeDetail: (userId, params = {}) => [...adminTimesheetKeys.all, 'employee-detail', userId, params],
  timeLocks: (params = {}) => [...adminTimesheetKeys.all, 'time-locks', params],
};

export function useAdminTimesheetSummary(params) {
  return useQuery({
    queryKey: adminTimesheetKeys.summary(params),
    queryFn: () => getTimesheetSummary(params),
    enabled: !!(params?.month && params?.year),
  });
}

export function useAdminTimesheetEmployees(params) {
  return useQuery({
    queryKey: adminTimesheetKeys.employees(params),
    queryFn: () => listTimesheetEmployees(params),
    enabled: !!(params?.month && params?.year),
  });
}

export function useAdminTimesheetEmployeeDetail(userId, params) {
  return useQuery({
    queryKey: adminTimesheetKeys.employeeDetail(userId, params),
    queryFn: () => getTimesheetEmployeeDetail(userId, params),
    enabled: !!userId && !!(params?.month && params?.year),
  });
}

// GLOBAL-scope TimeLock history — used to find the existing lock (if any)
// for the currently selected month/year, to decide whether the toolbar
// button should Lock or Unlock.
export function useAdminGlobalTimeLocks(params = {}) {
  return useQuery({
    queryKey: adminTimesheetKeys.timeLocks(params),
    queryFn: () => listGlobalTimeLocks(params),
  });
}

export function useLockGlobalPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => lockGlobalPeriod(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTimesheetKeys.all });
      toast.success('Timesheet period locked company-wide.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to lock period.')),
  });
}

export function useUnlockGlobalPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => unlockGlobalPeriod(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTimesheetKeys.all });
      toast.success('Timesheet period unlocked.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to unlock period.')),
  });
}
