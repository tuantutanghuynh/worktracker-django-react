import React from 'react';
import {
  Calendar as CalendarIcon,
  Briefcase as BriefcaseIcon,
  CheckCircle2 as CheckCircle2Icon,
  XCircle as XCircleIcon,
  Edit3 as Edit3Icon,
  Lock as LockIcon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr, pattern = 'dd MMM yyyy') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function TimesheetDetailPane({
  selectedDayGroup,
  onApproveSingle,
  onApproveAllInDay,
  isApprovingAll = false,
  onOpenRejectModal,
  onOpenCorrectModal,
  isCorrecting = false,
  isRejecting = false,
  isApproving = false,
  isPeriodLocked = false,
  periodLockReason = '',
}) {
  const getJobTitle = (lw) => {
    if (!lw) return 'Associated Job';
    return lw.task?.job?.job_name || lw.task?.job?.name || lw.job_name || lw.job_title || 'Project Job';
  };

  const getJobCode = (lw) => {
    if (!lw) return '';
    return lw.task?.job?.job_code || (lw.task?.job?.id ? `JOB-${lw.task?.job?.id}` : '');
  };

  const getTaskTitle = (lw) => {
    if (!lw) return 'Associated Task';
    return lw.task?.title || lw.task_title || `Task #${lw.task?.id || lw.task_id || lw.id}`;
  };

  if (!selectedDayGroup) {
    return (
      <section className="w-[52%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
        <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
          Select a daily timesheet entry on the left to inspect
        </div>
      </section>
    );
  }

  return (
    <section className="w-[52%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
      {/* Right Pane Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[10px] font-extrabold border border-blue-200">
              DAILY TIMESHEET
            </span>
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              {formatDateSafe(selectedDayGroup.work_date, 'EEEE, dd MMMM yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserAvatar
              avatarUrl={selectedDayGroup.user?.avatar_url || selectedDayGroup.user?.employee_profile?.avatar_url}
              fullName={selectedDayGroup.employeeName}
              size="xs"
            />
            <h2 className="text-sm font-extrabold text-slate-900">{selectedDayGroup.employeeName}</h2>
          </div>
        </div>

        {/* ⏱️ TOTAL LOGGED */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-2 rounded-xl shadow-xs text-right shrink-0">
          <p className="text-[9px] text-blue-100 font-bold uppercase tracking-wider">Total Logged</p>
          <p className="text-base font-extrabold font-mono leading-tight">
            {selectedDayGroup.total_hours.toFixed(1)} <span className="text-xs font-sans font-normal text-blue-200">hrs</span>
          </p>
        </div>
      </div>

      {/* ⚠️ PERIOD LOCK BANNER */}
      {isPeriodLocked && (
        <div className="px-3.5 py-2 bg-purple-50 border-b border-purple-200 flex items-center gap-2 text-xs text-purple-900 font-semibold shrink-0">
          <LockIcon className="w-4 h-4 text-purple-700 shrink-0" />
          <span>
            This timesheet period is locked for payroll freeze ({periodLockReason || 'Admin Global Lock'}). Approvals and modifications are disabled.
          </span>
        </div>
      )}

      {/* Right Pane Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar text-xs text-slate-700 min-h-0">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">Task Breakdown for this Day</h3>
          <span className="text-[11px] text-slate-500 font-medium">Review individual tasks or approve all</span>
        </div>

        <div className="space-y-3">
          {selectedDayGroup.items.map((lw) => {
            const logStatus = (lw.review_status || lw.status || 'PENDING').toUpperCase();
            const jobName = getJobTitle(lw);
            const jobCode = getJobCode(lw);
            const taskTitle = getTaskTitle(lw);
            const hours = parseFloat(lw.hours_spent || 0).toFixed(1);

            return (
              <div
                key={lw.id}
                className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-2xs space-y-2.5"
              >
                {/* Job Banner with large clear font */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <BriefcaseIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-extrabold text-blue-900 text-xs truncate">{jobName}</span>
                    {jobCode && (
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                        {jobCode}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-block font-mono font-extrabold text-xs px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                      {hours} hrs
                    </span>
                    <span
                      className={cn(
                        'inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase',
                        logStatus === 'APPROVED'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : logStatus === 'REJECTED'
                          ? 'text-rose-700 bg-rose-50 border border-rose-200'
                          : 'text-amber-700 bg-amber-50 border border-amber-200'
                      )}
                    >
                      {logStatus}
                    </span>
                  </div>
                </div>

                {/* Task Title */}
                <h4 className="font-extrabold text-slate-900 text-sm truncate">{taskTitle}</h4>

                {/* Work Description */}
                <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 text-xs leading-relaxed border border-slate-100">
                  {lw.description ? `"${lw.description}"` : <span className="text-slate-400 italic">No task description provided.</span>}
                </div>

                {/* Action Buttons for this specific LogWork */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <span className="text-[10px] text-slate-400 font-mono">LogWork #{lw.id}</span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenCorrectModal(lw)}
                      disabled={isCorrecting || isPeriodLocked}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isPeriodLocked ? 'Cannot adjust: Period is locked for payroll' : 'Adjust hours'}
                    >
                      <Edit3Icon className="w-3 h-3 text-slate-500" />
                      <span>Adjust</span>
                    </button>

                    {logStatus === 'PENDING' && (
                      <>
                        <button
                          onClick={() => onOpenRejectModal(lw)}
                          disabled={isRejecting || isPeriodLocked}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isPeriodLocked ? 'Cannot reject: Period is locked for payroll' : 'Reject log'}
                        >
                          <XCircleIcon className="w-3 h-3 text-rose-500" />
                          <span>Reject</span>
                        </button>

                        <button
                          onClick={() => onApproveSingle(lw)}
                          disabled={isApproving || isPeriodLocked}
                          className={cn(
                            'px-3 py-1 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs',
                            isPeriodLocked
                              ? 'bg-slate-400 cursor-not-allowed opacity-60'
                              : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50'
                          )}
                          title={isPeriodLocked ? 'Cannot approve: Period is locked for payroll' : 'Approve log'}
                        >
                          <CheckCircle2Icon className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                      </>
                    )}

                    {logStatus === 'APPROVED' && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 px-2 py-0.5">
                        <CheckCircle2Icon className="w-3.5 h-3.5" />
                        Approved
                      </span>
                    )}

                    {logStatus === 'REJECTED' && (
                      <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 px-2 py-0.5">
                        <XCircleIcon className="w-3.5 h-3.5" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FIXED BOTTOM ACTION FOOTER: APPROVE ENTIRE DAY OR PROGRESS */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0 z-20">
        <span className="text-xs text-slate-500 font-medium">
          {selectedDayGroup.items.length} Task{selectedDayGroup.items.length !== 1 ? 's' : ''} on {formatDateSafe(selectedDayGroup.work_date, 'dd MMM')}
        </span>

        {isPeriodLocked ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800 bg-purple-100 px-3.5 py-1.5 rounded-xl border border-purple-200">
            <LockIcon className="w-4 h-4 text-purple-700" />
            <span>Period Locked (Payroll Freeze)</span>
          </div>
        ) : selectedDayGroup.hasPending ? (
          <button
            onClick={onApproveAllInDay}
            disabled={isApprovingAll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2Icon className="w-4 h-4" />
            <span>{isApprovingAll ? 'Approving All...' : `Approve Entire Day (${selectedDayGroup.total_hours.toFixed(1)} hrs) →`}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
            <span>All Tasks Verified for this Day</span>
          </div>
        )}
      </div>
    </section>
  );
}
