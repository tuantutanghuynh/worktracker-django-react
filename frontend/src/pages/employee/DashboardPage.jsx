import { Link } from "react-router-dom"
import { useDashboard } from "../../hooks/queries/employee/useDashboard"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { useProfile } from "../../hooks/queries/employee/useProfile"
import { getErrorMessage } from "../../utils/errorMessages"
import { describeDeadline, DEADLINE_TONE_STYLES } from "../../utils/deadline"
import EmployeeStatCard from "../../components/employee/EmployeeStatCard"
import { DataTable } from "../../components/common/table/DataTable"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"
import { AlertTriangle, Clock, TrendingUp, PauseCircle, ListChecks, AlertOctagon } from "lucide-react"

// 6 ngày làm việc/tuần × 8h — cùng hằng số đã dùng cho Timesheet's Weekly
// Summary (backend/.env: WORK_DAYS_PER_WEEK=6, DAILY_WORKING_HOURS=8), để
// "Hours This Week" có context thật thay vì tự đoán 40h.
const EXPECTED_WEEKLY_HOURS = 48

// Thứ tự + màu hiển thị Task Overview — khớp đúng màu StatusBadge đang
// dùng cho từng status ở mọi nơi khác (My Tasks, My Team...).
const STATUS_ROWS = [
    { key: "TODO", label: "To Do", bar: "bg-blue-500" },
    { key: "IN_PROGRESS", label: "In Progress", bar: "bg-emerald-500" },
    { key: "REVIEWING", label: "Reviewing", bar: "bg-purple-500" },
    { key: "COMPLETED", label: "Completed", bar: "bg-orange-500" },
]

