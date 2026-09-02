import React from 'react';
import { CheckCheck as CheckCheckIcon } from 'lucide-react';

export default function TimesheetEmptyState({ onViewAll }) {
  return (
    <div className="flex-1 p-6 bg-slate-100 flex items-center justify-center">
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3.5 shadow-2xs max-w-md mx-auto">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-sm">
          <CheckCheckIcon className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">ZERO PENDING QUEUE</span>
          <h2 className="text-lg font-extrabold text-slate-900">You're All Caught Up!</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            There are no pending timesheets requiring your approval under the selected filter.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={onViewAll}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            View All Timesheets
          </button>
        </div>
      </div>
    </div>
  );
}
