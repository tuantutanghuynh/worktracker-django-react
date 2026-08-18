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
export function useMyPerformance() {
    const { data: kpi, isLoading, error } = useQuery({
        queryKey: dashboardKeys.kpi(),
        queryFn: getPersonalKPI,
        staleTime: 60 * 1000,
    })

    const dailyTrendData = (kpi?.daily_hours_trend ?? []).map((row) => ({
        name: format(parseISO(row.date), "MMM d"),
        value: Number(row.hours),
    }))

    const hoursByProjectData = (kpi?.hours_by_project ?? []).map((row) => ({
        name: row.task__job__job_name,
        value: Number(row.total_hours),
    }))

    const statusBreakdownData = Object.entries(kpi?.task_status_breakdown ?? {}).map(
        ([taskStatus, count]) => ({ name: taskStatus, value: count })
    )

    return { kpi, dailyTrendData, hoursByProjectData, statusBreakdownData, loading: isLoading, error }
}
