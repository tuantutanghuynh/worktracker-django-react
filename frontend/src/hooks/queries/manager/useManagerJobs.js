import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import managerJobService from '../../../services/manager/managerJobService';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Manager Jobs
 */
export const managerJobKeys = {
  all: ['manager-jobs'],
  lists: () => [...managerJobKeys.all, 'list'],
  list: (params = {}) => [...managerJobKeys.lists(), { params }],
  details: () => [...managerJobKeys.all, 'detail'],
  detail: (id) => [...managerJobKeys.details(), id],
};

/**
 * Fetch paginated list of jobs with caching and automatic background refetching
 */
export function useManagerJobs(params = {}) {
  return useQuery({
    queryKey: managerJobKeys.list(params),
    queryFn: () => managerJobService.getJobs(params),
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000, // 3 minutes cache
  });
}

/**
 * Fetch detail of a single job
 */
export function useManagerJobDetail(id) {
  return useQuery({
    queryKey: managerJobKeys.detail(id),
    queryFn: () => managerJobService.getJobDetail(id),
    enabled: Boolean(id),
  });
}

/**
 * Mutation: Create a new Job
 */
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => managerJobService.createJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerJobKeys.all });
      toast.success('Project created successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create project'));
    },
  });
}

/**
 * Mutation: Update existing Job
 */
export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => managerJobService.updateJob(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerJobKeys.all });
      toast.success('Project updated successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to update project'));
    },
  });
}

/**
 * Mutation: Change Job Status (State Machine)
 */
export function useChangeJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newStatus, reason }) => managerJobService.changeJobStatus(id, newStatus, reason),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: managerJobKeys.all });
      toast.success(`Job status changed to ${variables.newStatus}`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Status change rejected'));
    },
  });
}
