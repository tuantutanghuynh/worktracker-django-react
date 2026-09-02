import { useState } from "react"
import { Send, Lock, PauseCircle, RotateCcw } from "lucide-react"
import { format, parseISO, formatDistanceToNowStrict } from "date-fns"
import { toast } from "sonner"
import { useTaskDetail } from "../../../hooks/queries/employee/useTaskDetail"
import SideDrawer from "../../common/drawer/SideDrawer"
import StatusBadge from "../../common/badges/StatusBadge"
import PriorityBadge from "../../common/badges/PriorityBadge"
import PromptReasonModal from "../../common/modal/PromptReasonModal"
import EditLogWorkModal from "../EditLogWorkModal"
import { describeDeadline, DEADLINE_TONE_STYLES } from "../../../utils/deadline"
import { isFrozenOpenTask } from "../../../utils/taskFrozen"

// Cùng bảng màu Pending/Approved/Rejected/Voided với TimesheetPage.jsx —
// đồng bộ ngôn ngữ hình ảnh cho review_status ở mọi nơi hiển thị.
const LOG_STATUS_STYLES = {
    PENDING: "bg-amber-50 text-amber-600 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-600 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-600 border-rose-200",
    VOIDED: "bg-slate-100 text-slate-500 border-slate-200",
}

