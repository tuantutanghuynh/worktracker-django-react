import { Link } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { useDashboard } from "../../hooks/queries/employee/useDashboard"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { useTimesheet } from "../../hooks/queries/employee/useTimesheet"
import { getErrorMessage } from "../../utils/errorMessages"
import StatCard from "../../components/common/cards/StatCard"
import DonutChartCard from "../../components/common/charts/DonutChartCard"
import { DataTable } from "../../components/common/table/DataTable"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"
import QuickLogWorkFormCard from "../../components/common/forms/QuickLogWorkFormCard"
import { AlertTriangle, Clock, TrendingUp } from "lucide-react"

// Employee Dashboard (Ngày 6) — hero banner + KPI summary, backed by real
// data from PersonalKPIView. Recent Tasks (useMyTasks) and Quick Log Work
// (useTimesheet) were added later once those APIs existed (Ngày 7-8).
export function DashboardPage() {
    const { user } = useAuth()
    const { data: kpi, isLoading: loading, error } = useDashboard()
    const { tasks } = useMyTasks()
    const { entries, submitLogWork, submitting } = useTimesheet()

    if (loading) {
        return <p className="text-xs text-slate-400">Loading dashboard...</p>
    }

    if (error) {
        return <p className="text-xs text-rose-500">{getErrorMessage(error, "Failed to load dashboard")}</p>
    }

    const completed = kpi?.completion_rate?.completed ?? 0
    const total = kpi?.completion_rate?.total ?? 0
    const remaining = Math.max(total - completed, 0)
    const ratePercent = kpi?.completion_rate?.rate != null
        ? `${Math.round(kpi.completion_rate.rate * 100)}%`
        : "—"
    const today = new Date().toISOString().split("T")[0]
    const todayHours = entries
        .filter((e) => e.work_date === today && e.review_status !== "VOIDED")
        .reduce((sum, e) => sum + Number(e.hours_spent), 0)

    // 5 task gần deadline nhất, chưa xong — không lặp lại toàn bộ My Tasks,
    // chỉ cho biết "sắp tới cần làm gì".
    const recentTasks = [...tasks]
        .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .slice(0, 5)

    async function handleQuickLog({ task_id, work_date, hours_spent, description }) {
        await submitLogWork({ task: task_id, work_date, hours_spent, description })
    }

    const taskColumns = [
        { accessorKey: "title", header: "Task" },
        { accessorKey: "job_name", header: "Job / Project" },
        { accessorKey: "priority", header: "Priority", cell: (info) => <PriorityBadge priority={info.row.original.priority} /> },
        { accessorKey: "status", header: "Status", cell: (info) => <StatusBadge status={info.row.original.status} /> },
        { accessorKey: "deadline", header: "Deadline" },
    ]


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

            <DonutChartCard
                title="Task Progress"
                data={[
                    { name: "Completed", value: completed },
                    { name: "Remaining", value: remaining },
                ]}
                centerValue={total}
                centerLabel="Total Tasks"
            />

            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">Recent Tasks</p>
                    <Link to="/employee/my-tasks" className="text-xs font-semibold text-blue-600 hover:underline">
                        View all tasks →
                    </Link>
                </div>
                <DataTable columns={taskColumns} data={recentTasks} emptyMessage="No upcoming tasks." />
            </div>

            <QuickLogWorkFormCard
                tasks={tasks}
                dailyHoursLogged={todayHours}
                onSubmit={handleQuickLog}
                isLoading={submitting}
            />

        </div>
    )
}
