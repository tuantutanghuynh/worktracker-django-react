import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import managerTaskService from '../../../services/manager/managerTaskService';
import { getErrorMessage } from '../../../utils/errorMessages';

export const managerTaskKeys = {
  all: ['manager-tasks'],
  list: (filters) => ['manager-tasks', 'list', filters],
  detail: (id) => ['manager-tasks', 'detail', id],
  kanban: (jobId) => ['manager-tasks', 'kanban', jobId],
};

/**
 * 🚀 Hook: Fetch paginated / filtered tasks
 */
export function useManagerTasks(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: managerTaskKeys.list(params),
    queryFn: () => managerTaskService.getTasks(params),
    staleTime: 1000 * 30, // 30 seconds
    // Mac dinh true -> 13 noi goi cu khong doi hanh vi. Sidebar truyen
    // false cho Admin/Employee de khong ban request luon nhan 403.
    enabled,
  });
}

/**
 * 🚀 Hook: Fetch single task detail
 */
export function useManagerTaskDetail(taskId) {
  return useQuery({
    queryKey: managerTaskKeys.detail(taskId),
    queryFn: () => managerTaskService.getTaskDetail(taskId),
    enabled: Boolean(taskId),
  });
}

/**
 * 🚀 Mutation: Create new Task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskData) => managerTaskService.createTask(taskData),
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
 * 🚀 Mutation: Update Task detail
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
 * ⚡ Mutation: Change Task Status WITH OPTIMISTIC UI UPDATES & SILENT COMMIT
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

      // 3. 🚀 OPTIMISTIC UI: CẬP NHẬT TRỰC TIẾP TRẠNG THÁI TASK TRONG CACHE NGAY TẮC THÌ (0ms)
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
    onSuccess: () => {
      // 🔕 SILENT COMMIT: Không nổ Toast xanh dồn dập khi kéo thả bình thường
    },
    onError: (err, variables, context) => {
      // 🔄 AUTOMATIC ROLLBACK: Hoàn tác về vị trí cũ nếu bị lỗi
      if (context?.previousQueriesData) {
        context.previousQueriesData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(getErrorMessage(err, 'Status change rejected by server'));
    },
    onSettled: () => {
      // Âm thầm đồng bộ lại với Database Django dưới nền
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
    },
  });
}

/**
 * ⚡ Mutation: LexoRank Drag-and-Drop Task Move WITH OPTIMISTIC UI UPDATES & SILENT COMMIT
 */
export function useMoveTaskLexoRank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, moveParams }) => managerTaskService.moveTask(id, moveParams),
    onMutate: async ({ id, moveParams }) => {
      // 1. Tạm dừng refetches đang chạy
      await queryClient.cancelQueries({ queryKey: managerTaskKeys.all });

      // 2. Lưu snapshot dữ liệu cũ để rollback nếu lỗi
      const previousQueriesData = queryClient.getQueriesData({ queryKey: managerTaskKeys.all });

      // 3. 🚀 OPTIMISTIC UI: CẬP NHẬT THỨ TỰ TỨC THÌ TRONG CACHE (0ms)
      const { prev_task_id, next_task_id, to_status } = moveParams || {};

      queryClient.setQueriesData({ queryKey: managerTaskKeys.all }, (oldData) => {
        if (!oldData) return oldData;

        let items = Array.isArray(oldData)
          ? [...oldData]
          : Array.isArray(oldData.results)
          ? [...oldData.results]
          : null;

        if (!items) return oldData;

        const targetIndex = items.findIndex((t) => String(t.id) === String(id));
        if (targetIndex === -1) return oldData;

        const movedTask = { ...items[targetIndex] };
        if (to_status) {
          movedTask.status = to_status;
        }

        // Tách task cần di chuyển ra khỏi vị trí cũ
        items.splice(targetIndex, 1);

        // 🎯 CHÈN CHÍNH XÁC THEO MỤC TIÊU PREV HOẶC NEXT TASK
        let insertIndex = -1;

        if (next_task_id) {
          const nextIdx = items.findIndex((t) => String(t.id) === String(next_task_id));
          if (nextIdx !== -1) {
            insertIndex = nextIdx;
          }
        } else if (prev_task_id) {
          const prevIdx = items.findIndex((t) => String(t.id) === String(prev_task_id));
          if (prevIdx !== -1) {
            insertIndex = prevIdx + 1;
          }
        }

        if (insertIndex !== -1) {
          items.splice(insertIndex, 0, movedTask);
        } else {
          // Trường hợp đưa lên đầu cột
          const firstTaskInColumnIdx = items.findIndex((t) => t.status === (to_status || movedTask.status));
          if (firstTaskInColumnIdx !== -1) {
            items.splice(firstTaskInColumnIdx, 0, movedTask);
          } else {
            items.unshift(movedTask);
          }
        }

        return Array.isArray(oldData) ? items : { ...oldData, results: items };
      });

      return { previousQueriesData };
    },
    onSuccess: () => {
      // 🔕 SILENT COMMIT: Âm thầm xác nhận reorder
    },
    onError: (err, variables, context) => {
      // 🔄 AUTOMATIC ROLLBACK: Trở về vị trí cũ khi bị lỗi
      if (context?.previousQueriesData) {
        context.previousQueriesData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(getErrorMessage(err, 'Reorder rejected by server'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
    },
  });
}

