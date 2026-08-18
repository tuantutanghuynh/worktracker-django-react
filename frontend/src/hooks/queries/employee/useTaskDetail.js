import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getMyTaskDetail, addTaskComment, uploadTaskAttachment } from "../../../api/myTasksApi"
import { createLogWork, voidLogWork } from "../../../api/logWorkApi"
import { getErrorMessage } from "../../../utils/errorMessages"
import { dashboardKeys } from "./useDashboard"

export const taskDetailKeys = {
    all: ['task-detail'],
    detail: (taskId) => [...taskDetailKeys.all, taskId],
}

// Manages the "extra" data a task's SideDrawer needs beyond the list
// row — comments, work logs (with void), attachment upload, and logging
// new work against this specific task. enabled: false when no taskId
// (drawer closed) skips the fetch, same pattern as useManagerJobs' Sidebar
// gating. Every mutation just invalidates + refetches instead of
// manually merging response shapes — createLogWork()/voidLogWork() don't
// return the same shape as the GET detail response, so trusting the
// refetched data instead of the mutation response avoids that whole bug class.
export function useTaskDetail(taskId) {
    const queryClient = useQueryClient()

    const { data, isLoading, error: queryError } = useQuery({
        queryKey: taskDetailKeys.detail(taskId),
        queryFn: () => getMyTaskDetail(taskId),
        enabled: Boolean(taskId),
    })

    function invalidateDetail() {
        queryClient.invalidateQueries({ queryKey: taskDetailKeys.detail(taskId) })
    }

    const commentMutation = useMutation({
        mutationFn: (content) => addTaskComment(taskId, content),
        onSuccess: invalidateDetail,
        onError: (err) => toast.error(getErrorMessage(err, "Failed to add comment")),
    })

    const attachmentMutation = useMutation({
        mutationFn: (file) => uploadTaskAttachment(taskId, file),
        onSuccess: invalidateDetail,
        onError: (err) => toast.error(getErrorMessage(err, "Failed to upload file")),
    })

    // Logging/voiding work also changes hours_logged_this_week/daily_hours_trend
    // on Dashboard + My Performance — invalidate that cache too so those
    // pages don't show stale numbers if visited right after.
    const logWorkMutation = useMutation({
        mutationFn: ({ work_date, hours_spent, description }) =>
            createLogWork({ task: taskId, work_date, hours_spent, description }),
        onSuccess: () => {
            invalidateDetail()
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
            toast.success('Work logged successfully!')
        },
        onError: (err) => toast.error(getErrorMessage(err, "Failed to log work")),
    })

    const voidMutation = useMutation({
        mutationFn: ({ logWorkId, reason }) => voidLogWork(logWorkId, reason),
        onSuccess: () => {
            invalidateDetail()
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
            toast.success('Log work voided.')
        },
        onError: (err) => toast.error(getErrorMessage(err, "Failed to void log work")),
    })

    async function submitComment(content) {
        try {
            await commentMutation.mutateAsync(content)
            return true
        } catch {
            return false
        }
    }

    async function submitAttachment(file) {
        try {
            await attachmentMutation.mutateAsync(file)
            return true
        } catch {
            return false
        }
    }

    async function submitLogWork(payload) {
        try {
            await logWorkMutation.mutateAsync(payload)
            return true
        } catch {
            return false
        }
    }

    async function submitVoidLogWork(logWorkId, reason) {
        try {
            await voidMutation.mutateAsync({ logWorkId, reason })
            return true
        } catch {
            return false
        }
    }

    const submitting =
        commentMutation.isPending || attachmentMutation.isPending ||
        logWorkMutation.isPending || voidMutation.isPending

    return {
        comments: data?.comments ?? [],
        workLogs: data?.work_logs ?? [],
        loadingDetail: isLoading,
        submitting,
        error: queryError ? getErrorMessage(queryError, "Failed to load task detail") : null,
        submitComment, submitAttachment, submitLogWork, submitVoidLogWork,
    }
}
