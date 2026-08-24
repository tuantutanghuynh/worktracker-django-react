import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listJobs, createJob, updateJob, cancelJob, acquireJobLock, releaseJobLock } from '../../../api/admin/jobs';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Admin Jobs
 */
export const adminJobKeys = {
  all: ['admin-jobs'],
  list: (params = {}) => [...adminJobKeys.all, 'list', params],
};

export function useAdminJobs(params = {}) {
  return useQuery({
    queryKey: adminJobKeys.list(params),
    queryFn: () => listJobs(params),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createJob(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminJobKeys.all });
      toast.success('Job created.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create job.')),
  });
}

// Edit deliberately never sends `client` — JobSerializer.validate_client()
// rejects ANY value pointing at an inactive client, including the job's
// own current one if it was deactivated after the job was created. See
// JobsPage.jsx's edit form for the full explanation.
export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateJob(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminJobKeys.all });
      toast.success('Job updated.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update job.')),
  });
}

// Doesn't hard-delete — JobViewSet.perform_destroy sets status to CANCELLED.
export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => cancelJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminJobKeys.all });
      toast.success('Job cancelled.');
    },
    onError: () => toast.error('Failed to cancel job.'),
  });
}

// No onError toast here — JobsPage handles the 423 "someone else is
// editing this" case itself (keeps the modal closed instead of showing it
// briefly then erroring out).
export function useAcquireJobLock() {
  return useMutation({ mutationFn: (id) => acquireJobLock(id) });
}

export function useReleaseJobLock() {
  return useMutation({ mutationFn: (id) => releaseJobLock(id) });
}
