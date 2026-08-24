import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getMyTasks, changeTaskStatus } from "../../../api/myTasksApi"
import { getErrorMessage } from "../../../utils/errorMessages"

export const myTasksKeys = {
    all: ['my-tasks'],
    list: () => [...myTasksKeys.all, 'list'],
}

// Employee's My Tasks list (Ngày 7) — query + 1 mutation (status change).
// Errors from the status mutation surface as a toast (matches Manager's
// mutation pattern), not a page-blocking error — a failed transition
// shouldn't wipe out the whole task list the user is looking at.
export function useMyTasks() {
    const queryClient = useQueryClient()

    const { data, isLoading, error: queryError } = useQuery({
        queryKey: myTasksKeys.list(),
        queryFn: getMyTasks,
    })

    const statusMutation = useMutation({
        mutationFn: ({ taskId, newStatus }) => changeTaskStatus(taskId, newStatus),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: myTasksKeys.list() })
        },
        onError: (err) => {
            toast.error(getErrorMessage(err, "Failed to update task status"))
        },
    })

    async function changeStatus(taskId, newStatus) {
        try {
            await statusMutation.mutateAsync({ taskId, newStatus })
            return true
        } catch {
            return false
        }
    }

    return {
        tasks: data ?? [],
        loading: isLoading,
        error: queryError ? getErrorMessage(queryError, "Failed to load tasks") : null,
        changeStatus,
    }
}
