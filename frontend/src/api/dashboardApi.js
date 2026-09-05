import axiosClient from "./axiosClient"

// Employee dashboard summary — overdue task count, hours logged this
// week, and completion rate (completed/total). Backed by the same
// PersonalKPIView used by My Performance (Ngày 9), so this endpoint is
// shared between 2 pages, not Dashboard-only.

// params: optional { start_date, end_date } (YYYY-MM-DD) — ảnh hưởng
// completion_rate + on_time_rate + task_status_breakdown ở backend
// (PersonalKPIView, cả 3 cùng dùng chung 1 queryset "completion_tasks").
// Các field khác (overdue_tasks_count, hours_logged_this_week,
// daily_hours_trend, hours_by_project) luôn tính theo phạm vi cố định
// riêng của chúng, không đổi theo params này.
export async function getPersonalKPI(params = {}) {
    const { data } = await axiosClient.get("/employee/me/kpi/", { params })
    return data
}
