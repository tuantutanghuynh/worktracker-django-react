import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  Filter,
  Search,
  RotateCcw,
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileCode,
  Layers,
  ArrowUpRight,
  AlertTriangle,
  PieChart as PieIcon,
  Activity
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { cn } from '../../utils/cn';

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

      {/* 🧭 REPORT TYPE TABS */}
      <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs max-w-md">
        <button
          onClick={() => setReportType('TASK_SUMMARY')}
          className={cn(
            'flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer',
            reportType === 'TASK_SUMMARY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          Task Delivery Summary
        </button>
        <button
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
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none"
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
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none"
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
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* 📊 SUMMARY STATCARDS & CHARTS */}
      {reportType === 'TASK_SUMMARY' ? (
        <div className="space-y-6">
          {/* HÀNG 1: 3 THẺ CHỈ SỐ KPI TRẢI NGANG */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tasks in Scope</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{kpis.totalTasks}</span>
                <span className="text-xs font-semibold text-slate-400">tasks</span>
              </div>
            </div>

            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Completion Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-700">{kpis.completionRate}%</span>
                <span className="text-xs font-semibold text-emerald-600">({kpis.completed} completed)</span>
              </div>
            </div>

            <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Overdue Deliverables</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-700">{kpis.overdueTasks}</span>
                <span className="text-xs font-semibold text-rose-600">tasks past deadline</span>
              </div>
            </div>
          </div>

          {/* HÀNG 2: 2 BIỂU ĐỒ (CỘT BÊN TRÁI, TRÒN BÊN PHẢI) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Biểu đồ Cột bên trái (7 cols): Phân bổ Theo Dự án */}
            <div className="lg:col-span-7 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tasks by Project</span>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>

              {chartEffortData.length === 0 ? (
                <div className="h-88 flex items-center justify-center text-xs text-slate-400 italic">
                  No project distribution data
                </div>
              ) : (
                <div className="w-full h-88">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartEffortData} margin={{ top: 25, right: 15, left: -15, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="code"
                        height={55}
                        tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        dy={6}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-2xl border border-slate-800 text-xs space-y-1.5 min-w-44">
                                <div className="font-bold border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
                                  <span className="text-blue-400 font-mono font-extrabold">{data.code}</span>
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full font-bold border border-emerald-800/60">
                                    {data.rate}% Done
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-300 font-medium truncate">{data.name}</div>
                                <div className="flex justify-between items-center text-slate-400 pt-1">
                                  <span>Total Tasks:</span>
                                  <span className="font-bold text-white">{data.tasks}</span>
                                </div>
                                <div className="flex justify-between items-center text-emerald-400">
                                  <span>Completed:</span>
                                  <span className="font-bold">{data.completed}</span>
                                </div>
                                <div className="flex justify-between items-center text-blue-400">
                                  <span>In Progress / Open:</span>
                                  <span className="font-bold">{data.inProgress}</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '36px' }} />
                      {/* Biểu đồ Cột Chồng: Completed ở đáy, In Progress / Open ở trên */}
                      <Bar dataKey="completed" stackId="a" fill="#10B981" name="Completed Tasks" maxBarSize={40} />
                      <Bar dataKey="inProgress" stackId="a" fill="#3B82F6" name="In Progress / Open" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        <LabelList
                          dataKey="tasks"
                          position="top"
                          formatter={(val) => (val > 0 ? `${val}` : '')}
                          style={{ fontSize: '11px', fontWeight: 'bold', fill: '#334155' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Biểu đồ Tròn bên phải (5 cols): Phân bổ Trạng thái Task */}
            <div className="lg:col-span-5 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-between">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Task Status Distribution</span>
                <PieIcon className="w-4 h-4 text-slate-400" />
              </div>

              {chartStatusData.length === 0 ? (
                <div className="h-88 flex items-center justify-center text-xs text-slate-400 italic">
                  No task data available
                </div>
              ) : (
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name) => [`${val} tasks`, name]}
                        contentStyle={{
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-bold text-slate-700 mt-2">
                {chartStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* KPI & BIỂU ĐỒ CHO TIMESHEET DETAIL */
        <div className="space-y-6">
          {/* HÀNG 1: 3 THẺ CHỈ SỐ KPI TIMESHEET TRẢI NGANG */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Work Log Entries</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{kpis.totalLogs}</span>
                <span className="text-xs font-semibold text-slate-400">records</span>
              </div>
            </div>

            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Total Actual Effort</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-700">{parseFloat(kpis.totalHours).toFixed(1)}</span>
                <span className="text-xs font-semibold text-blue-600">hours logged</span>
              </div>
            </div>

            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Approved Effort</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-700">{parseFloat(kpis.approvedHours).toFixed(1)}</span>
                <span className="text-xs font-semibold text-emerald-600">hrs verified ({kpis.approvedCount} logs)</span>
              </div>
            </div>
          </div>

          {/* HÀNG 2: 2 BIỂU ĐỒ (CỘT BÊN TRÁI, TRÒN BÊN PHẢI) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Biểu đồ Cột bên trái (7 cols): Giờ làm việc theo Nhân viên */}
            <div className="lg:col-span-7 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Top Personnel Actual Effort (Hours)</span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>

              {chartEffortData.length === 0 ? (
                <div className="h-88 flex items-center justify-center text-xs text-slate-400 italic">
                  No employee effort data available
                </div>
              ) : (
                <div className="w-full h-88">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartEffortData} margin={{ top: 25, right: 15, left: -15, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="name"
                        height={55}
                        tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        dy={6}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-2xl border border-slate-800 text-xs space-y-1.5 min-w-44">
                                <div className="font-bold border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
                                  <span className="text-blue-400 font-bold">{data.name}</span>
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full font-bold border border-emerald-800/60">
                                    {data.rate}% Verified
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-400 pt-1">
                                  <span>Total Logged:</span>
                                  <span className="font-bold text-white">{data.hours}h</span>
                                </div>
                                <div className="flex justify-between items-center text-emerald-400">
                                  <span>Approved:</span>
                                  <span className="font-bold">{data.approved}h</span>
                                </div>
                                <div className="flex justify-between items-center text-blue-400">
                                  <span>Pending Review:</span>
                                  <span className="font-bold">{data.pending}h</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '36px' }} />
                      <Bar dataKey="approved" stackId="b" fill="#10B981" name="Approved Hours" maxBarSize={40} />
                      <Bar dataKey="pending" stackId="b" fill="#3B82F6" name="Pending Review" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        <LabelList
                          dataKey="hours"
                          position="top"
                          formatter={(val) => (val > 0 ? `${val}h` : '')}
                          style={{ fontSize: '11px', fontWeight: 'bold', fill: '#334155' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Biểu đồ Tròn bên phải (5 cols): Phân bổ Giờ theo Dự án */}
            <div className="lg:col-span-5 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-between">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hours by Project</span>
                <PieIcon className="w-4 h-4 text-slate-400" />
              </div>

              {chartTimesheetPieData.length === 0 ? (
                <div className="h-88 flex items-center justify-center text-xs text-slate-400 italic">
                  No project hours distribution
                </div>
              ) : (
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartTimesheetPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartTimesheetPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name) => [`${val} hrs`, name]}
                        contentStyle={{
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="w-full grid grid-cols-2 gap-2.5 text-xs font-bold text-slate-700 mt-2">
                {chartTimesheetPieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}: {item.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