/**
 * 🚀 Mutation: Approve Task
 */
export function useApproveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => managerTaskService.approveTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
      toast.success('Task approved successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to approve task'));
    },
  });
}

/**
 * 🚀 Mutation: Reject Task
 */
export function useRejectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => managerTaskService.rejectTask(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
      toast.success('Task rejected and sent back to In Progress!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to reject task'));
    },
  });
}

/**
 * 🚀 Mutation: Cancel Task
 */
export function useCancelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => managerTaskService.cancelTask(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.all });
      toast.success('Task cancelled successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to cancel task'));
    },
  });
}

/**
 * 💬 Hook: Fetch Task Comments
 */
export function useTaskComments(taskId) {
  return useQuery({
    queryKey: ['manager-task-comments', taskId],
    queryFn: () => managerTaskService.getComments(taskId),
    enabled: Boolean(taskId),
  });
}

/**
 * 💬 Mutation: Add Task Comment
 */
export function useCreateTaskComment(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content) => managerTaskService.addComment(taskId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-task-comments', taskId] });
      toast.success('Comment posted!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to post comment'));
    },
  });
}

/**
 * 📎 Hook: Fetch Task Attachments
 */
export function useTaskAttachments(taskId) {
  return useQuery({
    queryKey: ['manager-task-attachments', taskId],
    queryFn: () => managerTaskService.getAttachments(taskId),
    enabled: Boolean(taskId),
  });
}

/**
 * 📎 Mutation: Upload Task Attachment
 */
export function useUploadTaskAttachment(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData) => managerTaskService.uploadAttachment(taskId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-task-attachments', taskId] });
      queryClient.invalidateQueries({ queryKey: managerTaskKeys.detail(taskId) });
      toast.success('File uploaded successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to upload attachment'));
    },
  });
}

/**
 * 👥 Hook: Fetch Task Followers
 */
export function useTaskFollowers(taskId) {
  return useQuery({
    queryKey: ['manager-task-followers', taskId],
    queryFn: () => managerTaskService.getFollowers(taskId),
    enabled: Boolean(taskId),
  });
}

/**
 * 👥 Mutation: Follow Task
 */
export function useFollowTask(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => managerTaskService.followTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-task-followers', taskId] });
      toast.success('Following task updates!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to follow task'));
    },
  });
}

/**
 * 👥 Mutation: Unfollow Task
 */
export function useUnfollowTask(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => managerTaskService.unfollowTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-task-followers', taskId] });
      toast.success('Unfollowed task.');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to unfollow task'));
    },
  });
}

