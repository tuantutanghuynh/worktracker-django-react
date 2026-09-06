import React from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  User,
  Clock,
  Briefcase,
  ShieldCheck,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import BaseModal from '../../common/modal/BaseModal';

function formatDateSafe(dateStr, pattern = 'dd/MM/yyyy HH:mm:ss') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function TimeLockDetailModal({ isOpen, onClose, target }) {
  if (!target) return null;

  const month = String(target.lock_month).padStart(2, '0');
  const year = target.lock_year;

  const actorName =
    target.locked_by?.full_name ||
    target.locked_by?.email ||
    (target.lock_type === 'GLOBAL_LOCKED' ? 'System Admin' : 'Manager / System');

  const lockedTimeStr = target.locked_at ? formatDateSafe(target.locked_at) : 'N/A';
  const reasonText =
    target.lock_reason ||
    (target.lock_type === 'GLOBAL_LOCKED'
      ? 'Company-wide payroll lock enforced by Admin.'
      : 'Open for timesheet submissions.');

  const getStatusBadge = () => {
    if (target.lock_type === 'GLOBAL_LOCKED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
          <Lock className="w-3.5 h-3.5 text-purple-700" />
          GLOBALLY LOCKED (Admin Scope)
        </span>
      );
    }
    if (target.lock_type === 'MANUAL_LOCKED' || target.is_locked) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <Lock className="w-3.5 h-3.5 text-rose-600" />
          LOCKED (Job Scope)
        </span>
      );
    }
    if (target.lock_type === 'GRACE_UNLOCKED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Unlock className="w-3.5 h-3.5 text-amber-600" />
          GRACE UNLOCKED (Manager Override)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
        OPEN (Active)
      </span>
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Lock Audit Trail Details"
      description="Detailed historical record and compliance metadata for this timesheet period."
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-700">
        {/* Project & Period Info */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                {target.job_code}
              </span>
              <span className="font-bold text-slate-900">{target.job_name}</span>
            </div>
            {getStatusBadge()}
          </div>

          <div className="flex items-center gap-4 text-slate-500 text-[11px] pt-1 border-t border-slate-200/60 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Period: Month {month} / {year}</span>
            </span>
            {target.client_name && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>Client: {target.client_name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Audit Details */}
        <div className="space-y-3">
          {/* Performed By & Timestamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> Performed By
              </span>
              <p className="font-semibold text-slate-800 truncate" title={actorName}>
                {actorName}
              </p>
              {target.locked_by?.email && (
                <p className="text-[11px] text-slate-500 truncate">{target.locked_by.email}</p>
              )}
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Timestamp
              </span>
              <p className="font-semibold text-slate-800">{lockedTimeStr}</p>
              <p className="text-[11px] text-slate-500">Múi giờ: Asia/Ho_Chi_Minh</p>
            </div>
          </div>

          {/* Lock Reason */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Lock Reason / Audit Note
            </span>
            <p className="text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 font-medium leading-relaxed whitespace-pre-wrap">
              {reasonText}
            </p>
          </div>

          {/* Unlocked Note if available */}
          {target.unlocked_reason && (
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1.5">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Manager Unlock Justification
              </span>
              <p className="text-xs text-amber-950 bg-white p-2.5 rounded-lg border border-amber-200 font-medium leading-relaxed whitespace-pre-wrap">
                {target.unlocked_reason}
              </p>
            </div>
          )}

          {/* Scope & Policy Note */}
          <div className="flex items-start gap-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[11px] text-indigo-900">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Governance Policy: </span>
              {target.lock_type === 'GLOBAL_LOCKED'
                ? 'Period is locked company-wide by Admin on Day 5. Further modifications require Admin intervention.'
                : 'Period is locked at Job Level on Day 1. Managers have a grace review window until Day 5 to adjust work logs if necessary.'}
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
