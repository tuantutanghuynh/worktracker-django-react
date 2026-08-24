import axiosClient from "./axiosClient"

// Employee's own Task list/detail/status/comments/attachments — backed
// by tasks/employee/ (self-built, not through Long's Manager-only Task
// API). Endpoint shapes mirror managerTaskService.js where the same
// concept exists, for consistency across the 2 role portals.

export async function getMyTasks() {
    const { data } = await axiosClient.get("/employee/tasks/")
    return data
}

export async function getMyTaskDetail(id) {
    const { data } = await axiosClient.get(`/employee/tasks/${id}/`)
    return data
}

export async function changeTaskStatus(id, newStatus, reason = null) {
    const payload = { status: newStatus }
    if (reason) payload.reason = reason
    const { data } = await axiosClient.patch(`/employee/tasks/${id}/status/`, payload)
    return data
}

export async function getTaskComments(id) {
    const { data } = await axiosClient.get(`/employee/tasks/${id}/comments/`)
    return data
}

export async function addTaskComment(id, content) {
    const { data } = await axiosClient.post(`/employee/tasks/${id}/comments/`, { content })
    return data
}

export async function uploadTaskAttachment(id, file) {
    const formData = new FormData()
    formData.append("file", file)
    const { data } = await axiosClient.post(`/employee/tasks/${id}/attachments/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    })
    return data
}
