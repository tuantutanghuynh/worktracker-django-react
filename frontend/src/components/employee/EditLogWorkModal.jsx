import { useState } from 'react'
import { Clock, FileText, CheckCircle2 } from 'lucide-react'
import BaseModal from '../common/modal/BaseModal'
import { cn } from '../../utils/cn'

// Sửa trực tiếp giờ/mô tả trên 1 log work đang PENDING, bắt buộc ghi lý
// do — thay Void cho lỗi nhỏ (gõ nhầm giờ), Void vẫn giữ cho lỗi nặng
// hơn (nhầm task/ngày). Dùng chung ở cả MyTasksPage lẫn TimesheetPage.
//
// Không dùng useEffect để điền lại giờ/mô tả khi đổi logWork (dính lỗi
// react-hooks/set-state-in-effect, đã gặp ở TaskDrawerContent) — khởi
// tạo state thẳng từ props, nơi render phải truyền key={logWork?.id}
// để buộc React tạo instance mới (reset state) mỗi khi đổi log work,
// giống cách TaskDrawerContent/TaskSubmitReviewModal đã làm.
export default function EditLogWorkModal({ isOpen, logWork, onClose, onConfirm, isLoading = false }) {
    const [hoursSpent, setHoursSpent] = useState(() => String(logWork?.hours_spent ?? ''))
    const [description, setDescription] = useState(logWork?.description || '')
    const [reason, setReason] = useState('')
    const [error, setError] = useState('')

    function handleSubmit(e) {
        e.preventDefault()
        const h = Number(hoursSpent)
        if (!hoursSpent || isNaN(h) || h <= 0) {
            setError('Hours must be greater than 0.')
            return
        }
        if (h > 8.0) {
            setError('Single log entry cannot exceed standard 8.0 hours.')
            return
        }
        if (!reason.trim()) {
            setError('Reason for editing is required.')
            return
        }
        setError('')
        onConfirm(h, description.trim(), reason.trim())
    }

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Log Work"
            description="Update the hours or description for this entry. A reason is required."
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hours Spent <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        max="8"
                        value={hoursSpent}
                        onChange={(e) => setHoursSpent(e.target.value)}
                        disabled={isLoading}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
                    <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isLoading}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reason for Editing <span className="text-rose-500">*</span></span>
                    </label>
                    <textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why are you editing this entry?"
                        disabled={isLoading}
                        className={cn(
                            'w-full p-2.5 rounded-xl border text-xs font-medium text-slate-800 focus:outline-none resize-none',
                            error
                                ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500/20'
                                : 'border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20'
                        )}
                    />
                    {error && <p className="text-[11px] font-medium text-rose-500 mt-1">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span>Saving...</span>
                        ) : (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </BaseModal>
    )
}
