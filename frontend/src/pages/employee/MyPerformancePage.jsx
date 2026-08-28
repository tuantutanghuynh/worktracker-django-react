import { useState } from "react"
import { useMyPerformance } from "../../hooks/queries/employee/useMyPerformance"
import StatCard from "../../components/common/cards/StatCard"
import LineChartCard from "../../components/common/charts/LineChartCard"
import EmployeeHorizontalBarChartCard from "../../components/employee/EmployeeHorizontalBarChartCard"
import DonutChartCard from "../../components/common/charts/DonutChartCard"
import { AlertTriangle, ListChecks, TrendingUp, Clock, CheckCircle2, Zap } from "lucide-react"
import { getErrorMessage } from "../../utils/errorMessages"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { useTimesheet } from "../../hooks/queries/employee/useTimesheet"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"

// Employee My Performance (Ngày 9) — 4 StatCard + 3 charts, all backed by
// real data from the same PersonalKPIView used by Dashboard. "Task
// Performance Details" (per-task table) was added later, combining
// useMyTasks + useTimesheet once both APIs existed (Ngày 7-8).
const RESULT_STYLES = {
    "On-time": "bg-emerald-50 text-emerald-600 border-emerald-200",
    "Completed Late": "bg-amber-50 text-amber-600 border-amber-200",
    "Not Started": "bg-rose-50 text-rose-600 border-rose-200",
    "In Progress (Late)": "bg-orange-50 text-orange-600 border-orange-200",
    Pending: "bg-slate-100 text-slate-500 border-slate-200",
}

const STATUS_OPTIONS = [
    { value: "TODO", label: "To Do" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "REVIEWING", label: "Reviewing" },
    { value: "COMPLETED", label: "Completed" },
]
const PRIORITY_OPTIONS = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
]
const RESULT_OPTIONS = [
    { value: "On-time", label: "On-time" },
    { value: "Completed Late", label: "Completed Late" },
    { value: "Not Started", label: "Not Started" },
    { value: "In Progress (Late)", label: "In Progress (Late)" },
    { value: "Pending", label: "Pending" },
]

