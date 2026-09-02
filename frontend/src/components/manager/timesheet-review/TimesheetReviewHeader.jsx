import React from 'react';
import { RotateCcw as RotateCcwIcon } from 'lucide-react';

export default function TimesheetReviewHeader({
  totalPendingDays = 0,
  onRefresh,
}) {
  return (
    <header className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center justify-between shrink-0 shadow-2xs z-20">
      <div className="flex items-center gap-2.5">
        <h1 className="text-base font-extrabold text-slate-900">Timesheet Approvals & LogWork Review</h1>
        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">DAILY COCKPIT</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs flex items-center gap-2 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>{totalPendingDays} Daily Timesheets Pending</span>
        </div>

        <button
          onClick={onRefresh}
          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
          title="Refresh Data"
        >
          <RotateCcwIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
