import { useState, useRef } from "react"
import { Paperclip, AlertTriangle } from "lucide-react"
import { useTaskDetail } from "../../../hooks/queries/employee/useTaskDetail"

// Popup xem lại công việc trước khi Submit for Review — tách biệt hoàn
// toàn với TaskDrawerContent (SideDrawer = xem/quản lý, modal này = xác
// nhận nộp bài), cùng lý do gọi useTaskDetail() riêng và dùng key prop
// để reset state khi đổi task, giống TaskDrawerContent.
export function TaskSubmitReviewModal({ task, changeStatus, onClose }) {
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
