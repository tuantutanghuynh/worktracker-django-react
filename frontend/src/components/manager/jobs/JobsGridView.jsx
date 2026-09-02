import React, { useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  Mail,
  MessageSquare,
  PauseCircle,
  Kanban,
  Edit3,
  ArrowRightLeft,
  Flame,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns';
import UserAvatar from '../../common/avatar/UserAvatar';
import PaginationBar from '../../common/table/PaginationBar';
import { cn } from '../../../utils/cn';

function formatUpdatedAtSafe(value) {
  if (!value) return 'recently';
  try {
    return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
  } catch {
    return 'recently';
  }
}

function formatDeadlineSafe(value) {
  if (!value) return null;
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

function JobStatusBadge({ status }) {
  const configs = {
    PLANNING: { bg: 'bg-blue-50 text-blue-700 border-blue-200/80', dot: 'bg-blue-500' },
    ACTIVE: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
    COMPLETED: { bg: 'bg-purple-50 text-purple-700 border-purple-200/80', dot: 'bg-purple-500' },
    ON_HOLD: { bg: 'bg-amber-50 text-amber-700 border-amber-200/80', dot: 'bg-amber-500' },
    CANCELLED: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  };

  const current = configs[status] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase shrink-0',
        current.bg
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', current.dot)} />
      {status || 'UNKNOWN'}
    </span>
  );
}

function JobPriorityBadge({ priority }) {
  const isHigh = priority === 'HIGH';
  const isLow = priority === 'LOW';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0',
        isHigh
          ? 'bg-rose-50 text-rose-700 border border-rose-200'
          : isLow
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      )}
    >
      {isHigh && <Flame className="w-3 h-3 text-rose-500" />}
      {priority || 'MEDIUM'}
    </span>
  );
}

function BreakdownRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono font-bold text-slate-700">{value}</span>
    </div>
  );
}

function ProgressSection({ progress }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  if (!progress || progress.total === 0) {
    return (
      <div className="pt-3 border-t border-slate-100 text-xs text-slate-400 italic">
        No tasks assigned yet.
      </div>
    );
  }

  const barColor =
    progress.pct >= 80
      ? 'bg-emerald-500'
      : progress.pct >= 40
      ? 'bg-blue-500'
      : 'bg-amber-500';

  return (
    <div className="pt-3 border-t border-slate-100 space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-slate-500">Progress</span>
        <span className="text-slate-900">{progress.pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowBreakdown((v) => !v);
        }}
        className="text-[11px] text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
      >
        {progress.completed} / {progress.total} tasks completed
        <ChevronDown
          className={cn('w-3 h-3 transition-transform', showBreakdown && 'rotate-180')}
        />
      </button>

      {showBreakdown && (
        <div
          className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <BreakdownRow label="To Do" value={progress.todo} />
          <BreakdownRow label="In Progress" value={progress.in_progress} />
          <BreakdownRow label="Reviewing" value={progress.reviewing} />
          <BreakdownRow label="Completed" value={progress.completed} />
          {progress.cancelled > 0 && (
            <BreakdownRow label="Cancelled" value={progress.cancelled} />
          )}
        </div>
      )}
    </div>
  );
}

