import React, { useState, useMemo } from 'react';
import PaginationBar from '../../common/table/PaginationBar';
import UserAvatar from '../../common/avatar/UserAvatar';

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
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={member.avatar_url}
                    fullName={member.name}
                    size="md"
                    className="w-10 h-10 rounded-xl shrink-0"
                  />
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{member.name}</h4>
                    <p className="text-xs text-slate-500">{member.email || 'Unassigned queue'}</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                  {member.tasks.length} {member.tasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </div>

              <div className="space-y-1.5 pt-2.5 border-t border-slate-100 text-xs">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Assigned Deliverables:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {member.tasks.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No tasks currently assigned</p>
                  ) : (
                    member.tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTaskDrawer(t.id)}
                        className="p-2 bg-slate-50 hover:bg-blue-50/70 rounded-xl border border-slate-100 flex items-center justify-between cursor-pointer transition"
                      >
                        <span className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">
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
