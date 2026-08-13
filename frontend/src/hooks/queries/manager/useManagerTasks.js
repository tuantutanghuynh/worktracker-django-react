import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import managerTaskService from '../../../services/manager/managerTaskService';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Manager Tasks
 */
export const managerTaskKeys = {
  all: ['manager-tasks'],
  lists: () => [...managerTaskKeys.all, 'list'],
  list: (params = {}) => [...managerTaskKeys.lists(), { params }],
  kanban: (jobId) => [...managerTaskKeys.all, 'kanban', jobId],
  details: () => [...managerTaskKeys.all, 'detail'],
  detail: (id) => [...managerTaskKeys.details(), id],
  comments: (id) => [...managerTaskKeys.detail(id), 'comments'],
  attachments: (id) => [...managerTaskKeys.detail(id), 'attachments'],
};

/**
 * Fetch task list with caching
 */
export function useManagerTasks(params = {}) {
  return useQuery({
    queryKey: managerTaskKeys.list(params),
    queryFn: () => managerTaskService.getTasks(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch single task detail
 */
export function useManagerTaskDetail(id) {
  return useQuery({
    queryKey: managerTaskKeys.detail(id),
    queryFn: () => managerTaskService.getTaskDetail(id),
    enabled: Boolean(id),
  });
}

/**
 * Fetch Kanban Board for a Job
 */
export function useJobKanban(jobId) {
  return useQuery({
    queryKey: managerTaskKeys.kanban(jobId),
    queryFn: () => managerTaskService.getJobKanban(jobId),
    enabled: Boolean(jobId),
    staleTime: 15 * 1000, // 15s for Kanban
  });
}

/**
 * Mutation: Create a Task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => managerTaskService.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
      toast.success('Task created successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create task'));
    },
  });
}

/**
 * Mutation: Update Task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => managerTaskService.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
      toast.success('Task updated successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to update task'));
    },
  });
}

/**
 * ⚡ Mutation: Change Task Status WITH OPTIMISTIC UI UPDATES (Instant 0.01s Response)
 */
export function useChangeTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, toStatus, reason }) => managerTaskService.changeTaskStatus(id, toStatus, reason),
    onMutate: async ({ id, toStatus }) => {
      // 1. Tạm dừng các refetches đang chạy để tránh đè UI
      await queryClient.cancelQueries({ queryKey: managerTaskKeys.all });

      // 2. Lưu snapshot dữ liệu cũ để rollback nếu bị lỗi mạng/backend
      const previousQueriesData = queryClient.getQueriesData({ queryKey: managerTaskKeys.all });

      // 3. 🚀 CẬP NHẬT TRỰC TIẾP TRẠNG THÁI TASK TRONG CACHE NGAY TẮC THÌ (0ms)
      queryClient.setQueriesData({ queryKey: managerTaskKeys.all }, (oldData) => {
        if (!oldData) return oldData;

        // Nếu dữ liệu dạng Paginated { results: [...] }
        if (Array.isArray(oldData.results)) {
          return {
            ...oldData,
            results: oldData.results.map((t) =>
              String(t.id) === String(id) ? { ...t, status: toStatus } : t
            ),
          };
        }

        // Nếu dữ liệu dạng Array [...]
        if (Array.isArray(oldData)) {
          return oldData.map((t) =>
            String(t.id) === String(id) ? { ...t, status: toStatus } : t
          );
        }

        return oldData;
      });

      return { previousQueriesData };
    },
    onError: (err, variables, context) => {
      // Hoàn tác về dữ liệu cũ nếu bị lỗi
      if (context?.previousQueriesData) {
        context.previousQueriesData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(getErrorMessage(err, 'Status change failed'));
    },
    onSettled: () => {
      // Âm thầm đồng bộ lại với Database Django dưới nền
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
    },
  });
}

/**
 * ⚡ Mutation: LexoRank Drag-and-Drop Task Move with Optimistic UI Updates
 */
export function useMoveTaskLexoRank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, moveParams }) => managerTaskService.moveTask(id, moveParams),
    onMutate: async ({ id, moveParams }) => {
      const jobId = moveParams?.jobId;
      if (!jobId) return;

      await queryClient.cancelQueries({ queryKey: managerTaskKeys.kanban(jobId) });
      const previousKanban = queryClient.getQueryData(managerTaskKeys.kanban(jobId));

      return { previousKanban, jobId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
    },
    onError: (err, newTodo, context) => {
      if (context?.jobId && context?.previousKanban) {
        queryClient.setQueryData(managerTaskKeys.kanban(context.jobId), context.previousKanban);
      }
      toast.error(getErrorMessage(err, 'Move rejected'));
    },
  });
}

/**
 * Fetch task comments
 */
export function useTaskComments(taskId) {
  return useQuery({
    queryKey: managerTaskKeys.comments(taskId),
    queryFn: () => managerTaskService.getComments(taskId),
    enabled: Boolean(taskId),
  });
}

/**
 * Mutation: Add comment to task
 */
export function useAddComment(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content) => managerTaskService.addComment(taskId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.comments(taskId) });
      toast.success('Comment added');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to add comment'));
    },
  });
}
