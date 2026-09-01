import { useState } from "react"
import { Send, Lock, PauseCircle, RotateCcw } from "lucide-react"
import { format, parseISO, formatDistanceToNowStrict } from "date-fns"
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
