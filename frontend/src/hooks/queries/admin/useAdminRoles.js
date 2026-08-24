import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  assignPermissions,
} from '../../../api/admin/roles';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Admin Roles & Permissions
 */
export const adminRoleKeys = {
  all: ['admin-roles'],
  list: () => [...adminRoleKeys.all, 'list'],
  detail: (id) => [...adminRoleKeys.all, 'detail', id],
  permissions: ['admin-permissions'],
};

export function useAdminRolesList() {
  return useQuery({ queryKey: adminRoleKeys.list(), queryFn: listRoles });
}

export function useAdminRoleDetail(id) {
  return useQuery({
    queryKey: adminRoleKeys.detail(id),
    queryFn: () => getRole(id),
    enabled: !!id,
  });
}

// Read-only catalog of every permission code in the system — used to render
// the checkbox list when editing a role's assign-permissions set.
export function useAdminPermissions() {
  return useQuery({ queryKey: adminRoleKeys.permissions, queryFn: listPermissions, staleTime: Infinity });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
      toast.success('Role created.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create role.')),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
      toast.success('Role updated.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update role.')),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
      toast.success('Role deleted.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete role.')),
  });
}

export function useAssignPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }) => assignPermissions(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
      toast.success('Permissions updated.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update permissions.')),
  });
}
