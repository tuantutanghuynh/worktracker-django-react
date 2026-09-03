import React, { useState, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import PaginationBar from '../../common/table/PaginationBar';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

export default function JobTeamTab({ groupedTeamMembers = [], openTaskDrawer }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const totalItems = groupedTeamMembers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const paginatedTeamMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groupedTeamMembers.slice(start, start + pageSize);
  }, [groupedTeamMembers, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Project Personnel & Assigned Tasks</h3>
          <p className="text-xs text-slate-500">
            Summary of task assignments and workload distribution across project members.
          </p>
        </div>
      </div>

      {totalItems === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-sm font-semibold text-slate-500">No personnel currently allocated to this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedTeamMembers.map((member, idx) => (
            <div
              key={member.id || `unassigned-${idx}`}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all space-y-3.5 flex flex-col justify-between"
            >
              {/* Card Header: Avatar, Name, Email, Department */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    src={member.avatar_url}
                    fullName={member.name}
                    size="md"
                    showStatus={true}
                    isOnline={true}
                  />
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-slate-900 truncate">
                      {member.name}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">{member.email || 'Unassigned queue'}</p>
                    {member.department_name && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{member.department_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Workload Progress Bar */}
              {member.id && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Workload Capacity:</span>
                    <span
                      className={cn(
                        member.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                        member.workloadStatus === 'BALANCED' && 'text-amber-600',
                        member.workloadStatus === 'AVAILABLE' && 'text-emerald-600'
                      )}
                    >
                      {member.capacityPct}% (~{member.dailyRequiredHours}h/day)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        member.workloadStatus === 'OVERLOADED' && 'bg-rose-500',
                        member.workloadStatus === 'BALANCED' && 'bg-amber-500',
                        member.workloadStatus === 'AVAILABLE' && 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(member.capacityPct || 0, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Workload Status & Stats */}
              {member.id && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-[11px]">
                    <span>{member.activeTasks || member.tasks.length} Tasks</span>
                    <span className="text-slate-300">|</span>
                    <span>{member.activeJobs || 0} Jobs</span>
                  </div>

                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
                      member.workloadStatus === 'OVERLOADED' && 'bg-rose-50 text-rose-700 border-rose-200',
                      member.workloadStatus === 'BALANCED' && 'bg-amber-50 text-amber-700 border-amber-200',
                      member.workloadStatus === 'AVAILABLE' && 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    )}
                  >
                    {member.workloadStatus || 'AVAILABLE'}
                  </span>
                </div>
              )}

              {/* Assigned Deliverables for this Job */}
              <div className="space-y-1.5 pt-2.5 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Assigned Deliverables ({member.tasks.length}):
                  </p>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {member.tasks.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No tasks currently assigned</p>
                  ) : (
                    member.tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTaskDrawer(t.id)}
                        className="p-2 bg-slate-50 hover:bg-blue-50/70 rounded-xl border border-slate-100 flex items-center justify-between cursor-pointer transition"
                      >
                        <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">
                          {t.title}
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-600 uppercase bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 📄 Pagination Bar */}
      {totalItems > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs">
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            pageSizeOptions={[6, 12, 24]}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
