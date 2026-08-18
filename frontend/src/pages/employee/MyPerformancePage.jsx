import { useMyPerformance } from "../../hooks/useMyPerformance"
import StatCard from "../../components/common/cards/StatCard"
import LineChartCard from "../../components/common/charts/LineChartCard"
import HorizontalBarChartCard from "../../components/common/charts/HorizontalBarChartCard"
import DonutChartCard from "../../components/common/charts/DonutChartCard"
import { AlertTriangle, ListChecks, TrendingUp, Clock } from "lucide-react"

// Employee My Performance (Ngày 9) — 4 StatCard + 3 charts, all backed by
// real data from the same PersonalKPIView used by Dashboard. "Task
// Performance Details" (per-task table) needs the Employee Task API
// (Long) and shows an explicit "coming soon" placeholder instead.
export function MyPerformancePage() {
    const { kpi, dailyTrendData, hoursByProjectData, statusBreakdownData, loading, error } = useMyPerformance()

    if (loading) {
        return <p className="text-xs text-slate-400">Loading performance data...</p>
    }

    if (error) {
        return <p className="text-xs text-rose-500">{error}</p>
    }

    const ratePercent = kpi?.completion_rate?.rate != null
        ? `${Math.round(kpi.completion_rate.rate * 100)}%`
        : "—"

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Performance</h1>
                <p className="text-slate-500 text-xs">Track your personal KPIs and work trends over time.</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <StatCard icon={AlertTriangle} color="rose" label="Overdue Tasks" value={kpi?.overdue_tasks_count ?? 0} />
                <StatCard icon={ListChecks} color="purple" label="Total Tasks" value={kpi?.completion_rate?.total ?? 0} />
                <StatCard icon={TrendingUp} color="emerald" label="Completion Rate" value={ratePercent} />
                <StatCard icon={Clock} color="blue" label="Hours This Week" value={kpi?.hours_logged_this_week ?? 0} />
            </div>

            <LineChartCard title="Logged Hours Trend (Daily)" data={dailyTrendData} />

            <div className="grid grid-cols-2 gap-4">
                <HorizontalBarChartCard title="Hours by Project" data={hoursByProjectData} />
                <DonutChartCard
                    title="Task Status Breakdown"
                    data={statusBreakdownData}
                    centerValue={kpi?.completion_rate?.total ?? 0}
                    centerLabel="Total Tasks"
                />
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm text-center space-y-1">
                <p className="text-sm font-medium text-slate-900">Task Performance Details</p>
                <p className="text-xs text-slate-400">Coming soon — waiting on the Employee Task API.</p>
            </div>
        </div>
    )
}
