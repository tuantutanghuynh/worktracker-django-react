import React from 'react';
import BaseModal from '../../common/modal/BaseModal';

export function TaskRejectModal({
  isOpen,
  onClose,
  taskTitle,
  rejectionReason,
  setRejectionReason,
  onSubmit,
  isPending = false,
}) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Deliverable Review"
      description={`Send task "${taskTitle}" back to In Progress for revision.`}
    >
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-rose-700 mb-1">
            Rejection Reason & Required Fixes *
          </label>
          <textarea
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain clearly what needs to be fixed before this task can be approved..."
            required
            className="w-full bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
          >
            {isPending ? 'Rejecting...' : 'Confirm Rejection'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

export function TaskCancelModal({
  isOpen,
  onClose,
  taskTitle,
  cancelReason,
  setCancelReason,
  onSubmit,
  isPending = false,
}) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Task"
      description={`Mark task "${taskTitle}" as cancelled.`}
    >
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-rose-700 mb-1">
            Cancellation Reason *
          </label>
          <textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Explain why this task is no longer required..."
            required
            className="w-full bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
          >
            {isPending ? 'Cancelling...' : 'Confirm Cancel'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

export function TaskDeleteModal({
  isOpen,
  onClose,
  taskTitle,
  onConfirm,
  isPending = false,
}) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Task Permanently"
      description={`Are you sure you want to permanently delete task "${taskTitle}"? This action cannot be undone.`}
    >
      <div className="space-y-4 text-xs">
        <p className="text-slate-600 leading-relaxed">
          This task has not been worked on yet. Deleting it will permanently remove it from the database, keeping your project task list clean and accurate.
        </p>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
          >
            {isPending ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
