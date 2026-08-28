import { useState, useMemo, useRef } from "react"
import { Send, Paperclip, RotateCcw, Lock, AlertTriangle } from "lucide-react"
import { useMyTasks } from "../../hooks/queries/employee/useMyTasks"
import { useTaskDetail } from "../../hooks/queries/employee/useTaskDetail"
import { FilterToolbar } from "../../components/common/table/FilterToolbar"
import { DataTable } from "../../components/common/table/DataTable"
import SideDrawer from "../../components/common/drawer/SideDrawer"
import StatusBadge from "../../components/common/badges/StatusBadge"
import PriorityBadge from "../../components/common/badges/PriorityBadge"
import PromptReasonModal from "../../components/common/modal/PromptReasonModal"
import EditLogWorkModal from "../../components/employee/EditLogWorkModal"
import { useRecentTasksStore } from "../../stores/useRecentTasksStore"

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

// Cùng bảng màu Pending/Approved/Rejected/Voided với TimesheetPage.jsx —
// đồng bộ ngôn ngữ hình ảnh cho review_status ở mọi nơi hiển thị.
const LOG_STATUS_STYLES = {
    PENDING: "bg-amber-50 text-amber-600 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-600 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-600 border-rose-200",
    VOIDED: "bg-slate-100 text-slate-500 border-slate-200",
}

// Employee My Tasks (Ngày 7) — List view only for now (Kanban view
// deferred). Filtering is client-side since the list endpoint doesn't
// take query params yet, and 1 Employee's task count is small.
export function MyTasksPage() {
    const { tasks, loading, error, changeStatus } = useMyTasks()
    const { addRecentTask } = useRecentTasksStore()
    const [searchQuery, setSearchQuery] = useState("")
    const [statusValue, setStatusValue] = useState("")
    const [priorityValue, setPriorityValue] = useState("")
    const [selectedTask, setSelectedTask] = useState(null)
    const [submittingTask, setSubmittingTask] = useState(null)
    const [recallingTask, setRecallingTask] = useState(null)
    const [isRecalling, setIsRecalling] = useState(false)

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
                            onClick={(e) => { e.stopPropagation(); handleStartTask(task) }}
                            className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                        >
                            Start Task
                        </button>
                    )
                }
                if (task.status === "IN_PROGRESS") {
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
                onRowClick={(task) => { setSelectedTask(task); addRecentTask(task) }}
            />

            <TaskDrawerContent key={selectedTask?.id ?? "none"} task={selectedTask} onClose={() => setSelectedTask(null)} />

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
function TaskDrawerContent({ task, onClose }) {
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

    async function handleAddComment() {
        if (!commentText.trim() || isLocked) return
        const ok = await submitComment(commentText.trim())
        if (ok) setCommentText("")
    }

    async function handleLogWork() {
        if (!hoursSpent || isLocked) return
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

    async function handleConfirmEdit(hoursSpent, description, reason) {
        if (!editingLog) return
        const ok = await submitEditLogWork(editingLog.id, hoursSpent, description, reason)
        if (ok) setEditingLog(null)
    }

    return (
        <>
            <SideDrawer isOpen={Boolean(task)} onClose={onClose} title={task?.title} subtitle={task?.job_name}>
                {task && (
                    <div className="space-y-6">
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

                        <div className="flex items-center gap-2">
                            <StatusBadge status={task.status} />
                            <PriorityBadge priority={task.priority} />
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Deadline</p>
                            <p className="text-sm font-medium text-slate-800">{task.deadline}</p>
                        </div>

                        {/* Log Work — Chỉ hiển thị khi Task chưa bị khóa (TODO hoặc IN_PROGRESS) */}
                        {!isLocked && (
                            <div className="border-t border-slate-100 pt-4 space-y-2">
                                <p className="text-xs font-semibold text-slate-400 uppercase">Log Work</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={workDate}
                                        onChange={(e) => setWorkDate(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                                    />
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        placeholder="Hours"
                                        value={hoursSpent}
                                        onChange={(e) => setHoursSpent(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                                    />
                                </div>
                                <textarea
                                    placeholder="What did you work on?"
                                    value={logDescription}
                                    onChange={(e) => setLogDescription(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                                    rows={2}
                                />
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

                        {/* Logged Hours — list các entry đã tạo, Void & Edit chỉ hiện khi chưa bị Lock và còn PENDING */}
                        <div className="border-t border-slate-100 pt-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Logged Hours</p>
                            {loadingDetail ? (
                                <p className="text-xs text-slate-500">Loading...</p>
                            ) : workLogs.length === 0 ? (
                                <p className="text-xs text-slate-500">No hours logged yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {workLogs.map((log) => (
                                        <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{log.work_date} — {log.hours_spent}h</p>
                                                <p className="text-[11px] text-slate-500">{log.description}</p>
                                                {log.review_status === "VOIDED" && (
                                                    <p className="text-[11px] text-rose-600 mt-1">Voided: {log.adjustment_reason}</p>
                                                )}
                                            </div>
                                            {!isLocked && log.review_status === "PENDING" ? (
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
                            ) : (
                                <div className="space-y-2">
                                    {comments.map((c) => (
                                        <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                                            <p className="text-[11px] font-bold text-slate-800">{c.author_name}</p>
                                            <p className="text-xs text-slate-600">{c.content}</p>
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
