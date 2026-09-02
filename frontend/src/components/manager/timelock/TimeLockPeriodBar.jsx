import React from 'react';
import { Calendar, Sparkles, AlertTriangle, Lock } from 'lucide-react';

export default function TimeLockPeriodBar({
  periodOptions = [],
  activeYear,
  activeMonth,
  onPeriodChange,
  isCurrentPeriod = false,
  isPastPeriod = false,
  globalLockRecord = null,
}) {
  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700">Select Timesheet Period:</span>
            <select
              value={`${activeYear}-${activeMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                onPeriodChange(y, m);
              }}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {globalLockRecord ? (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1.5 shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <span>
                Admin Global Freeze Active: Month {String(activeMonth).padStart(2, '0')}/{activeYear} is locked company-wide for payroll.
              </span>
            </span>
          ) : isCurrentPeriod ? (
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Active Month: Open for employee timesheet submissions until end of month.</span>
            </span>
          ) : isPastPeriod ? (
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Past Closed Period: Ready for monthly payroll freeze.</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
