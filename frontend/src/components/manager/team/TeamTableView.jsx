import React from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import DataTable from '../../common/table/DataTable';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

export default function TeamTableView({
  employees = [],
  isLoading = false,
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  onSelectMember,
}) {
  const columns = [
    {
      header: 'Employee',
      accessorKey: 'full_name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <UserAvatar user={row} size="sm" showStatus={true} isOnline={true} />
          <div className="min-w-0">
            <p className="font-bold text-xs text-slate-900 truncate">{row.full_name || row.email}</p>
            <p className="text-[10px] text-slate-400 truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      accessorKey: 'departmentName',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-slate-700">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{row.departmentName}</span>
          </div>
          <p className="text-[10px] text-slate-400">{row.role || 'EMPLOYEE'}</p>
        </div>
      ),
    },
    {
      header: 'Active Tasks',
      accessorKey: 'activeTasks',
      cell: (row) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
          {row.activeTasks} Tasks
        </span>
      ),
    },
    {
      header: 'Active Jobs',
      accessorKey: 'activeJobs',
      cell: (row) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
          {row.activeJobs} Jobs
        </span>
      ),
    },
    {
      header: 'Capacity Pressure',
      accessorKey: 'capacityPct',
      cell: (row) => (
        <div className="w-44 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span
              className={cn(
                row.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                row.workloadStatus === 'BALANCED' && 'text-amber-600',
                row.workloadStatus === 'AVAILABLE' && 'text-emerald-600'
              )}
            >
              {row.capacityPct}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">
              ~{row.dailyRequiredHours}h / day
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                row.workloadStatus === 'OVERLOADED' && 'bg-rose-500',
                row.workloadStatus === 'BALANCED' && 'bg-amber-500',
                row.workloadStatus === 'AVAILABLE' && 'bg-emerald-500'
              )}
              style={{ width: `${Math.min(row.capacityPct, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'workloadStatus',
      cell: (row) => {
        const config = {
          OVERLOADED: 'bg-rose-50 text-rose-700 border-rose-200',
          BALANCED: 'bg-amber-50 text-amber-700 border-amber-200',
          AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        }[row.workloadStatus] || 'bg-slate-100 text-slate-700 border-slate-200';

        return (
          <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider', config)}>
            {row.workloadStatus}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onSelectMember(row)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
            title="View Member Details"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={employees}
      isLoading={isLoading}
      emptyMessage="No team members matching the selected filters."
      onRowClick={onSelectMember}
      pagination={{
        currentPage,
        totalPages,
        totalItems,
        pageSize,
        onPageChange,
        onPageSizeChange,
      }}
    />
  );
}
