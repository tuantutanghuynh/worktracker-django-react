import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  lockUser,
  unlockUser,
  resetUserPassword,
  assignUserDepartment,
  listRoles,
} from '../../../api/admin/users';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Admin Users
 */
export const adminUserKeys = {
  all: ['admin-users'],
  list: (params = {}) => [...adminUserKeys.all, 'list', params],
  detail: (id) => [...adminUserKeys.all, 'detail', id],
};

export function useAdminUsers(params = {}, options = {}) {
  return useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: () => listUsers(params),
    ...options,
  });
}

/**
 * Deep-link support (bell dropdown / data-quality alerts pointing at
 * ?edit=<id>) — fetches one user directly instead of relying on it being
 * present on whatever search/page is currently loaded.
 */
export function useAdminUserDeepLink(id) {
  return useQuery({
    queryKey: adminUserKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: !!id,
  });
}

export function useAdminRoles() {
  return useQuery({ queryKey: ['admin-roles'], queryFn: listRoles });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success('User created. They must change this password on first login.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create user.')),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success('User updated.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Update failed.')),
  });
}

// Deliberately calls the dedicated lock/unlock actions instead of a plain
// PATCH is_active — those also revoke the Redis-cached session, a plain
// PATCH would leave an already-issued JWT usable until it expires.
export function useLockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => lockUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success('Account locked.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to change account status.')),
  });
}

export function useUnlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => unlockUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success('Account unlocked.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to change account status.')),
  });
}

// departmentId=null clears the assignment — same endpoint handles both
// "assign to X" and "remove from department" (assign-department action on
// UserViewSet just writes whatever it's given to profile.department).
export function useAssignUserDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, departmentId }) => assignUserDepartment(id, departmentId),
    onSuccess: (_data, { departmentId }) => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success(departmentId ? 'Department assigned.' : 'Removed from department.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update department.')),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }) => resetUserPassword(id, newPassword),
    onSuccess: () => toast.success('Password reset. The user must change it on next login.'),
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to reset password.')),
  });
}
