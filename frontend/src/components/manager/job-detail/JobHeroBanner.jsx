import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Plus,
  AlertCircle,
  Kanban,
  Flame,
  TrendingUp,
  ArrowRightLeft,
  MessageSquare,
  PauseCircle,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, isValid, startOfDay } from 'date-fns';
import { cn } from '../../../utils/cn';

/**
 * Module: components/manager/job-detail/JobHeroBanner
 * Description: Executive Hero Banner presenting master job information, action controls, deliverable progress, and key schedule KPIs.
 */

function formatDateSafe(dateStr) {
  /** Safely parse and format ISO date string to DD/MM/YYYY. */
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function JobHeroBanner({
  job,
  tasks = [],
  progressMetrics,
  isClientInactive,
  isJobFrozen,
  onOpenStatusModal,
  onOpenCreateTaskDrawer,
}) {
  const navigate = useNavigate();
  const today = startOfDay(new Date());

  // Calculate Executive Schedule KPIs
  const scheduleKPIs = useMemo(() => {
    let durationDays = 0;
    if (job?.start_date && job?.deadline) {
      const s = parseISO(job.start_date);
      const d = parseISO(job.deadline);
      if (isValid(s) && isValid(d)) {
        durationDays = Math.max(differenceInCalendarDays(d, s) + 1, 1);
      }
    }

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const todo = tasks.filter((t) => t.status === 'TODO').length;
    const overdue = tasks.filter(
      (t) => t.deadline && parseISO(t.deadline) < today && t.status !== 'COMPLETED'
    ).length;

    return {
      durationDays: durationDays || 30,
      completedRatio: `${completed}/${total}`,
      overdueCount: overdue,
      todoCount: todo,
    };
  }, [job, tasks, today]);

  if (!job) return null;

  return (
    <div className="space-y-4">
      {/* ⚠️ EXECUTIVE ALERT BANNER: CLIENT DEACTIVATED */}
      {job.client && job.client.is_active === false && (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-rose-500/10 border border-amber-300 rounded-2xl flex items-center justify-between gap-4 text-amber-950 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-xs space-y-0.5 min-w-0">
              <p className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                <span>PROJECT FROZEN — CLIENT INACTIVE</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-extrabold uppercase bg-rose-100 text-rose-700 border border-rose-200">
                  Deactivated by Admin
                </span>
              </p>
              <p className="text-amber-800 leading-relaxed">
                Client <strong>"{job.client?.client_name}"</strong> is currently inactive. This project is placed in <strong>ON_HOLD</strong> state and all task workflow transitions & deliverables QA reviews are locked until the client is reactivated.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 shrink-0 shadow-2xs">
            <PauseCircle className="w-4 h-4 text-amber-700" />
            <span>Frozen</span>
          </span>
        </div>
      )}

      {/* 🌟 HERO MASTER INFO BANNER */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        
        {/* Row 1: Header Titles & Action Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Icon, Titles & Badges */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100 font-mono">
                  {job.job_code || `JOB-${job.id}`}
                </span>

                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {job.status}
                </span>

                {job.client && job.client.is_active === false && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    <PauseCircle className="w-3 h-3 text-rose-500" />
                    Client Inactive
                  </span>
                )}

                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-extrabold uppercase border',
                    job.priority === 'HIGH'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : job.priority === 'LOW'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  )}
                >
                  {job.priority === 'HIGH' && <Flame className="w-3 h-3 text-rose-500" />}
                  {job.priority || 'MEDIUM'} Priority
                </span>

                {job.is_overdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    OVERDUE
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                {job.job_name}
              </h1>

              {job.description && (
                <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                  {job.description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => navigate(`/manager/chat?job=${job.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs border border-blue-200 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Project Chat</span>
            </button>

            <button
              onClick={() => navigate(`/manager/kanban?job_id=${job.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 transition cursor-pointer shadow-2xs"
            >
              <Kanban className="w-4 h-4 text-indigo-600" />
              <span>Kanban Board</span>
            </button>

            <button
              onClick={onOpenStatusModal}
              disabled={isClientInactive}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 font-bold rounded-xl text-xs border transition cursor-pointer",
                isClientInactive
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
              title={isClientInactive ? "Client is deactivated by Admin. Status change is locked." : "Change Status"}
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-500" />
              <span>Change Status</span>
            </button>

            <button
              onClick={onOpenCreateTaskDrawer}
              disabled={isJobFrozen}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 font-bold rounded-xl text-xs transition cursor-pointer",
                isJobFrozen
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
              )}
              title={isJobFrozen ? `Cannot add tasks to a ${job.status} project` : 'Add Task'}
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Row 2: Metadata & Executive KPI Cards */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left Metadata */}
          <div className="flex items-center gap-6 text-xs text-slate-600 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-500">Client:</span>
              <span className="font-bold text-slate-900">{job.client?.client_name || job.client_name || 'N/A'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-semibold text-slate-500">Timeline:</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatDateSafe(job.start_date)} → {formatDateSafe(job.deadline)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-500">Created:</span>
              <span className="font-bold text-slate-700 font-mono">{formatDateSafe(job.created_at)}</span>
            </div>
          </div>

          {/* 🌟 4 EXECUTIVE SCHEDULE KPIS (NEUMORPHIC CARDS) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
              <span className="text-sm font-extrabold text-slate-800">{scheduleKPIs.durationDays} Days</span>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed</span>
              <span className="text-sm font-extrabold text-emerald-600">{scheduleKPIs.completedRatio}</span>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overdue</span>
              <span className={cn('text-sm font-extrabold', scheduleKPIs.overdueCount > 0 ? 'text-rose-600' : 'text-slate-400')}>
                {scheduleKPIs.overdueCount} Tasks
              </span>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">To Do</span>
              <span className="text-sm font-extrabold text-slate-700">{scheduleKPIs.todoCount} To Do</span>
            </div>
          </div>

        </div>

        {/* Row 3: Progress Bar */}
        {progressMetrics && (
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Project Deliverable Progress</span>
              </span>
              <span className="text-emerald-600 text-sm font-extrabold">{progressMetrics.pct}%</span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-2 transition-all duration-500"
                style={{ width: `${progressMetrics.pct}%` }}
                title={`Completed: ${progressMetrics.completed}/${progressMetrics.total}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
