import { useState, useMemo } from "react"
import { RotateCcw, Lock, PauseCircle, ListChecks, PlayCircle, Eye, CalendarClock } from "lucide-react"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"
import PromptReasonModal from "../../components/common/modal/PromptReasonModal"
import EmployeeStatCard from "../../components/employee/EmployeeStatCard"
import { TaskDrawerContent } from "../../components/employee/tasks/TaskDrawerContent"
import { TaskSubmitReviewModal } from "../../components/employee/tasks/TaskSubmitReviewModal"
import { useRecentTasksStore } from "../../stores/useRecentTasksStore"
import { describeDeadline, DEADLINE_TONE_STYLES } from "../../utils/deadline"
import { isTaskFrozen, isFrozenOpenTask } from "../../utils/taskFrozen"

// "Due Soon" = còn mở (chưa Completed/Cancelled), có deadline, còn 0-3
// ngày nữa tới hạn — CHƯA quá hạn (đã quá hạn thì đây là "overdue",
// khái niệm khác, đã hiện riêng ở cột Deadline mỗi dòng).
const DUE_SOON_DAYS = 3

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

const PRIORITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 }

// Employee My Tasks (Ngày 7) — List view only for now (Kanban view
// deferred). Filtering is client-side since the list endpoint doesn't
// take query params yet, and 1 Employee's task count is small.
//
// Task drawer (TaskDrawerContent) và submit-review modal
// (TaskSubmitReviewModal) sống ở components/employee/tasks/ — tách khỏi
// file này vì cả 2 là component độc lập, tự gọi useTaskDetail() riêng,
// không phải phần "logic của trang" (danh sách/filter/sort). isTaskFrozen
// công thức chung sống ở utils/taskFrozen.js, dùng lại y hệt ở Dashboard.
export function MyTasksPage() {
    const { tasks, loading, error, changeStatus } = useMyTasks()
    const { addRecentTask } = useRecentTasksStore()
    const [activeTab, setActiveTab] = useState("active") // "active" | "frozen"
    const [searchQuery, setSearchQuery] = useState("")
    const [statusValue, setStatusValue] = useState("")
    const [priorityValue, setPriorityValue] = useState("")
    const [projectValue, setProjectValue] = useState("")
    const [sorting, setSorting] = useState({ key: null, direction: null })
    const [selectedTask, setSelectedTask] = useState(null)
    const [submittingTask, setSubmittingTask] = useState(null)
    const [recallingTask, setRecallingTask] = useState(null)
    const [isRecalling, setIsRecalling] = useState(false)

    // Tách trước theo tab — Active/Frozen là 2 rổ độc lập, các filter/sort
    // bên dưới chỉ áp dụng bên trong đúng rổ đang xem.
    const frozenTasks = useMemo(() => tasks.filter(isFrozenOpenTask), [tasks])
    const activeTasks = useMemo(() => tasks.filter((t) => !isFrozenOpenTask(t)), [tasks])
    const tabTasks = activeTab === "frozen" ? frozenTasks : activeTasks

    // Summary luôn tính trên TOÀN BỘ task (không đổi theo tab Active/Frozen
    // đang xem) — giống cách KPI ở My Team/My Performance không đổi theo
    // filter bảng bên dưới, chỉ là "tổng quan nhanh" cố định.
    const summary = useMemo(() => {
        const openTasks = tasks.filter((t) => t.status !== "CANCELLED")
        const dueSoon = openTasks.filter((t) => {
            if (!t.deadline || t.status === "COMPLETED") return false
            const days = differenceInCalendarDays(parseISO(t.deadline), new Date())
            return days >= 0 && days <= DUE_SOON_DAYS
        })
        return {
            total: openTasks.length,
            inProgress: openTasks.filter((t) => t.status === "IN_PROGRESS").length,
            reviewing: openTasks.filter((t) => t.status === "REVIEWING").length,
            dueSoon: dueSoon.length,
        }
    }, [tasks])

    const projectOptions = useMemo(() => {
        const seen = new Set()
        return tabTasks
            .filter((t) => t.job_name && !seen.has(t.job_name) && seen.add(t.job_name))
            .map((t) => ({ value: t.job_name, label: t.job_name }))
    }, [tabTasks])

    function handleSortChange(key) {
        setSorting((prev) => {
            if (prev.key !== key) return { key, direction: "asc" }
            if (prev.direction === "asc") return { key, direction: "desc" }
            return { key: null, direction: null } // 3rd click: clear sort
        })
    }

    const filteredTasks = useMemo(() => {
        let result = tabTasks.filter((task) => {
            if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
            if (statusValue && task.status !== statusValue) return false
            if (priorityValue && task.priority !== priorityValue) return false
            if (projectValue && task.job_name !== projectValue) return false
            return true
        })

        if (sorting.key) {
            const dir = sorting.direction === "asc" ? 1 : -1
            result = [...result].sort((a, b) => {
                if (sorting.key === "deadline") {
                    return dir * (new Date(a.deadline) - new Date(b.deadline))
                }
                if (sorting.key === "priority") {
                    return dir * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
                }
                return 0
            })
        }

        return result
    }, [tabTasks, searchQuery, statusValue, priorityValue, projectValue, sorting])

    function handleClearFilters() {
        setSearchQuery("")
        setStatusValue("")
        setPriorityValue("")
        setProjectValue("")
    }

    async function handleStartTask(task) {
        await changeStatus(task.id, "IN_PROGRESS")
    }

    async function handleConfirmRecall(reason) {
        if (!recallingTask) return
        setIsRecalling(true)
        const ok = await changeStatus(recallingTask.id, "IN_PROGRESS", reason)
        setIsRecalling(false)
        if (ok) setRecallingTask(null)
    }

    const columns = [
        {
            accessorKey: "title",
            header: "Task",
            className: "max-w-[220px] truncate",
            cell: (info) => <span title={info.row.original.title}>{info.row.original.title}</span>,
        },
        {
            accessorKey: "job_name",
            header: "Job / Project",
            className: "max-w-[160px]",
            cell: (info) => {
                const task = info.row.original
                // Dùng isFrozenOpenTask (không phải isTaskFrozen thô) — task đã
                // COMPLETED/CANCELLED thì job không ACTIVE cũng không còn hành
                // động nào bị chặn, hiện badge "Frozen" ở đây sẽ gây hiểu lầm
                // (đặc biệt mâu thuẫn với việc task đó vẫn nằm ở tab Active).
                const frozen = isFrozenOpenTask(task)
                return (
                    <div className="flex flex-col gap-0.5 truncate" title={task.job_name}>
                        <span className="truncate">{task.job_name || "—"}</span>
                        {frozen && (
                            <span className="inline-flex items-center gap-1 w-fit text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                <PauseCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span>Frozen ({task.job_status || "Client Inactive"})</span>
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "manager_name",
            header: "Manager",
            className: "max-w-[140px] truncate",
            cell: (info) => (
                <span className="truncate" title={info.row.original.manager_name}>
                    {info.row.original.manager_name || "—"}
                </span>
            ),
        },
        {
            accessorKey: "priority",
            header: "Priority",
            sortable: true,
            cell: (info) => <PriorityBadge priority={info.row.original.priority} />,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: (info) => <StatusBadge status={info.row.original.status} />,
        },
        {
            accessorKey: "deadline",
            header: "Deadline",
            sortable: true,
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
        {
            accessorKey: "action",
            header: "Action",
            cell: (info) => {
                const task = info.row.original
                const frozen = isTaskFrozen(task)

                if (task.status === "TODO") {
                    // Reassignment lock (phase-out) luôn ưu tiên cao nhất — nếu
                    // đang trong quá trình chuyển giao cho người khác thì dù dự
                    // án có ACTIVE hay không cũng không cho bấm Start Task.
                    const isReassigning = task.description && task.description.includes("[LOCKED_FOR_REASSIGNMENT]")
                    if (isReassigning) {
                        return (
                            <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg"
                                title="This task is being reassigned by manager due to your project transfer (phase-out)"
                            >
                                <Lock className="w-3 h-3 text-amber-600" />
                                <span>Reassigning (Phase-out)</span>
                            </span>
                        )
                    }
                    if (frozen) {
                        return (
                            <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg"
                                title="Project is on hold, cancelled, or client is inactive. Task cannot be started."
                            >
                                <PauseCircle className="w-3 h-3 text-slate-400" />
                                <span>Project Frozen</span>
                            </span>
                        )
                    }
                    return (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStartTask(task) }}
                            className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                        >
                            Start Task
                        </button>
                    )
                }
                if (task.status === "IN_PROGRESS") {
                    if (frozen) {
                        return (
                            <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg"
                                title="Project is on hold, cancelled, or client is inactive. Cannot submit for review."
                            >
                                <PauseCircle className="w-3 h-3 text-slate-400" />
                                <span>Project Frozen</span>
                            </span>
                        )
                    }
                    return (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSubmittingTask(task) }}
                            className="px-3 py-1 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer"
                        >
                            Submit for Review
                        </button>
                    )
                }
                if (task.status === "REVIEWING") {
                    return (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRecallingTask(task) }}
                            className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Recall submission back to In Progress to make adjustments"
                        >
                            <RotateCcw size={12} />
                            <span>Recall</span>
                        </button>
                    )
                }
                return <span className="text-xs text-slate-400">—</span>
            },
        },
    ]

    if (error) {
        return <p className="text-xs text-rose-500">{error}</p>
    }

    function handleTabChange(tab) {
        setActiveTab(tab)
        handleClearFilters() // filter cũ (vd. Project chỉ có ở tab kia) không nên carry sang
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Tasks</h1>
                <p className="text-slate-500 text-xs">Tasks assigned to you across all projects.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <EmployeeStatCard icon={ListChecks} hex="#FFB6A6" label="Total Tasks" value={summary.total} size="sm" />
                <EmployeeStatCard icon={PlayCircle} hex="#FFEBD3" label="In Progress" value={summary.inProgress} size="sm" />
                <EmployeeStatCard icon={Eye} hex="#9BCEC1" label="Reviewing" value={summary.reviewing} size="sm" />
                <EmployeeStatCard icon={CalendarClock} hex="#67A2C5" label="Due Soon" value={summary.dueSoon} size="sm" />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    type="button"
                    onClick={() => handleTabChange("active")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${activeTab === "active" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                >
                    Active ({activeTasks.length})
                </button>
                <button
                    type="button"
                    onClick={() => handleTabChange("frozen")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${activeTab === "frozen" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                >
                    <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                    Frozen ({frozenTasks.length})
                </button>
            </div>

            <FilterToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search tasks..."
                statusValue={statusValue}
                onStatusChange={setStatusValue}
                statusOptions={STATUS_OPTIONS}
                priorityValue={priorityValue}
                onPriorityChange={setPriorityValue}
                priorityOptions={PRIORITY_OPTIONS}
                onClearFilters={handleClearFilters}
            >
                {projectOptions.length > 0 && (
                    <select
                        value={projectValue}
                        onChange={(e) => setProjectValue(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                    >
                        <option value="">All Projects</option>
                        {projectOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                )}
            </FilterToolbar>

            <DataTable
                columns={columns}
                data={filteredTasks}
                isLoading={loading}
                emptyMessage={activeTab === "frozen" ? "No frozen tasks — nothing is currently blocked." : "No tasks assigned yet."}
                onRowClick={(task) => { setSelectedTask(task); addRecentTask(task) }}
                sorting={sorting}
                onSortChange={handleSortChange}
            />

            <TaskDrawerContent
                key={selectedTask?.id ?? "none"}
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onStartTask={handleStartTask}
                onRequestSubmit={setSubmittingTask}
                onRequestRecall={setRecallingTask}
            />

            <TaskSubmitReviewModal
                key={submittingTask?.id ?? "none-submit"}
                task={submittingTask}
                changeStatus={changeStatus}
                onClose={() => setSubmittingTask(null)}
            />

            <PromptReasonModal
                isOpen={Boolean(recallingTask)}
                onClose={() => setRecallingTask(null)}
                onConfirm={handleConfirmRecall}
                title={`Recall Submission: "${recallingTask?.title}"`}
                description="This will move the task back to 'In Progress' and allow you to edit logged hours, upload new files, or update deliverables before manager QA signoff."
                placeholder="Please provide a clear reason for recalling this submission..."
                confirmText="Recall to In Progress"
                variant="warning"
                isLoading={isRecalling}
            />
        </div>
    )
}
