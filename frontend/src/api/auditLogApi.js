import axiosClient from "./axiosClient"

// Fetches the calling user's own audit log entries — GET /employee/audit-logs/.
export async function getMyAuditLogs() {
    const { data } = await axiosClient.get("/employee/audit-logs/")
    return data
}
