import React from 'react';
import SelectDropdown from '../../common/forms/SelectDropdown';
import { cn } from '../../../utils/cn';

/**
 * ReportFilterToolbar - Thanh Tabs loại báo cáo và bộ lọc 5 tiêu chí
 * 
 * Props:
 * - reportType: 'TASK_SUMMARY' | 'TIMESHEET_DETAIL'
 * - setReportType: (type: string) => void
 * - selectedJobId: string
 * - setSelectedJobId: (id: string) => void
 * - jobOptions: Array<{ value: string, label: string }>
 * - selectedEmployeeId: string
 * - setSelectedEmployeeId: (id: string) => void
 * - employeeOptions: Array<{ value: string, label: string }>
 * - selectedStatus: string
 * - setSelectedStatus: (status: string) => void
 * - dateFrom: string
 * - setDateFrom: (date: string) => void
 * - dateTo: string
 * - setDateTo: (date: string) => void
 */
export default function ReportFilterToolbar({
  reportType,
  setReportType,
  selectedJobId,
  setSelectedJobId,
  jobOptions = [],
  selectedEmployeeId,
  setSelectedEmployeeId,
  employeeOptions = [],
  selectedStatus,
  setSelectedStatus,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) {
  return (
    <div className="space-y-3">
      {/* 🧭 REPORT TYPE TABS */}
      <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs max-w-md">
        <button
          type="button"
          onClick={() => setReportType('TASK_SUMMARY')}
          className={cn(
            'flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer',
            reportType === 'TASK_SUMMARY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          Task Delivery Summary
        </button>
        <button
          type="button"
          onClick={() => setReportType('TIMESHEET_DETAIL')}
          className={cn(
            'flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer',
            reportType === 'TIMESHEET_DETAIL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          Detailed Timesheet Effort
        </button>
      </div>

      {/* 🔍 FILTER TOOLBAR */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Project</label>
          <SelectDropdown
            value={selectedJobId}
            onChange={(val) => setSelectedJobId(val)}
            options={[{ value: '', label: 'All Projects' }, ...jobOptions]}
            placeholder="Select project..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">
            {reportType === 'TASK_SUMMARY' ? 'Assignee' : 'Employee'}
          </label>
          <SelectDropdown
            value={selectedEmployeeId}
            onChange={(val) => setSelectedEmployeeId(val)}
            options={[{ value: '', label: 'All Personnel' }, ...employeeOptions]}
            placeholder="Select personnel..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            {reportType === 'TASK_SUMMARY' ? (
              <>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEWING">Reviewing (QA)</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </>
            ) : (
              <>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="VOIDED">Voided</option>
              </>
            )}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">
            {reportType === 'TASK_SUMMARY' ? 'Deadline From' : 'Work Date From'}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">
            {reportType === 'TASK_SUMMARY' ? 'Deadline To' : 'Work Date To'}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
