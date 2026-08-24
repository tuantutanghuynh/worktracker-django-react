import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../../api/admin/departments';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Admin Departments
 */
export const adminDepartmentKeys = {
  all: ['admin-departments'],
  list: (params = {}) => [...adminDepartmentKeys.all, 'list', params],
  detail: (id) => [...adminDepartmentKeys.all, 'detail', id],
};

export function useAdminDepartments(params = {}) {
  return useQuery({
    queryKey: adminDepartmentKeys.list(params),
    queryFn: () => listDepartments(params),
  });
}

/**
 * Deep-link support (bell dropdown / data-quality alerts pointing at
 * ?edit=<id>) — fetches one department directly instead of relying on it
 * being present on whatever page/filter is currently loaded.
 */
export function useAdminDepartmentDeepLink(id) {
  return useQuery({
    queryKey: adminDepartmentKeys.detail(id),
    queryFn: () => getDepartment(id),
    enabled: !!id,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDepartmentKeys.all });
      toast.success('Department created.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Save failed.')),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateDepartment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDepartmentKeys.all });
      toast.success('Department updated.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Save failed.')),
  });
}

// Can fail with a 400 if the department still has employees assigned
// (EmployeeProfile.department is on_delete=RESTRICT) — DepartmentViewSet
// turns that into a clear detail message instead of a raw 500.
export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDepartmentKeys.all });
      toast.success('Department deleted.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Delete failed.')),
  });
}
