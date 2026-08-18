import { useState, useEffect } from "react"
import { getMyTaskDetail, addTaskComment, uploadTaskAttachment } from "../api/myTasksApi"
import { createLogWork, voidLogWork } from "../api/logWorkApi"
import { getErrorMessage } from "../utils/errorMessages"

// Manages the "extra" data a task's SideDrawer needs beyond the list
// row — comments, work logs (with void), attachment upload, and logging
// new work against this specific task. Only fetches once taskId is given.
export function useTaskDetail(taskId) {
    const [comments, setComments] = useState([])
    const [workLogs, setWorkLogs] = useState([])
    const [loadingDetail, setLoadingDetail] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!taskId) return

        let cancelled = false

        async function loadDetail() {
            try {
                const data = await getMyTaskDetail(taskId)
                if (cancelled) return
                setComments(data.comments)
                setWorkLogs(data.work_logs)
            } catch (err) {
                if (cancelled) return
                setError(getErrorMessage(err, "Failed to load task detail"))
            } finally {
                if (!cancelled) setLoadingDetail(false)
            }
        }

        loadDetail()

        return () => {
            cancelled = true
        }
    }, [taskId])

    async function submitComment(content) {
        setSubmitting(true)
        setError(null)
        try {
            const newComment = await addTaskComment(taskId, content)
            setComments((prev) => [...prev, newComment])
            return true
        } catch (err) {
            setError(getErrorMessage(err, "Failed to add comment"))
            return false
        } finally {
            setSubmitting(false)
        }
    }

    async function submitAttachment(file) {
        setSubmitting(true)
        setError(null)
        try {
            await uploadTaskAttachment(taskId, file)
            return true
        } catch (err) {
            setError(getErrorMessage(err, "Failed to upload file"))
            return false
        } finally {
            setSubmitting(false)
        }
    }

    // createLogWork() trả về đúng shape EmployeeLogWorkSerializer (không
    // có review_status) — 1 entry mới tạo luôn là PENDING theo model, tự
    // gắn tay thay vì tin response.
    async function submitLogWork({ work_date, hours_spent, description }) {
        setSubmitting(true)
        setError(null)
        try {
            const newLog = await createLogWork({ task: taskId, work_date, hours_spent, description })
            setWorkLogs((prev) => [{ ...newLog, review_status: "PENDING" }, ...prev])
            return true
        } catch (err) {
            setError(getErrorMessage(err, "Failed to log work"))
            return false
        } finally {
            setSubmitting(false)
        }
    }

    // Cùng lý do — voidLogWork() không trả review_status, tự set tay
    // "VOIDED" + reason vừa gửi thay vì tin response.
    async function submitVoidLogWork(logWorkId, reason) {
        setSubmitting(true)
        setError(null)
        try {
            await voidLogWork(logWorkId, reason)
            setWorkLogs((prev) =>
                prev.map((l) => (l.id === logWorkId ? { ...l, review_status: "VOIDED", adjustment_reason: reason } : l))
            )
            return true
        } catch (err) {
            setError(getErrorMessage(err, "Failed to void log work"))
            return false
        } finally {
            setSubmitting(false)
        }
    }

    return {
        comments, workLogs, loadingDetail, submitting, error,
        submitComment, submitAttachment, submitLogWork, submitVoidLogWork,
    }
}
