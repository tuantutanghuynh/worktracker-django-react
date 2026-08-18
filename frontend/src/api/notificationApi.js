import axiosClient from "./axiosClient"

// Employee-facing notification endpoints (any logged-in role, not
// role-gated on the backend) — separate from services/manager/
// managerReportService.js, which hits the Manager-only /manager/system/
// notifications/ routes and would 403 for an Employee.

export async function getNotifications() {
    const { data } = await axiosClient.get("/notifications/")
    return data
}

export async function markNotificationRead(id) {
    const { data } = await axiosClient.patch(`/notifications/${id}/read/`)
    return data
}

export async function markAllNotificationsRead() {
    const { data } = await axiosClient.patch("/notifications/mark-all-read/")
    return data
}
