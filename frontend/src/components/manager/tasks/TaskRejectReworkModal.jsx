import React from "react";
import { FilePlus, UploadCloud, Trash2 } from "lucide-react";
import BaseModal from "../../common/modal/BaseModal";
import InputField from "../../common/forms/InputField";

/**
 * TaskRejectReworkModal - Modal từ chối Task và yêu cầu sửa lại kèm tài liệu tham khảo
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - assigneeName: string
 * - rejectionReason: string
 * - setRejectionReason: (val: string) => void
 * - referenceFile: File | null
 * - setReferenceFile: (file: File | null) => void
 * - onConfirm: () => void
 * - isPending: boolean
 */
export default function TaskRejectReworkModal({
  isOpen,
  onClose,
  assigneeName,
  rejectionReason,
  setRejectionReason,
  referenceFile,
  setReferenceFile,
  onConfirm,
  isPending = false,
}) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Return Task for Rework"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? "Sending..." : "Send Fix Request & Attachments"}
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs">
        <p className="text-slate-600">
          Provide actionable feedback for <strong>{assigneeName}</strong>. The task will transition back to <code>IN_PROGRESS</code>.
        </p>

        <InputField
          label="Fix Instructions / Rejection Reasons *"
          placeholder="Explain what needs to be fixed or adjusted in detail..."
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          multiline
          rows={3}
        />

        {/* Reference Material Uploader */}
        <div className="space-y-2">
          <label className="font-extrabold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FilePlus className="w-3.5 h-3.5 text-purple-600" />
              <span>Attach Reference Materials / Guidelines:</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
          </label>

          {referenceFile ? (
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                  REF
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate text-xs">{referenceFile.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {(referenceFile.size / 1024 / 1024).toFixed(2)} MB • Reference Guide
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReferenceFile(null)}
                className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1 cursor-pointer"
                title="Remove file"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-200 hover:border-purple-400 p-3 rounded-xl text-center bg-slate-50/50 cursor-pointer transition flex flex-col items-center justify-center gap-1">
              <UploadCloud className="w-5 h-5 text-purple-600" />
              <span className="text-[11px] text-slate-600">
                Click to select reference guide or <strong className="text-purple-600">Browse</strong>
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setReferenceFile(e.target.files[0]);
                }}
              />
            </label>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
