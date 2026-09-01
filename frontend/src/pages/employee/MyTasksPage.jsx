import { useState, useMemo, useRef } from "react"
import { Send, Paperclip, RotateCcw, Lock, AlertTriangle, PauseCircle, ListChecks, PlayCircle, Eye, CalendarClock } from "lucide-react"
import { differenceInCalendarDays, format, parseISO, formatDistanceToNowStrict } from "date-fns"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { useTaskDetail } from "../../hooks/queries/employee/useTaskDetail"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import SideDrawer from "../../components/common/drawer/SideDrawer"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"
import PromptReasonModal from "../../components/common/modal/PromptReasonModal"
import EditLogWorkModal from "../../components/employee/EditLogWorkModal"
import StatCard from "../../components/common/cards/StatCard"
import { useRecentTasksStore } from "../../stores/useRecentTasksStore"

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

// Cùng bảng màu Pending/Approved/Rejected/Voided với TimesheetPage.jsx —
// đồng bộ ngôn ngữ hình ảnh cho review_status ở mọi nơi hiển thị.
const LOG_STATUS_STYLES = {
    PENDING: "bg-amber-50 text-amber-600 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-600 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-600 border-rose-200",
    VOIDED: "bg-slate-100 text-slate-500 border-slate-200",
}

// "Aug 22, 2026" + "9 days overdue" / "Due in 3 days" / "Due today" — thuần
// client-side từ deadline đã có sẵn, không cần API mới.
function describeDeadline(deadline) {
    if (!deadline) return null
    const days = differenceInCalendarDays(parseISO(deadline), new Date())
    const label = format(parseISO(deadline), "MMM d, yyyy")
    if (days < 0) return { label, relative: `${Math.abs(days)} day${days !== -1 ? "s" : ""} overdue`, tone: "overdue" }
    if (days === 0) return { label, relative: "Due today", tone: "today" }
    return { label, relative: `Due in ${days} day${days !== 1 ? "s" : ""}`, tone: "upcoming" }
}

const DEADLINE_TONE_STYLES = {
    overdue: "text-rose-600",
    today: "text-amber-600",
    upcoming: "text-slate-400",
}

// 1 task được coi là "frozen" (đông cứng) khi dự án của nó không còn ACTIVE
// (vd. ON_HOLD, CANCELLED...) hoặc Client của dự án đã bị Admin vô hiệu hóa —
// backend (task_transition_manager_service.validate_transition, nhánh của
// Long) đã thật sự CHẶN mọi status transition trong 2 trường hợp này; ở đây
// chỉ tái dùng đúng công thức đó để hiển thị đúng UI, không tự nghĩ thêm.
function isTaskFrozen(task) {
    if (!task) return false
    return (task.job_status && task.job_status !== "ACTIVE") || task.job_client_is_active === false
}

// Employee My Tasks (Ngày 7) — List view only for now (Kanban view
// deferred). Filtering is client-side since the list endpoint doesn't
// take query params yet, and 1 Employee's task count is small.
// Task còn việc dang dở (TODO/IN_PROGRESS/REVIEWING) mà đang frozen — task
// đã COMPLETED/CANCELLED thì dù job có frozen cũng không còn hành động nào
// bị chặn, không cần xếp vào tab Frozen.
const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "REVIEWING"]
function isFrozenOpenTask(task) {
    return OPEN_STATUSES.includes(task.status) && isTaskFrozen(task)
}

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
                <StatCard icon={ListChecks} hex="#FFB6A6" label="Total Tasks" value={summary.total} size="sm" />
                <StatCard icon={PlayCircle} hex="#FFEBD3" label="In Progress" value={summary.inProgress} size="sm" />
                <StatCard icon={Eye} hex="#9BCEC1" label="Reviewing" value={summary.reviewing} size="sm" />
                <StatCard icon={CalendarClock} hex="#67A2C5" label="Due Soon" value={summary.dueSoon} size="sm" />
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

