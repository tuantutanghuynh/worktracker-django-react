import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listClients, getClient, createClient, updateClient, deleteClient, restoreClient } from '../../../api/admin/clients';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Admin Clients
 */
export const adminClientKeys = {
  all: ['admin-clients'],
  list: (params = {}) => [...adminClientKeys.all, 'list', params],
  detail: (id) => [...adminClientKeys.all, 'detail', id],
};

/**
 * Fetch paginated/filtered/sorted list of clients — ClientViewSet.get_queryset()
 * handles ?search=, OrderingFilter handles ?ordering=, AdminPageNumberPagination
 * handles ?page= (15/page).
 */
export function useAdminClients(params = {}) {
  return useQuery({
    queryKey: adminClientKeys.list(params),
    queryFn: () => listClients(params),
  });
}

/**
 * Deep-link support (bell dropdown / data-quality alerts pointing at
 * ?edit=<id>) — fetches one client directly instead of relying on it being
 * present on whatever page/filter is currently loaded.
 */
export function useAdminClientDeepLink(id) {
  return useQuery({
    queryKey: adminClientKeys.detail(id),
    queryFn: () => getClient(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminClientKeys.all });
      toast.success('Client created.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Save failed.')),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateClient(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminClientKeys.all });
      toast.success('Client updated.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Save failed.')),
  });
}

// Client never gets hard-deleted — the backend only flips is_active to
// False (ClientViewSet.perform_destroy).
export function useDeactivateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminClientKeys.all });
      toast.success('Client deactivated.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Delete failed.')),
  });
}

export function useRestoreClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => restoreClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminClientKeys.all });
      toast.success('Client restored.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Restore failed.')),
  });
}
