import React, { useState, useMemo, useEffect } from "react";
import { Search, X, Award, AlertTriangle, Paperclip, PauseCircle } from "lucide-react";
import UserAvatar from "../../common/avatar/UserAvatar";
import PaginationBar from "../../common/table/PaginationBar";
import { cn } from "../../../utils/cn";

export default function TaskReviewQueueList({
  tasks = [],
  selectedTaskId,
  onSelectTask,
  isLoading = false,
  searchQuery,
  onSearchChange,
  selectedJobId,
  onJobChange,
  jobOptions = [],
  selectedDate,
  onDateChange,
  onResetFilters,
  reviewTab = "REVIEWING",
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedJobId, selectedDate, reviewTab]);

  const totalItems = tasks.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  }, [tasks, currentPage, pageSize]);

  return (
    <section className="w-[56%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
      {/* Filter Toolbar - ALWAYS VISIBLE */}
      <div className="p-2.5 border-b border-slate-200 bg-white space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          {/* 1. Search Bar (Compact) */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search task, code, staff..."
              className="w-full pl-7.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Project Filter Select */}
          <select
            value={selectedJobId}
            onChange={(e) => onJobChange(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 w-[140px] shrink-0 truncate focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            {jobOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 3. Submission Date Filter */}
          <div className="relative w-[135px] shrink-0">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              title="Filter by Submission / Update Date"
              className={cn(
                "w-full px-2 py-1.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer transition",
                selectedDate ? "border-purple-300 bg-purple-50/50 text-purple-900 font-bold" : "border-slate-200",
              )}
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => onDateChange("")}
                className="absolute right-6 top-2 text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                title="Clear date filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 4. Reset Button */}
          {(searchQuery.trim() || selectedJobId || selectedDate) && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs shrink-0 cursor-pointer transition"
              title="Clear All Filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* MASTER TABLE / EMPTY STATES */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-7 h-7 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-2xs">
              {searchQuery || selectedJobId ? <Search className="w-6 h-6" /> : <Award className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-slate-900">
                {searchQuery || selectedJobId ? "No Matching Tasks Found" : "No Tasks in This Category"}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                {searchQuery || selectedJobId
                  ? `No deliverables matched your filter criteria.`
                  : `There are currently no tasks in the '${reviewTab}' review tab.`}
              </p>
            </div>
            {(searchQuery || selectedJobId) && (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
              >
                Clear Search Filters
              </button>
            )}
          </div>
        ) : (
          <table
            className={cn(
              "w-full text-left text-sm table-fixed",
              paginatedTasks.length >= 8 && "h-full"
            )}
          >
            <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-2 px-3 w-[40%]">TASK TITLE &amp; AUDIT</th>
                <th className="py-2 px-2.5 w-[24%]">ASSIGNEE</th>
                <th className="py-2 px-2 text-center w-[18%]">DELIVERABLES</th>
                <th className="py-2 px-3 text-center w-[18%]">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedTasks.map((task) => {
                const isSelected = String(task.id) === String(selectedTaskId);
                const taskCode = task.code || `TSK-${task.id}`;
                const empName = task.assignee?.full_name || task.assignee_name || "Unassigned";
                const parentJob = task.job?.job_name || task.job_title || "Project Job";
                const filesCount = task.attachment_count ?? task.attachments_count ?? task.attachments?.length ?? 0;
                const rejectionCount = task.rejection_count || 0;
                const taskJobFrozen = task.status === "REVIEWING" && task.job?.status && task.job?.status !== "ACTIVE";

                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected
                        ? "bg-purple-50/80 border-l-4 border-purple-600 hover:bg-purple-50"
                        : "hover:bg-slate-50 border-l-4 border-transparent",
                    )}
                  >
                    <td className="py-1.5 px-3 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-purple-700 text-xs shrink-0">{taskCode}</span>
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{task.title}</span>
                        {rejectionCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-extrabold"
                            title={`This deliverable has been rejected ${rejectionCount} time(s)`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                            <span>{rejectionCount}x Rejected</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{parentJob}</p>
                    </td>
                    <td className="py-1.5 px-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar avatarUrl={task.assignee?.avatar_url || task.assignee_avatar} fullName={empName} size="xs" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate">{empName}</p>
                          <p className="text-[10px] text-slate-400 truncate">Staff</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[11px]">
                        <Paperclip className="w-3 h-3 text-purple-600" />
                        <span>
                          {filesCount} File{filesCount !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {taskJobFrozen ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[9px] font-extrabold uppercase whitespace-nowrap">
                          <PauseCircle className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                          <span>FROZEN ({task.job.status})</span>
                        </span>
                      ) : task.status === "REVIEWING" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                          PENDING QA
                        </span>
                      ) : task.status === "COMPLETED" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                          APPROVED
                        </span>
                      ) : task.status === "IN_PROGRESS" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                          IN REWORK
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                          {task.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      {totalItems > 0 && (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          className="border-t border-slate-200 shrink-0 py-2"
        />
      )}
    </section>
  );
}
