import React from 'react';
import { Calendar, RotateCcw, Plus } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function DashboardHeroBanner({
  userName,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onRefresh,
  isLoading = false,
  isRefetching = false,
  onCreateJob,
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {userName} 👋
          </h1>
          <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Manager
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Real-time project operations, team capacity metrics, and actionable deliverables.
        </p>
      </div>

      {/* Controls: Month/Year Filter + Refresh Button + Create Job CTA */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-2xs gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Month {m < 10 ? `0${m}` : m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer border-l border-slate-200 pl-2"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading || isRefetching}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
          title="Refresh Live Data"
        >
          <RotateCcw className={cn('w-3.5 h-3.5', (isLoading || isRefetching) && 'animate-spin')} />
          <span>Refresh</span>
        </button>

        <button
          onClick={onCreateJob}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Job</span>
        </button>
      </div>
    </div>
  );
}