function PersonRow({ person, onMessage, showActions = true, isManager = false }) {
  if (!person) return null;
  const fullName = person.full_name || person.email || 'Staff Member';
  const email = person.email || '';

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <UserAvatar user={person} size="sm" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">
            {fullName}
            {isManager && <span className="text-slate-400 font-normal"> (You)</span>}
            {person.is_active === false && (
              <span className="text-slate-400 font-normal"> (inactive)</span>
            )}
          </p>
          {email && <p className="text-[10px] text-slate-400 truncate">{email}</p>}
        </div>
      </div>
      {showActions && email && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <a
            href={`mailto:${email}`}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title={`Send Email to ${fullName}`}
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
          {onMessage && (
            <button
              type="button"
              onClick={() => onMessage(person.id)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
              title={`Direct Message ${fullName}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TeamSection({ teammates = [], onMessage }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_STACK = 5;
  const VISIBLE_ROWS = 3;
  const overflowCount = Math.max(teammates.length - VISIBLE_STACK, 0);
  const rowsToShow = expanded ? teammates : teammates.slice(0, VISIBLE_ROWS);
  const hiddenRowsCount = teammates.length - rowsToShow.length;

  if (teammates.length === 0) {
    return (
      <div className="pt-3 border-t border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Briefcase className="w-3 h-3" />
          Team &middot; 0 members
        </p>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Briefcase className="w-3 h-3" />
          Team &middot; {teammates.length}
        </p>
        <div className="flex -space-x-2">
          {teammates.slice(0, VISIBLE_STACK).map((person) => (
            <div key={person.id} className="ring-2 ring-white rounded-full">
              <UserAvatar user={person} size="xs" />
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="w-5 h-5 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-slate-500">
              +{overflowCount}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {rowsToShow.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            onMessage={onMessage}
            showActions={person.is_active !== false}
          />
        ))}
      </div>

      {teammates.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer pt-1"
        >
          {expanded
            ? 'Show less'
            : `+${hiddenRowsCount} other member${hiddenRowsCount !== 1 ? 's' : ''}`}
          <ChevronDown
            className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      )}
    </div>
  );
}

function ManagerJobCardItem({
  job,
  onClick,
  onOpenKanban,
  onOpenEditDrawer,
  onOpenStatusModal,
  onMessage,
}) {
  const clientName = job.client?.client_name || job.client_name;
  const isClientInactive = job.client?.is_active === false || job.job_client_is_active === false;

  // Chuẩn hóa dữ liệu Tiến độ
  const taskCounts = job.task_counts || {};
  const totalTasks = taskCounts.total_tasks ?? 0;
  const completedTasks = taskCounts.completed_count ?? 0;
  const todoTasks = taskCounts.todo_count ?? 0;
  const inProgressTasks = taskCounts.in_progress_count ?? 0;
  const reviewingTasks = taskCounts.reviewing_count ?? 0;
  const cancelledTasks = taskCounts.cancelled_count ?? 0;

  const progressData = {
    total: totalTasks,
    completed: completedTasks,
    todo: todoTasks,
    in_progress: inProgressTasks,
    reviewing: reviewingTasks,
    cancelled: cancelledTasks,
    pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };

  const teammates = job.project_team || [];

  return (
    <div
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all space-y-4 relative group cursor-pointer flex flex-col justify-between"
    >
      {/* 🌟 Header: Code, Priority, Status */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {job.job_code || `JOB-${job.id}`}
            </span>
            <JobPriorityBadge priority={job.priority} />
            {job.is_overdue && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                OVERDUE
              </span>
            )}
            {isClientInactive && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                title="Client is deactivated by admin"
              >
                <PauseCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                Client Inactive
              </span>
            )}
          </div>
          <JobStatusBadge status={job.status} />
        </div>

        {/* Job Title & Client */}
        <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
          {job.job_name}
        </h3>
        {clientName && (
          <p className="text-xs text-slate-400 font-medium truncate">Client: {clientName}</p>
        )}
      </div>

      {/* 📊 Tiến độ dự án */}
      <ProgressSection progress={progressData} />

      {/* 👤 Khối Quản lý (Managed by) */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Managed by
        </p>
        <PersonRow person={job.manager} onMessage={onMessage} showActions={true} isManager={true} />
      </div>

      {/* 👥 Khối Đội ngũ nhân sự (Team) */}
      <TeamSection teammates={teammates} onMessage={onMessage} />

      {/* 📅 Footer Thời gian & Hạn chót */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <span>Updated {formatUpdatedAtSafe(job.updated_at || job.created_at)}</span>
        {job.deadline && <span>Due {formatDeadlineSafe(job.deadline)}</span>}
      </div>

      {/* ⚡ Thanh công cụ nhanh của Manager */}
      <div
        className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => onOpenKanban(job, e)}
          className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition cursor-pointer"
          title="Open Kanban Board"
        >
          <Kanban className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => onOpenEditDrawer(job, e)}
          disabled={isClientInactive}
          className={cn(
            'p-1.5 rounded-lg transition cursor-pointer',
            isClientInactive
              ? 'text-slate-300 cursor-not-allowed'
              : 'hover:bg-slate-100 hover:text-slate-800 text-slate-400'
          )}
          title={
            isClientInactive
              ? 'Client is deactivated by Admin. Project editing locked.'
              : 'Edit Project'
          }
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => onOpenStatusModal(job, e)}
          className="p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg text-slate-400 transition cursor-pointer"
          title="Change Status"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function JobsGridView({
  jobs = [],
  isLoading = false,
  totalCount = 0,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  onJobClick,
  onOpenKanban,
  onOpenEditDrawer,
  onOpenStatusModal,
  onMessage,
  onResetFilters,
}) {
  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-80 bg-slate-100 rounded-2xl animate-pulse border border-slate-200/60"
            />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No projects matched your active filters or search criteria. Try resetting filters or create a new job.
          </p>
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <ManagerJobCardItem
              key={job.id}
              job={job}
              onClick={() => onJobClick?.(job)}
              onOpenKanban={onOpenKanban}
              onOpenEditDrawer={onOpenEditDrawer}
              onOpenStatusModal={onOpenStatusModal}
              onMessage={onMessage}
            />
          ))}
        </div>
      )}

      <PaginationBar
        currentPage={currentPage}
        totalPages={Math.ceil(totalCount / pageSize) || 1}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
