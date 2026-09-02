import React from 'react';
import {
  Building2,
  Calendar,
  AlertCircle,
  Eye,
  Edit3,
  Kanban,
  ArrowRightLeft,
  Flame,
  Users,
  PauseCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import DataTable from '../../common/table/DataTable';
import PaginationBar from '../../common/table/PaginationBar';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr) {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
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

  const current = configs[status] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' };

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase shrink-0', current.bg)}>
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
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
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

export default function JobsTableView({
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
}) {
  const columns = [
    {
      header: 'Project & Client',
      accessorKey: 'job_name',
      cell: (row) => {
        const isOverdue = row.is_overdue;
        const isClientInactive = row.client && row.client.is_active === false;
        const clientName = row.client?.client_name || row.client_name || 'Internal';

        return (
          <div className="py-0.5 space-y-1 min-w-[220px] max-w-[340px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/80 shrink-0">
                {row.job_code || `JOB-${row.id}`}
              </span>
              <span
                className="font-bold text-slate-900 text-xs hover:text-blue-600 transition-colors cursor-pointer truncate"
                onClick={() => onJobClick(row)}
                title={row.job_name}
              >
                {row.job_name}
              </span>
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                  <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                  OVERDUE
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium truncate">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate max-w-[160px]" title={clientName}>
                {clientName}
              </span>
              {isClientInactive && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 shrink-0">
                  <PauseCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                  Inactive
                </span>
              )}
              {row.description && (
                <>
                  <span className="text-slate-300 shrink-0">•</span>
                  <span className="text-slate-400 line-clamp-1 truncate" title={row.description}>
                    {row.description}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => {
        const isClientInactive = row.client && row.client.is_active === false;
        if (isClientInactive) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
              <PauseCircle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Frozen (On Hold)</span>
            </span>
          );
        }
        return <JobStatusBadge status={row.status} />;
      },
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (row) => <JobPriorityBadge priority={row.priority} />,
    },
    {
      header: 'Team',
      accessorKey: 'team_size',
      cell: (row) => (
        <span
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
          title={`${row.team_size || 0} assigned project team members`}
        >
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.team_size || 0}</span>
        </span>
      ),
    },
    {
      header: 'Progress',
      accessorKey: 'task_counts',
      cell: (row) => {
        const counts = row.task_counts || {};
        const total = counts.total_tasks || 0;
        const completed = counts.completed_count || 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
          <div className="w-28 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
              <span>{completed}/{total} Tasks</span>
              <span className={cn("font-bold text-[10px]", pct === 100 ? "text-emerald-600" : "text-blue-600")}>
                {pct}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  pct === 100 ? "bg-emerald-500" : "bg-blue-600"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Deadline',
      accessorKey: 'deadline',
      cell: (row) => {
        const isOverdue = row.is_overdue;
        return (
          <div className="space-y-0.5 text-xs">
            <div className={cn("flex items-center gap-1 font-semibold", isOverdue ? "text-rose-600" : "text-slate-700")}>
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatDateSafe(row.deadline)}</span>
            </div>
            {row.start_date && (
              <div className="text-[10px] text-slate-400">
                Start: {formatDateSafe(row.start_date)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onJobClick(row)}
            className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => onOpenKanban(row, e)}
            className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Open Kanban Board"
          >
            <Kanban className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => onOpenEditDrawer(row, e)}
            disabled={row.client && row.client.is_active === false}
            className={cn(
              "p-1.5 rounded-lg transition-colors cursor-pointer",
              row.client && row.client.is_active === false
                ? "text-slate-300 cursor-not-allowed"
                : "hover:bg-slate-100 hover:text-slate-900 text-slate-400 hover:text-slate-600"
            )}
            title={row.client && row.client.is_active === false ? "Client is deactivated by Admin. Project editing locked." : "Edit Project"}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => onOpenStatusModal(row, e)}
            disabled={row.client && row.client.is_active === false}
            className={cn(
              "p-1.5 rounded-lg transition-colors cursor-pointer",
              row.client && row.client.is_active === false
                ? "text-slate-300 cursor-not-allowed"
                : "hover:bg-amber-50 hover:text-amber-600 text-slate-400 hover:text-slate-600"
            )}
            title={row.client && row.client.is_active === false ? "Client is deactivated by Admin. Status change locked." : "Change Status"}
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <DataTable
        columns={columns}
        data={jobs}
        isLoading={isLoading}
        onRowClick={onJobClick}
        emptyMessage="No projects found matching your filter criteria."
      />
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
