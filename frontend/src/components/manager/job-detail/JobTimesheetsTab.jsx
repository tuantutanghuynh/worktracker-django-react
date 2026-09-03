import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import DataTable from "../../common/table/DataTable";
import UserAvatar from "../../common/avatar/UserAvatar";
import { cn } from "../../../utils/cn";

function formatDateSafe(dateStr) {
  if (!dateStr) return "N/A";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

export default function JobTimesheetsTab({
  jobId,
  timesheetsList = [],
  timesheetsMetrics = { totalHours: "0.0", approvedHours: "0.0", pendingHours: "0.0" },
  timesheetsLoading = false,
}) {
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = timesheetsList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const paginatedTimesheets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return timesheetsList.slice(start, start + pageSize);
  }, [timesheetsList, currentPage, pageSize]);

  const timesheetColumns = [
    {
      header: "Date",
      accessorKey: "work_date",
      cell: (row) => <span className='font-semibold text-xs text-slate-800 font-mono'>{formatDateSafe(row.work_date)}</span>,
    },
    {
      header: "Employee",
      accessorKey: "user_full_name",
      cell: (row) => {
        const empName = row.user?.full_name || row.user_full_name || row.user?.email || row.user_email || "Employee";
        const empEmail = row.user?.email || row.user_email || "";
        const empAvatar = row.user?.avatar_url || row.user_avatar_url;
        return (
          <div className='flex items-center gap-2 text-xs font-semibold text-slate-800'>
            <UserAvatar src={empAvatar} fullName={empName} size='xs' className='w-6 h-6 shrink-0' />
            <div className='truncate max-w-[140px]'>
              <p className='font-bold text-slate-900 truncate' title={empName}>
                {empName}
              </p>
              {empEmail && empEmail !== empName && (
                <p className='text-[10px] text-slate-400 font-normal truncate' title={empEmail}>
                  {empEmail}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Task Code & Title",
      accessorKey: "task_title",
      cell: (row) => {
        const taskCode = row.task?.code || row.task_code || (row.task?.id ? `#${row.task.id}` : "");
        const taskTitle = row.task?.title || row.task_title || "Untitled Task";
        return (
          <div className='flex items-center gap-2 max-w-[200px]'>
            {taskCode && (
              <span className='font-mono font-bold text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 shrink-0'>{taskCode}</span>
            )}
            <span className='text-xs text-slate-700 font-medium truncate' title={taskTitle}>
              {taskTitle}
            </span>
          </div>
        );
      },
    },
    {
      header: "Hours",
      accessorKey: "hours_spent",
      cell: (row) => <span className='font-extrabold text-xs text-slate-900 font-mono'>{parseFloat(row.hours_spent).toFixed(1)} hrs</span>,
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: (row) => (
        <p className='text-xs text-slate-600 truncate max-w-[240px]' title={row.description}>
          {row.description || "No work details provided."}
        </p>
      ),
    },
    {
      header: "Status",
      accessorKey: "review_status",
      cell: (row) => {
        const config = {
          APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
          PENDING: "bg-amber-50 text-amber-700 border-amber-200",
          REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
        };
        return (
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider",
              config[row.review_status] || "bg-slate-100 text-slate-700",
            )}>
            {row.review_status}
          </span>
        );
      },
    },
  ];

  return (
    <div className='space-y-4'>
      {/* Summary KPI Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <div className='bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1'>
          <div className='flex items-center justify-between text-xs font-bold text-slate-600'>
            <span>Total Logged Hours</span>
            <Clock className='w-4 h-4 text-blue-600' />
          </div>
          <div className='text-2xl font-extrabold text-slate-900 font-mono'>
            {timesheetsMetrics.totalHours} <span className='text-xs font-normal text-slate-400'>hrs</span>
          </div>
        </div>

        <div className='bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1'>
          <div className='flex items-center justify-between text-xs font-bold text-emerald-700'>
            <span>Approved Hours</span>
            <CheckCircle2 className='w-4 h-4 text-emerald-600' />
          </div>
          <div className='text-2xl font-extrabold text-emerald-600 font-mono'>
            {timesheetsMetrics.approvedHours} <span className='text-xs font-normal text-slate-400'>hrs</span>
          </div>
        </div>

        <div className='bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1'>
          <div className='flex items-center justify-between text-xs font-bold text-amber-700'>
            <span>Pending Review</span>
            <AlertCircle className='w-4 h-4 text-amber-600' />
          </div>
          <div className='text-2xl font-extrabold text-amber-600 font-mono'>
            {timesheetsMetrics.pendingHours} <span className='text-xs font-normal text-slate-400'>hrs</span>
          </div>
        </div>
      </div>

      {/* Work Logs Table */}
      <div className='bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden'>
        <div className='p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2'>
          <div>
            <h4 className='text-sm font-bold text-slate-900'>Project Work Logs & Timesheets</h4>
            <p className='text-xs text-slate-500'>All submitted work hours logged by project team members for this job.</p>
          </div>
        </div>

        <DataTable
          columns={timesheetColumns}
          data={paginatedTimesheets}
          isLoading={timesheetsLoading}
          emptyMessage='No work logs have been submitted for this project yet.'
          pagination={{
            currentPage,
            totalPages,
            totalItems,
            pageSize,
            pageSizeOptions: [10, 25, 50],
            onPageChange: setCurrentPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setCurrentPage(1);
            },
          }}
        />
      </div>
    </div>
  );
}
