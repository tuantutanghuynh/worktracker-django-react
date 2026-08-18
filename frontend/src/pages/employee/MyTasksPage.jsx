import { useState, useMemo, useRef } from "react"
import { Send, Paperclip } from "lucide-react"
import { useMyTasks } from "../../hooks/useMyTasks"
import { useTaskDetail } from "../../hooks/useTaskDetail"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import SideDrawer from "../../components/common/drawer/SideDrawer"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"
import PromptReasonModal from "../../components/common/modal/PromptReasonModal"


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

// Employee My Tasks (Ngày 7) — List view only for now (Kanban view
// deferred). Filtering is client-side since the list endpoint doesn't
// take query params yet, and 1 Employee's task count is small.
export function MyTasksPage() {
    const { tasks, loading, error, changeStatus } = useMyTasks()
    const [searchQuery, setSearchQuery] = useState("")
    const [statusValue, setStatusValue] = useState("")
    const [priorityValue, setPriorityValue] = useState("")
    const [selectedTask, setSelectedTask] = useState(null)

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
            if (statusValue && task.status !== statusValue) return false
            if (priorityValue && task.priority !== priorityValue) return false
            return true
        })
    }, [tasks, searchQuery, statusValue, priorityValue])

    function handleClearFilters() {
        setSearchQuery("")
        setStatusValue("")
        setPriorityValue("")
    }

    // Only 2 actions are ever valid for an Employee: start a TODO task, or
    // submit an IN_PROGRESS task for review (FR-39) — apply_transition()
    // on the backend enforces this regardless, this just picks the target.
    async function handleAction(task) {
        if (task.status === "TODO") {
            await changeStatus(task.id, "IN_PROGRESS")
        } else if (task.status === "IN_PROGRESS") {
            await changeStatus(task.id, "REVIEWING")
        }
    }

    const columns = [
        { accessorKey: "title", header: "Task" },
        { accessorKey: "job_name", header: "Job / Project" },
        {
            accessorKey: "priority",
            header: "Priority",
            cell: (info) => <PriorityBadge priority={info.row.original.priority} />,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: (info) => <StatusBadge status={info.row.original.status} />,
        },
        { accessorKey: "deadline", header: "Deadline" },
        {
            accessorKey: "action",
            header: "Action",
            cell: (info) => {
                const task = info.row.original
                if (task.status === "TODO") {
                    return (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAction(task) }}
                            className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                        >
                            Start Task
                        </button>
                    )
                }
                if (task.status === "IN_PROGRESS") {
                    return (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAction(task) }}
                            className="px-3 py-1 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg"
                        >
                            Submit for Review
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Tasks</h1>
                <p className="text-slate-500 text-xs">Tasks assigned to you across all projects.</p>
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
            />

            <DataTable
                columns={columns}
                data={filteredTasks}
                isLoading={loading}
                emptyMessage="No tasks assigned yet."
                onRowClick={(task) => setSelectedTask(task)}
            />

              <TaskDrawerContent key={selectedTask?.id ?? "none"} task={selectedTask} onClose={() => setSelectedTask(null)} />
        </div>
    )
}
// Tách riêng vì cần gọi useTaskDetail(task?.id) — hook phải gọi vô điều
// kiện ở top-level, không thể gọi bên trong JSX của component cha khi
// selectedTask có thể null.
function TaskDrawerContent({ task, onClose }) {
    const {
        comments, workLogs, loadingDetail, submitting, error,
        submitComment, submitAttachment, submitLogWork, submitVoidLogWork,
    } = useTaskDetail(task?.id)

    const [commentText, setCommentText] = useState("")
    const [workDate, setWorkDate] = useState(new Date().toISOString().split("T")[0])
    const [hoursSpent, setHoursSpent] = useState("")
    const [logDescription, setLogDescription] = useState("")
    const [voidingLogId, setVoidingLogId] = useState(null)
    const fileInputRef = useRef(null)

    async function handleAddComment() {
        if (!commentText.trim()) return
        const ok = await submitComment(commentText.trim())
        if (ok) setCommentText("")
    }

    async function handleUploadFile(e) {
        const file = e.target.files?.[0]
        if (!file) return
        await submitAttachment(file)
        e.target.value = ""
    }

    async function handleLogWork() {
        if (!hoursSpent) return
        const ok = await submitLogWork({ work_date: workDate, hours_spent: hoursSpent, description: logDescription })
        if (ok) {
            setHoursSpent("")
            setLogDescription("")
        }
    }

    // Only a PENDING entry can be voided (enforced server-side too) — the
    // modal only ever opens from a button that's already gated on that.
    async function handleConfirmVoid(reason) {
        if (!voidingLogId) return
        const ok = await submitVoidLogWork(voidingLogId, reason)
        if (ok) setVoidingLogId(null)
    }

    return (
        <>
            <SideDrawer isOpen={Boolean(task)} onClose={onClose} title={task?.title} subtitle={task?.job_name}>
                {task && (
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Description</p>
                            <p className="text-sm text-slate-200">{task.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <StatusBadge status={task.status} />
                            <PriorityBadge priority={task.priority} />
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Deadline</p>
                            <p className="text-sm text-slate-200">{task.deadline}</p>
                        </div>

                        {/* Log Work — gọi thẳng EmployeeLogWorkView, không qua dropdown chọn task */}
                        <div className="border-t border-slate-800 pt-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Log Work</p>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    value={workDate}
                                    onChange={(e) => setWorkDate(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                                />
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    placeholder="Hours"
                                    value={hoursSpent}
                                    onChange={(e) => setHoursSpent(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                                />
                            </div>
                            <textarea
                                placeholder="What did you work on?"
                                value={logDescription}
                                onChange={(e) => setLogDescription(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                                rows={2}
                            />
                            <button
                                type="button"
                                onClick={handleLogWork}
                                disabled={submitting || !hoursSpent}
                                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                            >
                                Log Work
                            </button>
                        </div>

                        {/* Logged Hours — list các entry đã tạo, Void chỉ hiện khi còn PENDING */}
                        <div className="border-t border-slate-800 pt-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Logged Hours</p>
                            {loadingDetail ? (
                                <p className="text-xs text-slate-500">Loading...</p>
                            ) : workLogs.length === 0 ? (
                                <p className="text-xs text-slate-500">No hours logged yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {workLogs.map((log) => (
                                        <div key={log.id} className="bg-slate-800/60 rounded-lg p-2.5 flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-bold text-slate-200">{log.work_date} — {log.hours_spent}h</p>
                                                <p className="text-[11px] text-slate-400">{log.description}</p>
                                                {log.review_status === "VOIDED" && (
                                                    <p className="text-[11px] text-rose-400 mt-1">Voided: {log.adjustment_reason}</p>
                                                )}
                                            </div>
                                            {log.review_status === "PENDING" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setVoidingLogId(log.id)}
                                                    className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 shrink-0"
                                                >
                                                    Void
                                                </button>
                                            ) : (
                                                <span className="text-[11px] font-semibold text-slate-400 shrink-0">{log.review_status}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Attachment */}
                        <div className="border-t border-slate-800 pt-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Deliverable</p>
                            <input ref={fileInputRef} type="file" onChange={handleUploadFile} className="hidden" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={submitting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg disabled:opacity-50"
                            >
                                <Paperclip size={14} />
                                Upload File
                            </button>
                        </div>

                        {/* Comments */}
                        <div className="border-t border-slate-800 pt-4 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Comments</p>
                            {loadingDetail ? (
                                <p className="text-xs text-slate-500">Loading...</p>
                            ) : (
                                <div className="space-y-2">
                                    {comments.map((c) => (
                                        <div key={c.id} className="bg-slate-800/60 rounded-lg p-2.5">
                                            <p className="text-[11px] font-bold text-slate-300">{c.author_name}</p>
                                            <p className="text-xs text-slate-400">{c.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Add a comment..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddComment}
                                    disabled={submitting || !commentText.trim()}
                                    className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-xs text-rose-400">{error}</p>}
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
        </>
    )
}
