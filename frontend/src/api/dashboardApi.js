import axiosClient from "./axiosClient"

// Employee dashboard summary — overdue task count, hours logged this
// week, and completion rate (completed/total). Backed by the same
// PersonalKPIView used by My Performance (Ngày 9), so this endpoint is
// shared between 2 pages, not Dashboard-only.

export async function getPersonalKPI() {
    const { data } = await axiosClient.get("/employee/me/kpi/")
    return data
}
