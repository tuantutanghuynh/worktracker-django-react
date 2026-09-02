import React from 'react';
import {
  TriangleAlert,
  AlertCircle,
  Hourglass,
  Activity,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function DashboardActionQueues({
  overdueTasks = [],
  pendingLogs = [],
  recentActivities = [],
  overdueCount = 0,
  pendingTimesheetsCount = 0,
  onOpenTaskDrawer,
  onNavigate,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
      {/* QUEUE 1: OVERDUE & CRITICAL TASKS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-rose-500" />
              <span>Overdue &amp; Critical Tasks</span>
            </h3>
            <button
              onClick={() => onNavigate('/manager/kanban')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
            >
              Kanban →
            </button>
          </div>

          <div className="space-y-2.5 mt-3.5">
            {overdueTasks.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                🎉 Excellent! No tasks currently past their deadline.
              </p>
            ) : (
              overdueTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onOpenTaskDrawer(task.id)}
                  className="flex items-center justify-between p-2.5 hover:bg-rose-50/40 rounded-xl transition border border-slate-100 hover:border-rose-200 cursor-pointer gap-2.5 group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 font-extrabold text-xs flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-800 text-xs truncate group-hover:text-rose-600 transition">
                        {task.task_code}: {task.title}
                      </p>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {task.assignee_name} • Due: {task.deadlineStr}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 font-bold text-xs rounded-full border shrink-0 bg-rose-50 text-rose-700 border-rose-200">
                    {task.daysOverdue}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Critical Priority</span>
          <span className="text-rose-600 font-bold">{overdueCount} tasks need action</span>
        </div>
      </div>

      {/* QUEUE 2: PENDING WORK LOGS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-500" />
              <span>Pending Work Logs</span>
            </h3>
            <button
              onClick={() => onNavigate('/manager/timesheet')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
            >
              Review all →
            </button>
          </div>

          <div className="space-y-2.5 mt-3.5">
            {pendingLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                🎉 All caught up! No work logs waiting for review.
              </p>
            ) : (
              pendingLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition border border-slate-100 gap-2.5"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                      {(log.user?.full_name || log.user?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-800 text-xs truncate">
                        {log.task?.title || `LogWork #${log.id}`}
                      </p>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {log.user?.full_name || log.user?.email} •{' '}
                        <span className="font-bold text-slate-700">{log.hours_spent}h</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('/manager/timesheet')}
                    className="px-3 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-bold rounded-lg text-xs transition cursor-pointer shrink-0 border border-blue-200/80"
                  >
                    Review
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Showing Top 5 Pending</span>
          <span className="text-amber-700 font-bold">{pendingTimesheetsCount} in queue</span>
        </div>
      </div>

      {/* QUEUE 3: RECENT AUDIT ACTIVITIES */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span>Recent Activities</span>
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Stream
            </span>
          </div>

          <div className="space-y-2.5 mt-3.5">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No recent activities logged.</p>
            ) : (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition border border-slate-100 gap-2"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                      {act.user[0].toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-800 text-xs truncate">{act.user}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span
                          className={cn(
                            'px-2 py-0.2 rounded text-[11px] font-bold border',
                            act.actionColor
                          )}
                        >
                          {act.actionLabel}
                        </span>
                        <span className="text-xs text-slate-500 font-medium truncate">
                          on {act.target}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold shrink-0">
                    {act.time}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Real-time Audit Trail</span>
          <span className="text-slate-700 font-bold">5 events</span>
        </div>
      </div>
    </div>
  );
}
