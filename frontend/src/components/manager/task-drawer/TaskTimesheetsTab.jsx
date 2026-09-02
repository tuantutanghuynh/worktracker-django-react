import React from 'react';
import { Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr) {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function TaskTimesheetsTab({
  logWorks = [],
  totalLoggedHours = 0,
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between">
        <div>
          <h4 className="font-bold text-blue-900 text-xs">Accumulated Work Hours</h4>
          <p className="text-[11px] text-blue-700">Total verified hours logged on this deliverable</p>
        </div>
        <span className="text-base font-extrabold text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-2xs">
          {totalLoggedHours.toFixed(1)} hrs
        </span>
      </div>

      {logWorks.length === 0 ? (
        <div className="py-10 text-center text-slate-400 space-y-1">
          <Clock className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-600 text-xs">No work logs recorded yet.</p>
          <p className="text-[11px]">When team members submit timesheets for this task, entries will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
          {logWorks.map((lw) => (
            <div
              key={lw.id}
              className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserAvatar user={lw.user || { full_name: lw.employee_name }} size="xs" />
                  <div>
                    <span className="font-bold text-slate-900 text-xs">
                      {lw.employee_name || lw.user?.email || 'Employee'}
                    </span>
                    <span className="text-slate-400 text-[10px] ml-2">
                      {formatDateSafe(lw.work_date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                    {lw.hours_spent}h
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase',
                      lw.review_status === 'APPROVED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      lw.review_status === 'PENDING' && 'bg-amber-50 text-amber-700 border-amber-200',
                      lw.review_status === 'REJECTED' && 'bg-rose-50 text-rose-700 border-rose-200'
                    )}
                  >
                    {lw.review_status}
                  </span>
                </div>
              </div>

              {lw.description && (
                <p className="text-slate-600 text-[11px] leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {lw.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
