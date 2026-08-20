import { useMyPerformance } from "../../hooks/queries/employee/useMyPerformance"
import StatCard from "../../components/common/cards/StatCard"
import LineChartCard from "../../components/common/charts/LineChartCard"
import HorizontalBarChartCard from "../../components/common/charts/HorizontalBarChartCard"
import DonutChartCard from "../../components/common/charts/DonutChartCard"
import { AlertTriangle, ListChecks, TrendingUp, Clock } from "lucide-react"
import { getErrorMessage } from "../../utils/errorMessages"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { useTimesheet } from "../../hooks/queries/employee/useTimesheet"
import { DataTable } from "../../components/common/table/DataTable"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"

// Employee My Performance (Ngày 9) — 4 StatCard + 3 charts, all backed by
// real data from the same PersonalKPIView used by Dashboard. "Task
// Performance Details" (per-task table) was added later, combining
// useMyTasks + useTimesheet once both APIs existed (Ngày 7-8).
const RESULT_STYLES = {
    "On-time": "bg-emerald-50 text-emerald-600 border-emerald-200",
    Late: "bg-amber-50 text-amber-600 border-amber-200",
    Overdue: "bg-rose-50 text-rose-600 border-rose-200",
    Pending: "bg-slate-100 text-slate-500 border-slate-200",
}

function ResultBadge({ result }) {
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${RESULT_STYLES[result]}`}>
            {result}
        </span>
    )
}

// Task đã Completed thì so completed_at với deadline; chưa xong thì so
// deadline với hôm nay — cùng cách quyết định "overdue" mà PersonalKPIView
// đã dùng bên backend (loại CANCELLED, không tính là kết quả gì cả).
function computeResult(task, today) {
    if (task.status === "COMPLETED") {
        if (!task.completed_at) return "On-time"
        return task.completed_at.slice(0, 10) <= task.deadline ? "On-time" : "Late"
    }
    return task.deadline < today ? "Overdue" : "Pending"
}

export function MyPerformancePage() {
    const { kpi, dailyTrendData, hoursByProjectData, statusBreakdownData, loading, error } = useMyPerformance()
    const { tasks } = useMyTasks()
    const { entries } = useTimesheet()

    if (loading) {
        return <p className="text-xs text-slate-400">Loading performance data...</p>
    }

    if (error) {
        return <p className="text-xs text-rose-500">{getErrorMessage(error, "Failed to load performance data")}</p>
    }


    const ratePercent = kpi?.completion_rate?.rate != null
        ? `${Math.round(kpi.completion_rate.rate * 100)}%`
        : "—"
    const today = new Date().toISOString().split("T")[0]

    const hoursByTaskId = {}
    for (const e of entries) {
        if (e.review_status === "VOIDED" || !e.task) continue
        hoursByTaskId[e.task.id] = (hoursByTaskId[e.task.id] ?? 0) + Number(e.hours_spent)
    }

    const taskRows = tasks
        .filter((t) => t.status !== "CANCELLED")
        .map((t) => ({ ...t, hoursLogged: hoursByTaskId[t.id] ?? 0, result: computeResult(t, today) }))

    const taskColumns = [
        { accessorKey: "title", header: "Task" },
        { accessorKey: "job_name", header: "Job / Project" },
        { accessorKey: "priority", header: "Priority", cell: (info) => <PriorityBadge priority={info.row.original.priority} /> },
        { accessorKey: "status", header: "Status", cell: (info) => <StatusBadge status={info.row.original.status} /> },
        { accessorKey: "deadline", header: "Deadline" },
        { accessorKey: "hoursLogged", header: "Hours", cell: (info) => `${info.row.original.hoursLogged}h` },
        { accessorKey: "result", header: "Result", cell: (info) => <ResultBadge result={info.row.original.result} /> },
    ]


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

            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">Task Performance Details</p>
                </div>
                <DataTable columns={taskColumns} data={taskRows} emptyMessage="No tasks yet." />
            </div>

        </div>
    )
}
