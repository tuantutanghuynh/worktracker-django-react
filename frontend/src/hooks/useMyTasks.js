import { useState, useEffect } from "react"
import { getMyTasks, changeTaskStatus } from "../api/myTasksApi"
import { getErrorMessage } from "../utils/errorMessages"

// Employee's My Tasks list (Ngày 7) — fetches once on mount, exposes
// changeStatus() which refetches the list after a successful transition
// so status/order_index stay in sync with the backend (apply_transition()
// may reject the change, so we don't optimistically update locally).
export function useMyTasks() {
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        async function loadTasks() {
            try {
                const data = await getMyTasks()
                if (cancelled) return
                setTasks(data)
            } catch (err) {
                if (cancelled) return
                setError(getErrorMessage(err, "Failed to load tasks"))
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadTasks()

        return () => {
            cancelled = true
        }
    }, [])

    // Submits a status change, then reloads the full list — backend is
    // the source of truth for whether the transition was actually valid.
    async function changeStatus(taskId, newStatus) {
        try {
            await changeTaskStatus(taskId, newStatus)
            const data = await getMyTasks()
            setTasks(data)
            return true
        } catch (err) {
            setError(getErrorMessage(err, "Failed to update task status"))
            return false
        }
    }

    return { tasks, loading, error, changeStatus }
}
