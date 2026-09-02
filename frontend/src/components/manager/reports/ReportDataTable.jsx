import React from 'react';
import DataTable from '../../common/table/DataTable';
import { cn } from '../../../utils/cn';

export default function ReportDataTable({
  reportType = 'TASK_SUMMARY',
  paginatedRows = [],
  previewRows = [],
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
}) {
  // Cấu hình Cột Bảng Task Summary
  const taskColumns = [
    {
      header: 'Task Code & Title',
      accessorKey: 'title',
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
              {row.task_code || `TSK-${row.id}`}
            </span>
            <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]" title={row.title}>
              {row.title}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {row.job?.job_code ? `${row.job.job_code}: ${row.job.job_name}` : 'Project'}
          </p>
        </div>
      ),
    },
    {
      header: 'Assignee',
      accessorKey: 'assignee',
      cell: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.assignee?.full_name || row.assignee?.email || 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (row) => {
        const pColors = {
          URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
          HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
          MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
          LOW: 'bg-slate-50 text-slate-700 border-slate-200',
        };
        return (
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider', pColors[row.priority] || pColors.LOW)}>
            {row.priority || 'NORMAL'}
          </span>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => {
        const config = {
          TODO: 'bg-blue-50 text-blue-700 border-blue-200',
          IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          REVIEWING: 'bg-purple-50 text-purple-700 border-purple-200',
          COMPLETED: 'bg-amber-50 text-amber-700 border-amber-200',
          CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
        };
        return (
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
              config[row.status] || 'bg-slate-100 text-slate-700'
            )}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      header: 'Deadline',
      accessorKey: 'deadline',
      cell: (row) => (
        <span className="text-xs font-mono font-medium text-slate-600">
          {row.deadline || 'No deadline'}
        </span>
      ),
    },
  ];

  // Cấu hình Cột Bảng Timesheet Effort
  const timesheetColumns = [
    {
      header: 'Employee',
      accessorKey: 'user',
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-900">{row.user?.full_name || row.user?.email || 'Staff'}</p>
          <p className="text-[10px] text-slate-400">{row.user?.department?.name || 'Software Dept'}</p>
        </div>
      ),
    },
    {
      header: 'Project & Task',
      accessorKey: 'task',
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-800 truncate max-w-[200px]" title={row.task?.title}>
            {row.task?.title || 'Deliverable'}
          </p>
          <span className="text-[10px] text-blue-600 font-mono font-bold">
            {row.job?.job_code || `JOB-${row.job?.id}`}
          </span>
        </div>
      ),
    },
    {
      header: 'Work Date',
      accessorKey: 'work_date',
      cell: (row) => <span className="text-xs font-mono font-semibold text-slate-700">{row.work_date}</span>,
    },
    {
      header: 'Logged Effort',
      accessorKey: 'hours_spent',
      cell: (row) => (
        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
          {parseFloat(row.hours_spent || 0).toFixed(1)} hrs
        </span>
      ),
    },
    {
      header: 'Review Status',
      accessorKey: 'review_status',
      cell: (row) => (
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
            row.review_status === 'APPROVED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
            row.review_status === 'PENDING' && 'bg-amber-50 text-amber-700 border-amber-200',
            row.review_status === 'REJECTED' && 'bg-rose-50 text-rose-700 border-rose-200',
            row.review_status === 'VOIDED' && 'bg-slate-100 text-slate-500 border-slate-300'
          )}
        >
          {row.review_status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">
          {reportType === 'TASK_SUMMARY' ? 'Task Delivery Dataset' : 'Work Log Detailed Records'} ({previewRows.length} total)
        </h2>
      </div>

      <DataTable
        columns={reportType === 'TASK_SUMMARY' ? taskColumns : timesheetColumns}
        data={paginatedRows}
        isLoading={isLoading}
        emptyMessage="No report records found matching your filter criteria."
        pagination={{
          currentPage,
          totalPages,
          totalItems,
          pageSize,
          pageSizeOptions: [10, 25, 50, 100],
          onPageChange,
          onPageSizeChange,
        }}
      />
    </div>
  );
}
