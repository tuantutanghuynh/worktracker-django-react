import React from 'react';
import { Folder, Users, Hourglass, Clock, TriangleAlert } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function DashboardKPICards({
  metrics = {
    managed_jobs: 0,
    team_members: 0,
    pending_timesheets: 0,
    team_work_hours: '0h',
    overdue_task_rate: '0%',
    overdue_rate_num: 0,
    overdue_count: 0,
    active_tasks_count: 0,
  },
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* CARD 1: MANAGED JOBS */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Folder className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 block">Managed Jobs</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics.managed_jobs}
            </span>
            <span className="text-xs font-semibold text-slate-400">in scope</span>
          </div>
        </div>
      </div>

      {/* CARD 2: TEAM MEMBERS */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 block">Team Members</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics.team_members}
            </span>
            <span className="text-xs font-semibold text-slate-400">assigned</span>
          </div>
        </div>
      </div>

      {/* CARD 3: PENDING TIMESHEETS */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <Hourglass className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 block">Pending Timesheets</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
              {metrics.pending_timesheets}
            </span>
            <span className="text-xs font-semibold text-slate-400">waiting review</span>
          </div>
        </div>
      </div>

      {/* CARD 4: TEAM WORK HOURS */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 block">Team Work Hours</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics.team_work_hours}
            </span>
            <span className="text-xs font-semibold text-slate-400">logged</span>
          </div>
        </div>
      </div>

      {/* CARD 5: OVERDUE TASK RATE */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center',
            metrics.overdue_rate_num > 10
              ? 'bg-rose-50 text-rose-500 border border-rose-100'
              : 'bg-emerald-50 text-emerald-600'
          )}
        >
          <TriangleAlert className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 block">Overdue Task Rate</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={cn(
                'text-2xl sm:text-3xl font-extrabold tracking-tight',
                metrics.overdue_rate_num > 10 ? 'text-rose-600' : 'text-emerald-600'
              )}
            >
              {metrics.overdue_task_rate}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              ({metrics.overdue_count} of {metrics.active_tasks_count})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
