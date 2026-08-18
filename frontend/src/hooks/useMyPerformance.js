import { useState, useEffect } from "react"
import { format, parseISO } from "date-fns"
import { getPersonalKPI } from "../api/dashboardApi"
import { getErrorMessage } from "../utils/errorMessages"

// Employee My Performance (Ngày 9) — same PersonalKPIView as Dashboard,
// but also reshapes task_status_breakdown/hours_by_project/daily_hours_trend
// into the {name, value} arrays LineChartCard/HorizontalBarChartCard/
// DonutChartCard expect (their x-axis/dataKey is hardcoded to "name").
export function useMyPerformance() {
    const [kpi, setKpi] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        async function loadKpi() {
            try {
                const data = await getPersonalKPI()
                if (cancelled) return
                setKpi(data)
            } catch (err) {
                if (cancelled) return
                setError(getErrorMessage(err, "Failed to load performance data"))
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadKpi()

        return () => {
            cancelled = true
        }
    }, [])

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

    return { kpi, dailyTrendData, hoursByProjectData, statusBreakdownData, loading, error }
}
