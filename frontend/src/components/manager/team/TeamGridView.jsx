import React from 'react';
import { Building2 } from 'lucide-react';
import UserAvatar from '../../common/avatar/UserAvatar';
import PaginationBar from '../../common/table/PaginationBar';
import { cn } from '../../../utils/cn';

export default function TeamGridView({
  employees = [],
  onSelectMember,
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <div
            key={`emp-card-${emp.id || emp.user_id}`}
            onClick={() => onSelectMember(emp)}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all space-y-4 relative group cursor-pointer"
          >
            {/* Card Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar user={emp} size="md" showStatus={true} isOnline={true} />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition truncate">
                    {emp.full_name || emp.email}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{emp.departmentName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Workload Progress Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Workload Capacity:</span>
                <span
                  className={cn(
                    emp.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                    emp.workloadStatus === 'BALANCED' && 'text-amber-600',
                    emp.workloadStatus === 'AVAILABLE' && 'text-emerald-600'
                  )}
                >
                  {emp.capacityPct}% (~{emp.dailyRequiredHours}h/day)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    emp.workloadStatus === 'OVERLOADED' && 'bg-rose-500',
                    emp.workloadStatus === 'BALANCED' && 'bg-amber-500',
                    emp.workloadStatus === 'AVAILABLE' && 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(emp.capacityPct, 100)}%` }}
                />
              </div>
            </div>

            {/* Card Footer: Active Tasks & Jobs count & Status */}
            <div className="flex items-center justify-between pt-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-[11px]">
                <span>{emp.activeTasks} Tasks</span>
                <span className="text-slate-300">|</span>
                <span>{emp.activeJobs} Jobs</span>
              </div>

              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
                  emp.workloadStatus === 'OVERLOADED' && 'bg-rose-50 text-rose-700 border-rose-200',
                  emp.workloadStatus === 'BALANCED' && 'bg-amber-50 text-amber-700 border-amber-200',
                  emp.workloadStatus === 'AVAILABLE' && 'bg-emerald-50 text-emerald-700 border-emerald-200'
                )}
              >
                {emp.workloadStatus}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Phân trang cho Grid View */}
      {totalPages > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs">
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
