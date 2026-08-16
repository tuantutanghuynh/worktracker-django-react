import { useAuth } from "../../hooks/useAuth"
import { useDashboard } from "../../hooks/useDashboard"
import StatCard from "../../components/common/cards/StatCard"
import DonutChartCard from "../../components/common/charts/DonutChartCard"
import { AlertTriangle, Clock, TrendingUp } from "lucide-react"

// Employee Dashboard (Ngày 6) — hero banner + KPI summary, backed by real
// data from PersonalKPIView. Recent-tasks table and Quick Log Work need a
// full task list, which the Employee Task API (Long) doesn't expose yet —
// both show an explicit "coming soon" placeholder instead of mock data.
export function DashboardPage() {
    const { user } = useAuth()
    const { kpi, loading, error } = useDashboard()

    if (loading) {
        return <p className="text-xs text-slate-400">Loading dashboard...</p>
    }

    if (error) {
        return <p className="text-xs text-rose-500">{error}</p>
    }

    const completed = kpi?.completion_rate?.completed ?? 0
    const total = kpi?.completion_rate?.total ?? 0
    const remaining = Math.max(total - completed, 0)
    const ratePercent = kpi?.completion_rate?.rate != null
        ? `${Math.round(kpi.completion_rate.rate * 100)}%`
        : "—"

    return (
        <div className="space-y-6">
            <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <h1 className="text-xl font-bold">Welcome back, {user?.email}</h1>
                <p className="text-xs text-blue-100 mt-1">Here's your work summary for this week.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <StatCard icon={AlertTriangle} color="rose" label="Overdue Tasks" value={kpi?.overdue_tasks_count ?? 0} />
                <StatCard icon={Clock} color="blue" label="Hours This Week" value={kpi?.hours_logged_this_week ?? 0} />
                <StatCard icon={TrendingUp} color="emerald" label="Completion Rate" value={ratePercent} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <DonutChartCard
                    title="Task Progress"
                    data={[
                        { name: "Completed", value: completed },
                        { name: "Remaining", value: remaining },
                    ]}
                    centerValue={total}
                    centerLabel="Total Tasks"
                />
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col items-center justify-center text-center space-y-1">
                    <p className="text-sm font-medium text-slate-900">Recent Tasks</p>
                    <p className="text-xs text-slate-400">Coming soon — waiting on the Employee Task API.</p>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm text-center space-y-1">
                <p className="text-sm font-medium text-slate-900">Quick Log Work</p>
                <p className="text-xs text-slate-400">Coming soon — waiting on the Employee Task API.</p>
            </div>
        </div>
    )
}