function ResultBadge({ result }) {
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${RESULT_STYLES[result]}`}>
            {result}
        </span>
    )
}

// Task chưa xong mà quá hạn: tách theo status để biết "chưa bắt đầu" hay
// "đang làm nhưng trễ" — thay vì gộp chung 1 nhãn "Overdue" mơ hồ.
function computeResult(task, today) {
    if (task.status === "COMPLETED") {
        if (!task.completed_at) return "On-time"
        return task.completed_at.slice(0, 10) <= task.deadline ? "On-time" : "Completed Late"
    }
    if (task.deadline < today) {
        return task.status === "TODO" ? "Not Started" : "In Progress (Late)"
    }
    return "Pending"
}

export function MyPerformancePage() {
    const { kpi, dailyTrendData, hoursByProjectData, statusBreakdownData, loading, error } = useMyPerformance()
    const { tasks } = useMyTasks()
    const { entries } = useTimesheet()

    const [searchQuery, setSearchQuery] = useState("")
    const [statusValue, setStatusValue] = useState("")
    const [priorityValue, setPriorityValue] = useState("")
    const [resultValue, setResultValue] = useState("")
    const [projectValue, setProjectValue] = useState("")

    if (loading) {
        return <p className="text-xs text-slate-400">Loading performance data...</p>
    }

    if (error) {
        return <p className="text-xs text-rose-500">{getErrorMessage(error, "Failed to load performance data")}</p>
    }


    const ratePercent = kpi?.completion_rate?.rate != null
        ? `${Math.round(kpi.completion_rate.rate * 100)}%`
        : "—"

    const onTimeRatePercent = kpi?.on_time_rate?.rate != null
        ? `${Math.round(kpi.on_time_rate.rate * 100)}%`
        : "—"

    // Hiển thị "giờ/task" (nghịch đảo tasks_per_hour backend trả) — dễ đọc
    // hơn "0.0089 tasks/h". Guard !rate: chặn cả null/undefined lẫn 0 (0
    // tasks hoàn thành nhưng có giờ log) để không chia cho 0 ra Infinity.
    const productivityLabel = (() => {
        const rate = kpi?.productivity?.tasks_per_hour
        if (!rate) return "—"
        return `${(1 / rate).toFixed(1)}h/task`
    })()

    const today = new Date().toISOString().split("T")[0]

    const hoursByTaskId = {}
    for (const e of entries) {
        if (e.review_status === "VOIDED" || !e.task) continue
        hoursByTaskId[e.task.id] = (hoursByTaskId[e.task.id] ?? 0) + Number(e.hours_spent)
    }

    const taskRows = tasks
        .filter((t) => t.status !== "CANCELLED")
        .map((t) => ({ ...t, hoursLogged: hoursByTaskId[t.id] ?? 0, result: computeResult(t, today) }))

    const projectOptions = Array.from(new Set(taskRows.map((t) => t.job_name))).sort()

    const filteredTaskRows = taskRows.filter((t) => {
        if (statusValue && t.status !== statusValue) return false
        if (priorityValue && t.priority !== priorityValue) return false
        if (resultValue && t.result !== resultValue) return false
        if (projectValue && t.job_name !== projectValue) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            const matchesTitle = t.title?.toLowerCase().includes(q)
            const matchesJob = t.job_name?.toLowerCase().includes(q)
            if (!matchesTitle && !matchesJob) return false
        }
        return true
    })

    function handleClearFilters() {
        setSearchQuery("")
        setStatusValue("")
        setPriorityValue("")
        setResultValue("")
        setProjectValue("")
    }

    // Summary phản ánh đúng tập đã lọc — lọc xuống "Completed" thì summary
    // cũng chỉ tính trên các task Completed đang hiển thị.
    const summaryTotal = filteredTaskRows.length
    const summaryCompleted = filteredTaskRows.filter((t) => t.status === "COMPLETED").length
    const summaryOnTimeEligible = filteredTaskRows.filter((t) => t.result === "On-time" || t.result === "Completed Late").length
    const summaryOnTime = filteredTaskRows.filter((t) => t.result === "On-time").length
    const summaryTotalHours = filteredTaskRows.reduce((sum, t) => sum + t.hoursLogged, 0)
    const summaryOverdueHours = filteredTaskRows
        .filter((t) => t.result === "Not Started" || t.result === "In Progress (Late)")
        .reduce((sum, t) => sum + t.hoursLogged, 0)

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

            <div className="grid grid-cols-3 gap-4">
                <StatCard icon={AlertTriangle} color="rose" label="Overdue Tasks" value={kpi?.overdue_tasks_count ?? 0} />
                <StatCard icon={ListChecks} color="purple" label="Total Tasks" value={kpi?.completion_rate?.total ?? 0} />
                <StatCard icon={TrendingUp} color="emerald" label="Completion Rate" value={ratePercent} />
                <StatCard icon={Clock} color="blue" label="Hours This Week" value={kpi?.hours_logged_this_week ?? 0} />
                <StatCard icon={CheckCircle2} color="emerald" label="On-time Rate" value={onTimeRatePercent} />
                <StatCard icon={Zap} color="amber" label="Avg Time / Task" value={productivityLabel} />
            </div>

            <LineChartCard title="Logged Hours Trend (Daily)" data={dailyTrendData} />

            <div className="grid grid-cols-2 gap-4">
                <EmployeeHorizontalBarChartCard title="Hours by Project" data={hoursByProjectData} />
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

                <div className="p-4 border-b border-slate-100">
                    <FilterToolbar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Search task or project..."
                        statusValue={statusValue}
                        onStatusChange={setStatusValue}
                        statusOptions={STATUS_OPTIONS}
                        priorityValue={priorityValue}
                        onPriorityChange={setPriorityValue}
                        priorityOptions={PRIORITY_OPTIONS}
                        onClearFilters={handleClearFilters}
                    >
                        <select
                            value={resultValue}
                            onChange={(e) => setResultValue(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Results</option>
                            {RESULT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <select
                            value={projectValue}
                            onChange={(e) => setProjectValue(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Projects</option>
                            {projectOptions.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </FilterToolbar>
                </div>

                <DataTable columns={taskColumns} data={filteredTaskRows} emptyMessage="No tasks match these filters." />

                <div className="p-4 border-t border-slate-100 bg-slate-50/60 grid grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-lg font-bold text-slate-900">{summaryTotal}</p>
                        <p className="text-xs text-slate-500">Total Tasks</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900">
                            {summaryTotal ? Math.round((summaryCompleted / summaryTotal) * 100) : 0}%
                        </p>
                        <p className="text-xs text-slate-500">Completion Rate</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900">
                            {summaryOnTimeEligible ? Math.round((summaryOnTime / summaryOnTimeEligible) * 100) : 0}%
                        </p>
                        <p className="text-xs text-slate-500">On-time Rate</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900">{summaryTotalHours.toFixed(1)}h</p>
                        <p className="text-xs text-slate-500">Total Logged ({summaryOverdueHours.toFixed(1)}h overdue)</p>
                    </div>
                </div>
            </div>

        </div>
    )
}
