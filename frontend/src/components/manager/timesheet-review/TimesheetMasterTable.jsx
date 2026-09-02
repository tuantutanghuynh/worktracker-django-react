import React from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr, pattern = 'dd MMM yyyy') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function TimesheetMasterTable({
  filteredDays = [],
  selectedDayKey,
  onSelectDay,
  isLoading = false,
  searchQuery = '',
  onSearchChange,
  selectedJobId = '',
  onJobChange,
  jobOptions = [],
  selectedStatus = 'PENDING',
  onStatusChange,
}) {
  return (
    <section className="w-[48%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
      {/* Filter Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-white space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search employee, task, or project..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <select
            value={selectedJobId}
            onChange={(e) => onJobChange(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 max-w-[140px] truncate cursor-pointer"
          >
            {jobOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All Statuses</option>
          </select>
        </div>
      </div>

      {/* MASTER TABLE: 4 CLEAN COLUMNS (EMPLOYEE, WORK DATE, TOTAL HOURS, STATUS) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDays.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
            No timesheet logs found for this filter.
          </div>
        ) : (
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-2.5 px-3.5 w-[36%]">EMPLOYEE</th>
                <th className="py-2.5 px-3 w-[28%]">WORK DATE</th>
                <th className="py-2.5 px-2 w-[18%] text-center">TOTAL HOURS</th>
                <th className="py-2.5 px-3 w-[18%] text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredDays.map((dayGroup) => {
                const isSelected = dayGroup.key === selectedDayKey;
                const overallStatus = dayGroup.hasPending
                  ? 'PENDING'
                  : dayGroup.hasRejected
                  ? 'REJECTED'
                  : 'APPROVED';

                return (
                  <tr
                    key={dayGroup.key}
                    onClick={() => onSelectDay(dayGroup.key)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-blue-50/90 border-l-4 border-blue-600 hover:bg-blue-50'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    )}
                  >
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          avatarUrl={dayGroup.user?.avatar_url || dayGroup.user?.employee_profile?.avatar_url}
                          fullName={dayGroup.employeeName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 text-xs truncate">{dayGroup.employeeName}</p>
                          <p className="text-[10px] text-slate-500 truncate font-medium">
                            {dayGroup.items.length} Task{dayGroup.items.length !== 1 ? 's' : ''} Logged
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                      {formatDateSafe(dayGroup.work_date)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-mono font-extrabold text-xs shadow-2xs">
                        {dayGroup.total_hours.toFixed(1)} hrs
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap',
                          overallStatus === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : overallStatus === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        )}
                      >
                        {overallStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Table Footer */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        <span>Showing {filteredDays.length} daily timesheet records</span>
        <span className="font-semibold text-slate-700">Click any row to inspect</span>
      </div>
    </section>
  );
}
