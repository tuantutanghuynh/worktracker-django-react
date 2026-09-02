import React from 'react';
import { Lock, Clock, RotateCcw } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function TimeLockHeroHeader({
  serverMonth,
  serverYear,
  activeMonth,
  onRefresh,
  isFetching = false,
  onBatchLockAll,
  isBatchLocking = false,
  unlockedCount = 0,
  isCurrentPeriod = false,
  isGloballyLocked = false,
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20 shrink-0">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">Period Locks Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Server Clock: Month {String(serverMonth).padStart(2, '0')} / {serverYear}
            </span>
            {isGloballyLocked && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                <Lock className="w-3 h-3 text-purple-700" /> Admin Global Freeze Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized timesheet period freeze for all your projects. Lock to prevent modifications or unlock to correct work logs.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Nút Làm Mới */}
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
        >
          <RotateCcw className={cn('w-3.5 h-3.5 text-slate-500', isFetching && 'animate-spin')} />
          <span>Refresh</span>
        </button>

        {/* Nút 1-Click Khóa Toàn Bộ Dự Án Của Manager */}
        <button
          onClick={onBatchLockAll}
          disabled={isFetching || unlockedCount === 0 || isCurrentPeriod || isGloballyLocked}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md',
            isGloballyLocked
              ? 'bg-purple-100 text-purple-700 border border-purple-300 cursor-not-allowed shadow-none'
              : isCurrentPeriod
              ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 cursor-pointer disabled:opacity-50'
          )}
          title={
            isGloballyLocked
              ? 'Period is already globally locked company-wide by Admin.'
              : isCurrentPeriod
              ? `Month ${String(activeMonth).padStart(2, '0')} is currently in progress. You can only lock after the month ends.`
              : 'Lock all unlocked projects for this period'
          }
        >
          <Lock className="w-4 h-4" />
          <span>
            {isBatchLocking
              ? 'Locking All...'
              : isGloballyLocked
              ? `Globally Locked by Admin (Month ${String(activeMonth).padStart(2, '0')})`
              : isCurrentPeriod
              ? `In Progress (Cannot Lock Month ${String(activeMonth).padStart(2, '0')})`
              : `Lock All My Projects (Month ${String(activeMonth).padStart(2, '0')})`}
          </span>
        </button>
      </div>
    </div>
  );
}
