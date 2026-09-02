import React from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function TeamHeader({ onRefresh, isFetching = false }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
            RESOURCE ALLOCATION
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
          Team Members & Workload Capacity
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Monitor real-time employee workload utilization, assigned active tasks, and project team allocations.
        </p>
      </div>

      <button
        onClick={onRefresh}
        disabled={isFetching}
        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2 transition cursor-pointer self-start md:self-auto disabled:opacity-50"
      >
        <RotateCcw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
        <span>Refresh Data</span>
      </button>
    </div>
  );
}
