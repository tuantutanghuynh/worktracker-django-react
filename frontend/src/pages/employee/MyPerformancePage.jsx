import { useState, useMemo } from "react"
import { format, subDays, startOfMonth } from "date-fns"
import { useMyPerformance } from "../../hooks/queries/employee/useMyPerformance"
import EmployeeStatCard from "../../components/employee/EmployeeStatCard"
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

// Chỉ ảnh hưởng Completion Rate + On-time Rate (backend filter theo
// deadline của completion_tasks) — KHÔNG áp dụng cho Overdue/Hours This
// Week/chart nào cả, vì backend chưa hỗ trợ lọc những field đó theo
// khoảng ngày. Cố tình không đặt tên "toàn dashboard" để tránh hiểu nhầm.
const PERIOD_PRESETS = [
    { value: "all", label: "All time" },
    { value: "this_month", label: "This month" },
    { value: "last_30", label: "Last 30 days" },
]

function resolvePeriodRange(preset) {
    const today = new Date()
    if (preset === "this_month") {
        return { start_date: format(startOfMonth(today), "yyyy-MM-dd"), end_date: format(today, "yyyy-MM-dd") }
    }
    if (preset === "last_30") {
        return { start_date: format(subDays(today, 29), "yyyy-MM-dd"), end_date: format(today, "yyyy-MM-dd") }
    }
    return {} // "all" — không gửi start_date/end_date, backend mặc định all-time
}

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
    const [periodPreset, setPeriodPreset] = useState("all")
    const dateRange = useMemo(() => resolvePeriodRange(periodPreset), [periodPreset])

    const { kpi, dailyTrendData, hoursByProjectData, statusBreakdownData, loading, error } = useMyPerformance(dateRange)
    const { tasks } = useMyTasks()
    const { entries } = useTimesheet()

    const [searchQuery, setSearchQuery] = useState("")
    const [statusValue, setStatusValue] = useState("")
    const [priorityValue, setPriorityValue] = useState("")
    const [resultValue, setResultValue] = useState("")
    const [projectValue, setProjectValue] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

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

    // Trang hiện tại clamp về tổng số trang thật (thay vì reset qua effect
    // riêng mỗi lần filter đổi) — tránh lại dính đúng anti-pattern
    // "setState trong effect" vừa sửa ở QuickLogWorkFormCard.
    const totalPages = Math.max(Math.ceil(filteredTaskRows.length / pageSize), 1)
    const effectivePage = Math.min(currentPage, totalPages)
    const paginatedTaskRows = filteredTaskRows.slice(
        (effectivePage - 1) * pageSize,
        effectivePage * pageSize
    )

    function handleClearFilters() {
        setSearchQuery("")
        setStatusValue("")
        setPriorityValue("")
        setResultValue("")
        setProjectValue("")
        setCurrentPage(1)
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

            <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workload</p>
                <div className="grid grid-cols-3 gap-4">
                    <EmployeeStatCard
                        icon={AlertTriangle} hex="#6F9576" label="Overdue Tasks"
                        value={kpi?.overdue_tasks_count ?? 0}
                        subtext={kpi?.completion_rate?.total ? `of ${kpi.completion_rate.total} tasks` : undefined}
                    />
                    <EmployeeStatCard icon={ListChecks} hex="#CBA37E" label="Total Tasks" value={kpi?.completion_rate?.total ?? 0} />
                    <EmployeeStatCard icon={Clock} hex="#D2D2D1" label="Hours This Week" value={kpi?.hours_logged_this_week ?? 0} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Performance <span className="font-normal normal-case text-slate-400">— Completion &amp; On-time only</span>
                    </p>
                    <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-600">
                        {PERIOD_PRESETS.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => setPeriodPreset(p.value)}
                                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${periodPreset === p.value ? "bg-white text-blue-700 shadow-xs" : "hover:text-slate-800"}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <EmployeeStatCard
                        icon={TrendingUp} hex="#99C0CD" label="Completion Rate"
                        value={ratePercent}
                        subtext={kpi?.completion_rate ? `${kpi.completion_rate.completed} of ${kpi.completion_rate.total} completed` : undefined}
                    />
                    <EmployeeStatCard
                        icon={CheckCircle2} hex="#A085B4" label="On-time Rate"
                        value={onTimeRatePercent}
                        subtext={kpi?.on_time_rate ? `${kpi.on_time_rate.on_time} of ${kpi.on_time_rate.completed_with_date} completed tasks` : "Only counts tasks you've completed"}
                    />
                    <EmployeeStatCard
                        icon={Zap} hex="#E2A4C0" label="Avg Time / Task"
                        value={productivityLabel}
                        subtext="Hours per completed task, all-time"
                    />
                </div>
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

                <DataTable
                    columns={taskColumns}
                    data={paginatedTaskRows}
                    emptyMessage="No tasks match these filters."
                    pagination={{
                        currentPage: effectivePage,
                        totalPages,
                        totalItems: filteredTaskRows.length,
                        pageSize,
                        onPageChange: setCurrentPage,
                        onPageSizeChange: (size) => { setPageSize(size); setCurrentPage(1) },
                    }}
                />

                <div className="p-4 border-t border-slate-100 bg-slate-50/60 space-y-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        For the {summaryTotal} task{summaryTotal !== 1 ? "s" : ""} matching current filters
                    </p>
                    <div className="grid grid-cols-4 gap-4 text-center">
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
                            <p className="text-xs text-slate-500">Total Logged</p>
                            {summaryOverdueHours > 0 && (
                                <p className="text-[10px] text-rose-500 mt-0.5">{summaryOverdueHours.toFixed(1)}h logged on overdue tasks</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