// Tách riêng vì cần gọi useTaskDetail(task?.id) — hook phải gọi vô điều
// kiện ở top-level, không thể gọi bên trong JSX của component cha khi
// selectedTask có thể null.
export function TaskDrawerContent({ task, onClose, onStartTask, onRequestSubmit, onRequestRecall }) {
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
    // nhưng TODO/IN_PROGRESS/REVIEWING thì phải khóa mọi tương tác.
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
        if (isLocked || isFrozen) return
        const h = Number(hoursSpent)
        if (!hoursSpent || isNaN(h) || h <= 0) {
            toast.error("Hours spent must be greater than 0.")
            return
        }
        if (h > 8.0) {
            toast.error("Single log entry cannot exceed standard 8.0 hours.")
            return
        }
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

    const subtitleContent = task?.job_name ? (
        <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-700">
            Project: {task.job_name}
        </span>
    ) : null

    return (
        <>
            <SideDrawer
                isOpen={Boolean(task)}
                onClose={onClose}
                title={task?.title}
                subtitle={subtitleContent}
                footer={footerAction}
            >
                {task && (
                    <div className="space-y-6">
                        <div>
                            <p className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider">
                                Task &middot; TASK-{task.id}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <StatusBadge status={task.status} />
                                <PriorityBadge priority={task.priority} />
                            </div>
                        </div>

                        {isFrozen && (
                            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                                <PauseCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-amber-900">Project is Frozen ({task.job_status || "Client Inactive"})</p>
                                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-medium">
                                        {task.job_client_is_active === false
                                            ? "The client for this project is inactive. Task status transitions and work logging are temporarily locked."
                                            : "This project is currently on hold or cancelled. Task status transitions and work logging are paused."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {isLocked && (
                            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-amber-900">Task is in {task.status} status</p>
                                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-medium">
                                        {task.status === "REVIEWING"
                                            ? "This task is currently submitted for Manager QA Review. Work logging, edits, and comments are locked. To make adjustments, click 'Recall' on the task table."
                                            : "This task is closed. Work logging, edits, and comments are permanently locked."}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description</p>
                            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                                <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                                    {task.description || "No description provided."}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Deadline</p>
                            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                                {deadlineInfo ? (
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{deadlineInfo.label}</p>
                                        <p className={`text-xs font-bold mt-0.5 ${DEADLINE_TONE_STYLES[deadlineInfo.tone]}`}>{deadlineInfo.relative}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs font-medium text-slate-500">No deadline set</p>
                                )}
                            </div>
                        </div>

                        {task.updated_at && (
                            <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                <span>Updated</span>
                                <span className="font-semibold text-slate-700">{formatDistanceToNowStrict(parseISO(task.updated_at), { addSuffix: true })}</span>
                            </p>
                        )}

                        {/* Log Work — ẩn hẳn khi dự án đang frozen, chỉ hiện khi Task chưa bị khóa */}
                        {isFrozen ? (
                            <div className="border-t border-slate-200 pt-5">
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Log Work</p>
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 italic">
                                    Work logging is disabled because this project is currently frozen ({task.job_status || "Client Inactive"}).
                                </div>
                            </div>
                        ) : !isLocked && (
                            <div className="border-t border-slate-200 pt-5 space-y-3">
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Log Work</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700">Date</label>
                                        <input
                                            type="date"
                                            max={new Date().toISOString().split("T")[0]}
                                            value={workDate}
                                            onChange={(e) => setWorkDate(e.target.value)}
                                            className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 shadow-2xs transition"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700">Hours</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0.5"
                                            max="8"
                                            placeholder="e.g. 1.5"
                                            value={hoursSpent}
                                            onChange={(e) => setHoursSpent(e.target.value)}
                                            className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 shadow-2xs transition"
                                        />
                                    </div>
                                </div>
                                <textarea
                                    placeholder="What did you work on?"
                                    value={logDescription}
                                    onChange={(e) => setLogDescription(e.target.value)}
                                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 shadow-2xs transition placeholder:text-slate-400"
                                    rows={2}
                                />
                                <p className="text-[11px] font-medium text-slate-600">
                                    Standard limit: 8.0 hours maximum per day across all tasks.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleLogWork}
                                    disabled={submitting || !hoursSpent}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    Log Work
                                </button>
                            </div>
                        )}

                        {/* Logged Hours — list các entry đã tạo */}
                        <div className="border-t border-slate-200 pt-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Logged Hours</p>
                                {totalLoggedHours > 0 && (
                                    <span className="text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                        {totalLoggedHours}h total
                                    </span>
                                )}
                            </div>
                            {loadingDetail ? (
                                <p className="text-xs font-medium text-slate-500">Loading hours...</p>
                            ) : workLogs.length === 0 ? (
                                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 text-center">
                                    No hours logged yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {workLogs.map((log) => (
                                        <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">
                                                    {format(parseISO(log.work_date), "MMM d, yyyy")} — <span className="text-blue-700 font-extrabold">{log.hours_spent}h</span>
                                                </p>
                                                <p className="text-xs font-medium text-slate-600 mt-0.5">{log.description || "No description"}</p>
                                                {log.review_status === "VOIDED" && (
                                                    <p className="text-[11px] font-semibold text-rose-600 mt-1">Voided: {log.adjustment_reason}</p>
                                                )}
                                            </div>
                                            {!isLocked && !isFrozen && log.review_status === "PENDING" ? (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingLog(log)}
                                                        className="px-2 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setVoidingLogId(log.id)}
                                                        className="px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                                                    >
                                                        Void
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${LOG_STATUS_STYLES[log.review_status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                                    {log.review_status}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Comments */}
                        <div className="border-t border-slate-200 pt-5 space-y-3">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Comments & Discussion</p>
                            {loadingDetail ? (
                                <p className="text-xs font-medium text-slate-500">Loading comments...</p>
                            ) : comments.length === 0 ? (
                                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 text-center">
                                    No comments yet. Start a discussion below.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {comments.map((c) => (
                                        <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs font-bold text-slate-900">{c.author_name}</p>
                                                {c.created_at && (
                                                    <p className="text-[10px] font-medium text-slate-500 shrink-0">
                                                        {formatDistanceToNowStrict(parseISO(c.created_at), { addSuffix: true })}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-xs font-medium text-slate-700 leading-relaxed">{c.content}</p>
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
                                        className="flex-1 bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 shadow-2xs transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddComment}
                                        disabled={submitting || !commentText.trim()}
                                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs font-medium text-slate-500 italic">Comments are locked while task is in {task.status} status.</p>
                            )}
                        </div>

                        {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">{error}</p>}
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
