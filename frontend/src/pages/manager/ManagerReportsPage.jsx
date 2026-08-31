import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import { cn } from '../../utils/cn';

// Modular Sub-Components
import ReportFilterToolbar from '../../components/manager/reports/ReportFilterToolbar';
import TaskSummaryAnalyticsView from '../../components/manager/reports/TaskSummaryAnalyticsView';
import TimesheetDetailAnalyticsView from '../../components/manager/reports/TimesheetDetailAnalyticsView';

import managerReportService from '../../services/manager/managerReportService';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';

const PIE_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];
const PRIORITY_COLORS = {
  URGENT: '#EF4444',
  HIGH: '#F97316',
  MEDIUM: '#3B82F6',
  LOW: '#64748B',
};

export default function ManagerReportsPage() {
  // Tabs: 'TASK_SUMMARY' | 'TIMESHEET_DETAIL'
  const [reportType, setReportType] = useState('TASK_SUMMARY');

  // Filter States
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 🚀 TANSTACK REACT QUERY
  const { data: jobsResponse } = useManagerJobs({ page_size: 50 });
  const { data: employeesResponse } = useManagerEmployees();

  // Nạp dữ liệu báo cáo Task Summary từ Backend
  const {
    data: taskReportData,
    isLoading: loadingTasks,
    isFetching: fetchingTasks,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['manager-reports', 'task-summary', selectedJobId, selectedEmployeeId, selectedStatus, dateFrom, dateTo],
    queryFn: () =>
      managerReportService.getTaskSummaryReport({
        job_id: selectedJobId || undefined,
        assignee_id: selectedEmployeeId || undefined,
        status: selectedStatus || undefined,
        deadline_from: dateFrom || undefined,
        deadline_to: dateTo || undefined,
      }),
    enabled: reportType === 'TASK_SUMMARY',
  });

  // Nạp dữ liệu báo cáo Timesheet Detail từ Backend
  const {
    data: timesheetReportData,
    isLoading: loadingTimesheet,
    isFetching: fetchingTimesheet,
    refetch: refetchTimesheet,
  } = useQuery({
    queryKey: ['manager-reports', 'timesheet-detail', selectedJobId, selectedEmployeeId, selectedStatus, dateFrom, dateTo],
    queryFn: () =>
      managerReportService.getTimesheetDetailReport({
        job_id: selectedJobId || undefined,
        employee_id: selectedEmployeeId || undefined,
        review_status: selectedStatus || undefined,
        work_date_from: dateFrom || undefined,
        work_date_to: dateTo || undefined,
      }),
    enabled: reportType === 'TIMESHEET_DETAIL',
  });

  const isLoading = reportType === 'TASK_SUMMARY' ? loadingTasks : loadingTimesheet;
  const isFetching = reportType === 'TASK_SUMMARY' ? fetchingTasks : fetchingTimesheet;

  // Chuẩn hóa Options cho Dropdown
  const jobOptions = useMemo(() => {
    const list = Array.isArray(jobsResponse) ? jobsResponse : jobsResponse?.results || [];
    return list.map((j) => ({
      value: String(j.id),
      label: `${j.job_code || `JOB-${j.id}`}: ${j.job_name}`,
    }));
  }, [jobsResponse]);

  const employeeOptions = useMemo(() => {
    const list = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse?.results || [];
    return list.map((e) => ({
      value: String(e.user_id || e.id),
      label: `${e.full_name || e.email} (${e.department_name || 'Staff'})`,
    }));
  }, [employeesResponse]);

  // 📋 Chuẩn hóa Dữ liệu Rows từ Backend
  const previewRows = useMemo(() => {
    if (reportType === 'TASK_SUMMARY') {
      return taskReportData?.rows || [];
    }
    return timesheetReportData?.rows || [];
  }, [reportType, taskReportData, timesheetReportData]);

  // Reset page when reportType or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [reportType, selectedJobId, selectedEmployeeId, selectedStatus, dateFrom, dateTo]);

  // Phân trang dữ liệu xem trước
  const totalItems = previewRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return previewRows.slice(start, start + pageSize);
  }, [previewRows, currentPage, pageSize]);

  // 📊 Thống kê KPI tổng hợp từ Backend summary
  const kpis = useMemo(() => {
    if (reportType === 'TASK_SUMMARY') {
      const summary = taskReportData?.summary || {};
      const statusSum = summary.status_summary || {};
      const overdueSum = summary.overdue_summary || {};

      const totalTasks = summary.total_tasks ?? previewRows.length;
      const completed = statusSum.COMPLETED || 0;
      const inProgress = (statusSum.IN_PROGRESS || 0) + (statusSum.REVIEWING || 0);
      const overdueTasks = overdueSum.overdue_tasks || 0;
      const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

      return {
        totalTasks,
        completed,
        inProgress,
        overdueTasks,
        completionRate,
      };
    } else {
      const summary = timesheetReportData?.summary || {};
      const reviewSum = summary.review_status_summary || {};

      const totalLogs = summary.total_logs ?? previewRows.length;
      const totalHours = summary.total_hours || 0;

      // Tính chính xác số giờ và số lượt log theo từng trạng thái
      const approvedCount = typeof reviewSum.APPROVED === 'number'
        ? reviewSum.APPROVED
        : previewRows.filter((r) => r.review_status === 'APPROVED').length;

      const approvedHours = previewRows
        .filter((r) => r.review_status === 'APPROVED')
        .reduce((sum, r) => sum + parseFloat(r.hours_spent || 0), 0);

      const pendingCount = typeof reviewSum.PENDING === 'number'
        ? reviewSum.PENDING
        : previewRows.filter((r) => r.review_status === 'PENDING').length;

      const pendingHours = previewRows
        .filter((r) => r.review_status === 'PENDING')
        .reduce((sum, r) => sum + parseFloat(r.hours_spent || 0), 0);

      return {
        totalLogs,
        totalHours,
        approvedCount,
        approvedHours,
        pendingCount,
        pendingHours,
      };
    }
  }, [reportType, taskReportData, timesheetReportData, previewRows]);

  // 📈 Dữ liệu Biểu đồ Tròn Phân Bổ Trạng thái Task
  const chartStatusData = useMemo(() => {
    if (reportType !== 'TASK_SUMMARY') return [];
    const statusSum = taskReportData?.summary?.status_summary || {};
    return [
      { name: 'To Do', value: statusSum.TODO || 0, color: '#3B82F6' },
      { name: 'In Progress', value: statusSum.IN_PROGRESS || 0, color: '#10B981' },
      { name: 'Reviewing (QA)', value: statusSum.REVIEWING || 0, color: '#8B5CF6' },
      { name: 'Completed', value: statusSum.COMPLETED || 0, color: '#F59E0B' },
      { name: 'Cancelled', value: statusSum.CANCELLED || 0, color: '#EF4444' },
    ].filter((item) => item.value > 0);
  }, [reportType, taskReportData]);

  // 📈 Dữ liệu Biểu đồ Tròn Phân Bổ Giờ Theo Dự Án (cho Timesheet Detail)
  const chartTimesheetPieData = useMemo(() => {
    if (reportType !== 'TIMESHEET_DETAIL') return [];
    const jobSummary = timesheetReportData?.summary?.job_summary || [];
    return jobSummary.slice(0, 5).map((item, idx) => ({
      name: item.job_name || `Job #${item.job_id}`,
      value: parseFloat(item.total_hours || 0),
      color: PIE_COLORS[idx % PIE_COLORS.length],
    })).filter((item) => item.value > 0);
  }, [reportType, timesheetReportData]);

  // 📊 Dữ liệu Biểu đồ Cột Phân Bổ Giờ Theo Dự Án / Nhân viên
  const chartEffortData = useMemo(() => {
    if (reportType === 'TASK_SUMMARY') {
      const jobSummary = taskReportData?.summary?.job_summary || [];
      return jobSummary.slice(0, 6).map((item) => {
        const total = item.total_tasks || 0;
        const completed = item.completed_tasks || 0;
        const inProgress = Math.max(0, total - completed);
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          code: item.job_code || `JOB-${item.job_id}`,
          name: item.job_name || `Project #${item.job_id}`,
          label: item.job_code || item.job_name || `Job #${item.job_id}`,
          tasks: total,
          completed: completed,
          inProgress: inProgress,
          rate: rate,
        };
      });
    } else {
      const empSummary = timesheetReportData?.summary?.employee_summary || [];
      return empSummary.slice(0, 6).map((item) => {
        const totalH = parseFloat(item.total_hours || 0);
        const apprH = parseFloat(item.approved_hours || 0);
        const pendingH = Math.max(0, parseFloat((totalH - apprH).toFixed(1)));
        const rate = totalH > 0 ? Math.round((apprH / totalH) * 100) : 0;
        return {
          name: item.full_name || item.email?.split('@')[0] || `Staff #${item.user_id}`,
          hours: totalH,
          approved: apprH,
          pending: pendingH,
          rate: rate,
        };
      });
    }
  }, [reportType, taskReportData, timesheetReportData]);

  // 🚀 XỬ LÝ XUẤT FILE BÁO CÁO (XLSX & PDF)
  const handleExport = async (formatType) => {
    try {
      setExporting(true);
      toast.info(`Generating ${formatType} report...`);

      const payload = {
        report_type: reportType,
        file_format: formatType, // 'XLSX' | 'PDF'
        job_id: selectedJobId ? Number(selectedJobId) : undefined,
        employee_id: selectedEmployeeId ? Number(selectedEmployeeId) : undefined,
        assignee_id: reportType === 'TASK_SUMMARY' && selectedEmployeeId ? Number(selectedEmployeeId) : undefined,
        status: reportType === 'TASK_SUMMARY' ? (selectedStatus || undefined) : undefined,
        review_status: reportType === 'TIMESHEET_DETAIL' ? (selectedStatus || undefined) : undefined,
        deadline_from: reportType === 'TASK_SUMMARY' ? (dateFrom || undefined) : undefined,
        deadline_to: reportType === 'TASK_SUMMARY' ? (dateTo || undefined) : undefined,
        work_date_from: reportType === 'TIMESHEET_DETAIL' ? (dateFrom || undefined) : undefined,
        work_date_to: reportType === 'TIMESHEET_DETAIL' ? (dateTo || undefined) : undefined,
      };

      const response = await managerReportService.exportReport(payload);

      const mimeType =
        formatType === 'PDF'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: mimeType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = formatType === 'PDF' ? 'pdf' : 'xlsx';
      link.download = `WorkTracker_${reportType}_${format(new Date(), 'yyyyMMdd_HHmmss')}.${extension}`;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
      }, 200);

      toast.success(`Report exported as ${formatType} successfully!`);
    } catch (err) {
      console.error('Export failed:', err);
      let errorMsg = 'Failed to export report. Please try again.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          errorMsg = parsed.detail || Object.values(parsed)[0] || errorMsg;
        } catch {
          // ignore parsing error
        }
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Failed to export report.');
    } finally {
      setExporting(false);
    }
  };

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
    <div className="space-y-6 text-slate-800 pb-12">
      {/* 🌟 HERO HEADER & EXPORT ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Project Delivery & Actual Effort Reports</h1>
            <p className="text-xs text-slate-500 mt-1">
              Analyze actual effort across tasks and projects for delivery tracking and data analytics export.
            </p>
          </div>
        </div>

        {/* Nút Làm mới & Xuất File Báo Cáo */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (reportType === 'TASK_SUMMARY') refetchTasks();
              else refetchTimesheet();
              toast.success('Report data refreshed!');
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 text-xs shadow-2xs transition cursor-pointer"
          >
            <RotateCcw className={cn('w-3.5 h-3.5 text-slate-500', isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => handleExport('XLSX')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>{exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
          </button>

          <button
            onClick={() => handleExport('PDF')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>{exporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* 🧭 REPORT TYPE TABS & 🔍 FILTER TOOLBAR */}
      <ReportFilterToolbar
        reportType={reportType}
        setReportType={setReportType}
        selectedJobId={selectedJobId}
        setSelectedJobId={setSelectedJobId}
        jobOptions={jobOptions}
        selectedEmployeeId={selectedEmployeeId}
        setSelectedEmployeeId={setSelectedEmployeeId}
        employeeOptions={employeeOptions}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
      />

      {/* 📊 SUMMARY STATCARDS & CHARTS */}
      {reportType === 'TASK_SUMMARY' ? (
        <TaskSummaryAnalyticsView
          kpis={kpis}
          chartEffortData={chartEffortData}
          chartStatusData={chartStatusData}
        />
      ) : (
        <TimesheetDetailAnalyticsView
          kpis={kpis}
          chartEffortData={chartEffortData}
          chartTimesheetPieData={chartTimesheetPieData}
        />
      )}

      {/* 📋 BẢNG DỮ LIỆU CHI TIẾT CÓ PHÂN TRANG (PREVIEW DATA TABLE WITH PAGINATION) */}
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
            currentPage: currentPage,
            totalPages: totalPages,
            totalItems: totalItems,
            pageSize: pageSize,
            pageSizeOptions: [10, 25, 50, 100],
            onPageChange: (newPage) => setCurrentPage(newPage),
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            },
          }}
        />
      </div>
    </div>
  );
}
