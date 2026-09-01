import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from "date-fns"
import { getPersonalKPI } from "../../../api/dashboardApi"
import { dashboardKeys } from "./useDashboard"

// Employee My Performance (Ngày 9) — same PersonalKPIView + same query
// key as useDashboard.js, so switching between the 2 pages reuses the
// cached KPI instead of refetching (within staleTime). Also reshapes
// task_status_breakdown/hours_by_project/daily_hours_trend into the
// {name, value} arrays LineChartCard/HorizontalBarChartCard/
// DonutChartCard expect (their x-axis/dataKey is hardcoded to "name").
//
// dateRange (optional { start_date, end_date }) chỉ ảnh hưởng
// completion_rate/on_time_rate ở backend — các field khác trong response
// (overdue_tasks_count, hours_logged_this_week, hours_by_project,
// daily_hours_trend) luôn tính theo phạm vi cố định riêng, không đổi
// theo dateRange này dù cùng 1 API call.
export function useMyPerformance(dateRange = {}) {
    const { data: kpi, isLoading, error } = useQuery({
        queryKey: dashboardKeys.kpi(dateRange),
        queryFn: () => getPersonalKPI(dateRange),
        staleTime: 60 * 1000,
    })

    const dailyTrendData = (kpi?.daily_hours_trend ?? []).map((row) => ({
        name: format(parseISO(row.date), "MMM d"),
        value: Number(row.hours),
    }))

    const hoursByProjectTotal = (kpi?.hours_by_project ?? [])
        .reduce((sum, row) => sum + Number(row.total_hours), 0)
    const hoursByProjectData = (kpi?.hours_by_project ?? []).map((row) => {
        const hours = Number(row.total_hours)
        return {
            name: row.task__job__job_name,
            value: hours,
            pct: hoursByProjectTotal ? Math.round((hours / hoursByProjectTotal) * 100) : 0,
        }
    })

    const statusBreakdownData = Object.entries(kpi?.task_status_breakdown ?? {}).map(
        ([taskStatus, count]) => ({ name: taskStatus, value: count })
    )

    return { kpi, dailyTrendData, hoursByProjectData, statusBreakdownData, loading: isLoading, error }
}
