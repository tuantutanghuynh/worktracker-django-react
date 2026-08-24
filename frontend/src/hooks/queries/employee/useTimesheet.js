import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getMyTimesheet } from "../../../api/timesheetApi"
import { createLogWork, voidLogWork, editLogWork } from "../../../api/logWorkApi"
import { getErrorMessage } from "../../../utils/errorMessages"
import { dashboardKeys } from "./useDashboard"

export const timesheetKeys = {
    all: ['employee-timesheet'],
    list: () => [...timesheetKeys.all, 'list'],
}

export function useTimesheet() {
    const queryClient = useQueryClient()

    const { data, isLoading, error: queryError } = useQuery({
        queryKey: timesheetKeys.list(),
        queryFn: getMyTimesheet,
    })

    function invalidateAfterChange() {
        queryClient.invalidateQueries({ queryKey: timesheetKeys.list() })
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    }

    const logWorkMutation = useMutation({
        mutationFn: createLogWork,
        onSuccess: () => {
            invalidateAfterChange()
            toast.success('Work logged successfully!')
        },
        // Time Lock (403) rơi vào đây — backend đã trả message rõ ràng
        // "...(GLOBAL lock)..."/"...(JOB lock)..." nên không cần code
        // riêng để phân biệt, toast hiện thẳng message backend.
        onError: (err) => toast.error(getErrorMessage(err, "Failed to log work")),
    })

    const voidMutation = useMutation({
        mutationFn: ({ logWorkId, reason }) => voidLogWork(logWorkId, reason),
        onSuccess: () => {
            invalidateAfterChange()
            toast.success('Log work voided.')
        },
        onError: (err) => toast.error(getErrorMessage(err, "Failed to void log work")),
    })

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

    const editMutation = useMutation({
        mutationFn: ({ logWorkId, hoursSpent, description, reason }) =>
            editLogWork(logWorkId, { hours_spent: hoursSpent, description, adjustment_reason: reason }),
        onSuccess: () => {
            invalidateAfterChange()
            toast.success('Log work updated.')
        },
        onError: (err) => toast.error(getErrorMessage(err, "Failed to edit log work")),
    })

    async function submitEditLogWork(logWorkId, hoursSpent, description, reason) {
        try {
            await editMutation.mutateAsync({ logWorkId, hoursSpent, description, reason })
            return true
        } catch {
            return false
        }
    }

    return {
        entries: data ?? [],
        loading: isLoading,
        error: queryError ? getErrorMessage(queryError, "Failed to load timesheet") : null,
        submitting: logWorkMutation.isPending || voidMutation.isPending || editMutation.isPending,
        submitLogWork,
        submitVoidLogWork,
        submitEditLogWork,
    }
}