// Tách riêng vì cần gọi useTaskDetail(task?.id) — hook phải gọi vô điều
// kiện ở top-level, không thể gọi bên trong JSX của component cha khi
// selectedTask có thể null.
function TaskDrawerContent({ task, onClose, onStartTask, onRequestSubmit, onRequestRecall }) {
    const {
        comments, workLogs, loadingDetail, submitting, error,
        submitComment, submitLogWork, submitVoidLogWork, submitEditLogWork,
    } = useTaskDetail(task?.id)

    const [commentText, setCommentText] = useState("")
    const [workDate, setWorkDate] = useState(new Date().toISOString().split("T")[0])
    const [hoursSpent, setHoursSpent] = useState("")
    const [logDescription, setLogDescription] = useState("")
    const [voidingLogId, setVoidingLogId] = useState(null)
    const [editingLog, setEditingLog] = useState(null)

    const isLocked = task?.status === "REVIEWING" || task?.status === "COMPLETED" || task?.status === "CANCELLED"
    // isFrozenOpenTask (không phải isTaskFrozen thô) — 1 task đã COMPLETED/
    // CANCELLED thì job không ACTIVE cũng chẳng còn hành động nào để chặn,
    // hiện banner "Project Frozen" lúc đó chỉ gây nhiễu bên cạnh banner
    // "Task is CLOSED" (isLocked) đã đủ giải thích rồi.
    const isFrozen = isFrozenOpenTask(task ?? {})
    const totalLoggedHours = workLogs
        .filter((log) => log.review_status !== "VOIDED")
        .reduce((sum, log) => sum + Number(log.hours_spent), 0)
    const deadlineInfo = task ? describeDeadline(task.deadline) : null

    async function handleAddComment() {
        if (!commentText.trim() || isLocked) return
        const ok = await submitComment(commentText.trim())
        if (ok) setCommentText("")
    }

    async function handleLogWork() {
        if (!hoursSpent || isLocked || isFrozen) return
        const ok = await submitLogWork({ work_date: workDate, hours_spent: hoursSpent, description: logDescription })
        if (ok) {
            setHoursSpent("")
            setLogDescription("")
        }
    }

    // Only a PENDING entry can be voided (enforced server-side too) — the
    // modal only ever opens from a button that's already gated on that.
    async function handleConfirmVoid(reason) {
        if (!voidingLogId || isFrozen) return
        const ok = await submitVoidLogWork(voidingLogId, reason)
        if (ok) setVoidingLogId(null)
    }

    async function handleConfirmEdit(hoursSpent, description, reason) {
        if (!editingLog || isFrozen) return
        const ok = await submitEditLogWork(editingLog.id, hoursSpent, description, reason)
        if (ok) setEditingLog(null)
    }

    // null khi task không có action nào (đã COMPLETED/CANCELLED, hoặc dự án
    // đang frozen nên backend sẽ từ chối mọi transition) — SideDrawer chỉ vẽ
    // khung footer khi prop này truthy, nên phải tính trước.
    const footerAction = task ? getFooterAction(task, isFrozen, { onStartTask, onRequestSubmit, onRequestRecall }) : null

    return (
        <>
            <SideDrawer
                isOpen={Boolean(task)}
                onClose={onClose}
                title={task?.title}
                subtitle={task?.job_name}
                footer={footerAction}
            >
                {task && (
                    <div className="space-y-6">
                        <div>
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                                Task &middot; TASK-{task.id}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <StatusBadge status={task.status} />
                                <PriorityBadge priority={task.priority} />
                            </div>
                        </div>

                        {isFrozen && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                                <PauseCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-amber-900">Project is Frozen ({task.job_status || "Client Inactive"})</p>
                                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                                        {task.job_client_is_active === false
                                            ? "The client for this project is inactive. Task status transitions and work logging are temporarily locked."
                                            : "This project is currently on hold or cancelled. Task status transitions and work logging are paused."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {isLocked && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                                <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-amber-900">Task is in {task.status} status</p>
                                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                                        {task.status === "REVIEWING"
                                            ? "This task is currently submitted for Manager QA Review. Work logging, edits, and comments are locked. To make adjustments, click 'Recall' on the task table."
                                            : "This task is closed. Work logging, edits, and comments are permanently locked."}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Description</p>
                            <p className="text-sm text-slate-800">{task.description}</p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Deadline</p>
                            {deadlineInfo ? (
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{deadlineInfo.label}</p>
                                    <p className={`text-xs font-semibold ${DEADLINE_TONE_STYLES[deadlineInfo.tone]}`}>{deadlineInfo.relative}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">No deadline set</p>
                            )}
                        </div>

                        {task.updated_at && (
                            <p className="text-[11px] text-slate-400">
                                Updated {formatDistanceToNowStrict(parseISO(task.updated_at), { addSuffix: true })}
                            </p>
                        )}

                        {/* Log Work — ẩn hẳn khi dự án đang frozen (backend sẽ từ
                            chối), chỉ hiện khi Task chưa bị khóa (TODO hoặc IN_PROGRESS) */}
                        {isFrozen ? (
                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-1.5">Log Work</p>
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
                                    Work logging is disabled because this project is currently frozen ({task.job_status || "Client Inactive"}).
                                </div>
                            </div>
                        ) : !isLocked && (
                            <div className="border-t border-slate-100 pt-4 space-y-2">
                                <p className="text-xs font-semibold text-slate-400 uppercase">Log Work</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500">Date</label>
                                        <input
                                            type="date"
                                            value={workDate}
                                            onChange={(e) => setWorkDate(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500">Hours</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            placeholder="e.g. 1.5"
                                            value={hoursSpent}
                                            onChange={(e) => setHoursSpent(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                                        />
                                    </div>
                                </div>
                                <textarea
                                    placeholder="What did you work on?"
                                    value={logDescription}
                                    onChange={(e) => setLogDescription(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                                    rows={2}
                                />
                                <p className="text-[10px] text-slate-400">
                                    Capped at 8 hours total per day, across all your tasks.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleLogWork}
                                    disabled={submitting || !hoursSpent}
                                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                                >
                                    Log Work
                                </button>
                            </div>
                        )}

                        {/* Logged Hours — list các entry đã tạo, Void & Edit chỉ hiện khi chưa bị Lock/Frozen và còn PENDING */}
                        <div className="border-t border-slate-100 pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-400 uppercase">Logged Hours</p>
                                {totalLoggedHours > 0 && (
                                    <p className="text-xs font-bold text-slate-700">{totalLoggedHours}h total</p>
                                )}
                            </div>
                            {loadingDetail ? (
                                <p className="text-xs text-slate-500">Loading...</p>
                            ) : workLogs.length === 0 ? (
                                <p className="text-xs text-slate-500">No hours logged yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {workLogs.map((log) => (
                                        <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">
                                                    {format(parseISO(log.work_date), "MMM d")} — {log.hours_spent}h
                                                </p>
                                                <p className="text-[11px] text-slate-500">{log.description}</p>
                                                {log.review_status === "VOIDED" && (
                                                    <p className="text-[11px] text-rose-600 mt-1">Voided: {log.adjustment_reason}</p>
                                                )}
                                            </div>
                                            {!isLocked && !isFrozen && log.review_status === "PENDING" ? (
                                                <div className="flex items-center gap-2.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingLog(log)}
                                                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setVoidingLogId(log.id)}
                                                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                                                    >
                                                        Void
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${LOG_STATUS_STYLES[log.review_status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                                    {log.review_status}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Comments */}
                        <div className="border-t border-slate-100 pt-4 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Comments</p>
                            {loadingDetail ? (
                                <p className="text-xs text-slate-500">Loading...</p>
                            ) : comments.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">No comments yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {comments.map((c) => (
                                        <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[11px] font-bold text-slate-800">{c.author_name}</p>
                                                {c.created_at && (
                                                    <p className="text-[10px] text-slate-400 shrink-0">
                                                        {formatDistanceToNowStrict(parseISO(c.created_at), { addSuffix: true })}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5">{c.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!isLocked ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add a comment..."
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddComment}
                                        disabled={submitting || !commentText.trim()}
                                        className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 cursor-pointer"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 italic">Comments are locked while task is in {task.status} status.</p>
                            )}
                        </div>

                        {error && <p className="text-xs text-rose-600">{error}</p>}
                    </div>
                )}
            </SideDrawer>

            <PromptReasonModal
                isOpen={Boolean(voidingLogId)}
                onClose={() => setVoidingLogId(null)}
                onConfirm={handleConfirmVoid}
                title="Void Log Work"
                description="This entry will be excluded from your daily total. This cannot be undone."
                confirmText="Void Entry"
                isLoading={submitting}
            />

            <EditLogWorkModal
                key={editingLog?.id ?? "none-edit"}
                isOpen={Boolean(editingLog)}
                logWork={editingLog}
                onClose={() => setEditingLog(null)}
                onConfirm={handleConfirmEdit}
                isLoading={submitting}
            />
        </>
    )
}

// Nội dung cho slot `footer` có sẵn của SideDrawer — 1 chỗ duy nhất
// tổng hợp thao tác chính theo status, thay vì bắt người dùng đóng
// drawer rồi tìm nút ở table. Trả về null (không phải component rỗng)
// khi task không còn action nào — SideDrawer chỉ vẽ khung footer khi
// giá trị truyền vào truthy. Khi dự án đang frozen, backend sẽ từ chối
// mọi transition (task_transition_manager_service.validate_transition) —
// nên hiện luôn thông báo thay vì 1 nút bấm sẽ chỉ báo lỗi 400.
function getFooterAction(task, isFrozen, { onStartTask, onRequestSubmit, onRequestRecall }) {
    if (isFrozen && (task.status === "TODO" || task.status === "IN_PROGRESS")) {
        return (
            <p className="w-full py-2 text-center text-xs font-bold text-slate-500 bg-slate-100 rounded-lg flex items-center justify-center gap-1.5">
                <PauseCircle size={13} />
                Project Frozen — actions disabled
            </p>
        )
    }
    if (task.status === "TODO") {
        return (
            <button
                type="button"
                onClick={() => onStartTask(task)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
                Start Task
            </button>
        )
    }
    if (task.status === "IN_PROGRESS") {
        return (
            <button
                type="button"
                onClick={() => onRequestSubmit(task)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
                Submit for Review
            </button>
        )
    }
    if (task.status === "REVIEWING") {
        return (
            <button
                type="button"
                onClick={() => onRequestRecall(task)}
                className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
            >
                <RotateCcw size={13} />
                Recall Submission
            </button>
        )
    }
    if (task.status === "COMPLETED") {
        return (
            <p className="w-full py-2 text-center text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg">
                &#10003; Completed
            </p>
        )
    }
    return null
}

// Popup xem lại công việc trước khi Submit for Review — tách biệt hoàn
// toàn với TaskDrawerContent (SideDrawer = xem/quản lý, modal này = xác
// nhận nộp bài), cùng lý do gọi useTaskDetail() riêng và dùng key prop
// để reset state khi đổi task, giống TaskDrawerContent.
function TaskSubmitReviewModal({ task, changeStatus, onClose }) {
    const { workLogs, attachments, loadingDetail, submitting, submitAttachment, submitComment } = useTaskDetail(task?.id)
    const fileInputRef = useRef(null)
    const [confirming, setConfirming] = useState(false)
    const [submissionNote, setSubmissionNote] = useState("")

    const totalHours = workLogs
        .filter((log) => log.review_status !== "VOIDED")
        .reduce((sum, log) => sum + Number(log.hours_spent), 0)

    async function handleUploadFile(e) {
        const file = e.target.files?.[0]
        if (!file) return
        await submitAttachment(file)
        e.target.value = ""
    }

    async function handleConfirmSubmit() {
        if (!task) return
        setConfirming(true)
        if (submissionNote.trim()) {
            await submitComment(`[QA Deliverable Submission]: ${submissionNote.trim()}`)
        }
        const ok = await changeStatus(task.id, "REVIEWING")
        setConfirming(false)
        if (ok) onClose()
    }

    if (!task) return null

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Submit "{task.title}" for Review</h2>

                {loadingDetail ? (
                    <p className="text-xs text-slate-400">Loading...</p>
                ) : (
                    <>
                        {totalHours <= 0 && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                                <AlertTriangle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                                <div>
                                    <p className="font-bold text-rose-800">Work Log Required</p>
                                    <p className="text-[11px] text-rose-600 mt-0.5">
                                        You must log at least one work hour entry (&gt; 0h) on this task before submitting for Manager QA review.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase">
                                Logged Work (Total: {totalHours}h)
                            </p>
                            {workLogs.length > 0 && (
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {workLogs.map((log) => (
                                        <div key={log.id} className="text-xs text-slate-700 flex justify-between border-b border-slate-100 pb-1">
                                            <span>{log.work_date} — {log.description}</span>
                                            <span className="font-semibold shrink-0 ml-2">{log.hours_spent}h</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700">
                                Submission Note / Deliverable Description
                            </label>
                            <textarea
                                rows={3}
                                value={submissionNote}
                                onChange={(e) => setSubmissionNote(e.target.value)}
                                placeholder="Describe what you completed, notes for the QA reviewer, or link to pull requests/deliverables..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Deliverable Files</p>
                            {attachments.length > 0 && (
                                <div className="space-y-1">
                                    {attachments.map((file) => (
                                        <p key={file.id} className="text-xs text-slate-700">{file.file_name}</p>
                                    ))}
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" onChange={handleUploadFile} className="hidden" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={submitting || confirming}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                            >
                                <Paperclip size={14} />
                                Upload another file
                            </button>
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmSubmit}
                        disabled={submitting || confirming || totalHours <= 0}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                    >
                        {confirming ? "Submitting..." : "Confirm Submit"}
                    </button>
                </div>
            </div>
        </div>
    )
}