// Employee Dashboard (Ngày 6) — hero banner + KPI summary, backed by real
// data from PersonalKPIView. Recent Tasks (useMyTasks) was added later once
// the Employee Task API existed (Ngày 7). Quick Log Work used to be a full
// QuickLogWorkFormCard here too, but that duplicated the exact same form
// already on the Timesheet page — replaced with a "Log Work →" link so
// logging work has 1 canonical place, not 2 in sync by coincidence.
export function DashboardPage() {
    const { data: kpi, isLoading: loading, error } = useDashboard()
    const { tasks } = useMyTasks()
    const { profile } = useProfile()

    if (loading) {
        return <p className="text-xs text-slate-400">Loading dashboard...</p>
    }

    if (error) {
        return <p className="text-xs text-rose-500">{getErrorMessage(error, "Failed to load dashboard")}</p>
    }

    const total = kpi?.completion_rate?.total ?? 0
    const completed = kpi?.completion_rate?.completed ?? 0
    const overdue = kpi?.overdue_tasks_count ?? 0
    const hoursThisWeek = Number(kpi?.hours_logged_this_week ?? 0)
    const ratePercent = kpi?.completion_rate?.rate != null
        ? `${Math.round(kpi.completion_rate.rate * 100)}%`
        : "—"
    const weeklyHoursPct = Math.min(Math.round((hoursThisWeek / EXPECTED_WEEKLY_HOURS) * 100), 100)

    const statusBreakdown = kpi?.task_status_breakdown ?? {}

    const firstName = (profile?.full_name || "").trim().split(/\s+/)[0] || null

    // Task còn mở, đã quá hạn — top 3 trễ nhất lên trước, để trả lời "cần
    // xử lý cái gì trước" thay vì chỉ báo con số 11 rồi thôi.
    const needsAttention = tasks
        .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
        .map((t) => ({ ...t, deadlineInfo: describeDeadline(t.deadline) }))
        .filter((t) => t.deadlineInfo?.tone === "overdue")
        .sort((a, b) => b.deadlineInfo.daysOverdue - a.deadlineInfo.daysOverdue)
        .slice(0, 3)

    // "Upcoming" (không phải "Recent") vì đang sort theo deadline gần
    // nhất, không phải theo lần cập nhật gần đây — đặt tên đúng nghĩa.
    const upcomingTasks = [...tasks]
        .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .slice(0, 5)

    const taskColumns = [
        { accessorKey: "title", header: "Task" },
        {
            accessorKey: "job_name",
            header: "Job / Project",
            cell: (info) => {
                const task = info.row.original
                const isFrozen = (task.job_status && task.job_status !== "ACTIVE") || task.job_client_is_active === false
                return (
                    <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-800 text-xs">{task.job_name || "—"}</span>
                        {isFrozen && (
                            <span className="inline-flex items-center gap-1 w-fit text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                <PauseCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                {/* "Project:" ở đầu để không bị đọc nhầm thành trạng thái của
                                    Task — cột Status kế bên vẫn hiện đúng status của Task. */}
                                <span>Project: Frozen ({task.job_status || "Client inactive"})</span>
                            </span>
                        )}
                    </div>
                )
            },
        },
        { accessorKey: "priority", header: "Priority", cell: (info) => <PriorityBadge priority={info.row.original.priority} /> },
        { accessorKey: "status", header: "Status", cell: (info) => <StatusBadge status={info.row.original.status} /> },
        {
            accessorKey: "deadline",
            header: "Deadline",
            cell: (info) => {
                const d = describeDeadline(info.row.original.deadline)
                if (!d) return <span className="text-slate-300">—</span>
                return (
                    <div className="leading-tight">
                        <p className="text-slate-700">{d.label}</p>
                        <p className={`text-[10px] font-semibold ${DEADLINE_TONE_STYLES[d.tone]}`}>{d.relative}</p>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="space-y-6">
            <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Welcome back{firstName ? `, ${firstName}` : ""} 👋</h1>
                    <p className="text-xs text-blue-100 mt-1">Here's your work summary for this week.</p>
                </div>
                <Link
                    to="/employee/timesheet"
                    className="shrink-0 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                    + Log Work
                </Link>
            </div>

            {/* Cùng màu với đúng các chỉ số này ở My Performance — nhất
                quán xuyên trang, không phải màu mới. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <EmployeeStatCard
                    icon={ListChecks} hex="#CBA37E" label="Total Tasks"
                    value={total}
                    subtext={`${completed} completed`}
                />
                <EmployeeStatCard
                    icon={AlertTriangle} hex="#6F9576" label="Overdue Tasks"
                    value={overdue}
                    subtext={total ? `of ${total} tasks` : undefined}
                />
                <EmployeeStatCard
                    icon={TrendingUp} hex="#99C0CD" label="Completion Rate"
                    value={ratePercent}
                    subtext={total ? `${completed} of ${total} tasks` : undefined}
                />
                <EmployeeStatCard
                    icon={Clock} hex="#D2D2D1" label="Hours This Week"
                    value={`${hoursThisWeek}h`}
                    subtext={`${weeklyHoursPct}% of ${EXPECTED_WEEKLY_HOURS}h`}
                />
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">Task Overview</p>
                    <span className="text-xs text-slate-400">{total} task{total !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2.5">
                    {STATUS_ROWS.filter((row) => statusBreakdown[row.key]).map((row) => {
                        const count = statusBreakdown[row.key] ?? 0
                        const pct = total ? Math.round((count / total) * 100) : 0
                        return (
                            <div key={row.key} className="flex items-center gap-3 text-xs">
                                <span className="w-20 shrink-0 text-slate-600 font-medium">{row.label}</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-16 shrink-0 text-right font-bold text-slate-700">{count} · {pct}%</span>
                            </div>
                        )
                    })}
                    {total === 0 && <p className="text-xs text-slate-400">No tasks assigned yet.</p>}
                </div>
                <div className="pt-1 text-right">
                    <Link to="/employee/my-tasks" className="text-xs font-semibold text-blue-600 hover:underline">
                        View all tasks →
                    </Link>
                </div>
            </div>

            {needsAttention.length > 0 && (
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-rose-100 flex items-center justify-between">
                        <p className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                            <AlertOctagon className="w-4 h-4 text-rose-500" />
                            Needs Attention
                        </p>
                        <Link to="/employee/my-tasks" className="text-xs font-semibold text-rose-700 hover:underline">
                            View all →
                        </Link>
                    </div>
                    <div className="divide-y divide-rose-100/80">
                        {needsAttention.map((task) => (
                            <div key={task.id} className="p-3.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{task.title}</p>
                                    <p className="text-[11px] font-semibold text-rose-600">{task.deadlineInfo.relative}</p>
                                </div>
                                {/* Chưa có route mở đúng 1 task cụ thể từ URL — dẫn chung về
                                    My Tasks, không phải deep-link tới task này. */}
                                <Link
                                    to="/employee/my-tasks"
                                    className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-700"
                                >
                                    Open →
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">Upcoming Tasks</p>
                    <Link to="/employee/my-tasks" className="text-xs font-semibold text-blue-600 hover:underline">
                        View all tasks →
                    </Link>
                </div>
                <DataTable columns={taskColumns} data={upcomingTasks} emptyMessage="No upcoming tasks." />
            </div>
        </div>
    )
}
