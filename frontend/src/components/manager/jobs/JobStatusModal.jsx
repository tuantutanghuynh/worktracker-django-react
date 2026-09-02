import React from 'react';
import BaseModal from '../../common/modal/BaseModal';

const ALLOWED_TRANSITIONS = {
  PLANNING: [
    { value: 'ACTIVE', label: 'ACTIVE - Start project execution' },
    { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
  ],
  ACTIVE: [
    { value: 'ON_HOLD', label: 'ON HOLD - Temporarily pause project' },
    { value: 'COMPLETED', label: 'COMPLETED - Mark project as finished' },
    { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
  ],
  ON_HOLD: [
    { value: 'ACTIVE', label: 'ACTIVE - Resume project execution' },
    { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export default function JobStatusModal({
  isOpen,
  onClose,
  targetJob,
  newStatusValue,
  setNewStatusValue,
  statusReason,
  setStatusReason,
  onSubmit,
  isPending = false,
}) {
  const allowedOptions = targetJob ? ALLOWED_TRANSITIONS[targetJob.status] || [] : [];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Project Status"
      description={`Update lifecycle status for "${targetJob?.job_name}"`}
    >
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <span className="text-slate-600 font-semibold">Current Status:</span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
            {targetJob?.status}
          </span>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1.5">New Project Status *</label>
          <select
            value={newStatusValue}
            onChange={(e) => setNewStatusValue(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allowedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {(newStatusValue === 'ON_HOLD' || newStatusValue === 'CANCELLED') && (
          <div className="space-y-1">
            <label className="block font-bold text-rose-700">
              Reason for status change *
            </label>
            <textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Explain why this project is put on hold or cancelled..."
              required
              className="w-full bg-rose-50/50 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
          >
            {isPending ? 'Updating...' : 'Confirm Status Change'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
