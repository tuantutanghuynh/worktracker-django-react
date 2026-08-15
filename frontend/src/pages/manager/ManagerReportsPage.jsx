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
  ArrowUpRight
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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { cn } from '../../utils/cn';

import managerReportService from '../../services/manager/managerReportService';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

export default function ManagerReportsPage() {
  // Tabs: 'TASK_SUMMARY' | 'TIMESHEET_EFFORT'
  const [reportType, setReportType] = useState('TASK_SUMMARY');

  // Filter States
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  // 🚀 TANSTACK REACT QUERY
  const { data: jobsResponse } = useManagerJobs({ page_size: 50 });
  const { data: employeesResponse } = useManagerEmployees();

  // Nạp dữ liệu báo cáo Task Summary
  const {
    data: taskReportData,
    isLoading: loadingTasks,
    isFetching: fetchingTasks,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['manager-reports', 'task-summary', selectedJobId, selectedEmployeeId, dateFrom, dateTo],
    queryFn: () =>
      managerReportService.getTaskSummaryReport({
        job_id: selectedJobId || undefined,
        assignee_id: selectedEmployeeId || undefined,
        deadline_from: dateFrom || undefined,
        deadline_to: dateTo || undefined,
      }),
    enabled: reportType === 'TASK_SUMMARY',
  });

  // Nạp dữ liệu báo cáo Timesheet Detail
  const {
    data: timesheetReportData,
    isLoading: loadingTimesheet,
    isFetching: fetchingTimesheet,
    refetch: refetchTimesheet,
  } = useQuery({
    queryKey: ['manager-reports', 'timesheet-detail', selectedJobId, selectedEmployeeId, dateFrom, dateTo],
    queryFn: () =>
      managerReportService.getTimesheetDetailReport({
        job_id: selectedJobId || undefined,
        employee_id: selectedEmployeeId || undefined,
        work_date_from: dateFrom || undefined,
        work_date_to: dateTo || undefined,
      }),
    enabled: reportType === 'TIMESHEET_EFFORT',
  });

  // Chuẩn hóa Options
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

  // Chuẩn hóa Bảng dữ liệu Preview
  const previewData = useMemo(() => {
    if (reportType === 'TASK_SUMMARY') {
      if (Array.isArray(taskReportData)) return taskReportData;
      if (taskReportData?.results) return taskReportData.results;
      if (taskReportData?.tasks) return taskReportData.tasks;
      return [];
    } else {
      if (Array.isArray(timesheetReportData)) return timesheetReportData;
      if (timesheetReportData?.results) return timesheetReportData.results;
      if (timesheetReportData?.records) return timesheetReportData.records;
      return [];
    }
  }, [reportType, taskReportData, timesheetReportData]);

  // Thống kê tổng hợp KPI
  const kpis = useMemo(() => {
    if (reportType === 'TASK_SUMMARY') {
      const totalTasks = previewData.length;
      const completed = previewData.filter((t) => t.status === 'COMPLETED').length;
      const inProgress = previewData.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEWING').length;
      const totalHours = previewData.reduce((sum, t) => sum + (parseFloat(t.actual_hours || t.logged_hours) || 0), 0);
      const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

      return { totalTasks, completed, inProgress, totalHours, completionRate };
    } else {
      const totalRecords = previewData.length;
      const totalHours = previewData.reduce((sum, r) => sum + (parseFloat(r.hours_spent) || 0), 0);
      const approvedHours = previewData
        .filter((r) => r.review_status === 'APPROVED')
        .reduce((sum, r) => sum + (parseFloat(r.hours_spent) || 0), 0);

      return { totalRecords, totalHours, approvedHours };
    }
  }, [reportType, previewData]);

  // Dữ liệu cho Biểu đồ Phân bổ Trạng thái Task
  const chartStatusData = useMemo(() => {
    if (reportType !== 'TASK_SUMMARY') return [];
    const statusCounts = { TODO: 0, IN_PROGRESS: 0, REVIEWING: 0, COMPLETED: 0 };
    previewData.forEach((t) => {
      if (statusCounts[t.status] !== undefined) statusCounts[t.status]++;
    });

    return [
      { name: 'To Do', value: statusCounts.TODO, color: '#3B82F6' },
      { name: 'In Progress', value: statusCounts.IN_PROGRESS, color: '#10B981' },
      { name: 'Reviewing (QA)', value: statusCounts.REVIEWING, color: '#8B5CF6' },
      { name: 'Completed', value: statusCounts.COMPLETED, color: '#F59E0B' },
    ].filter((item) => item.value > 0);
  }, [reportType, previewData]);

  // Xử lý Xuất file Báo cáo (PDF / Excel / CSV)
  const handleExport = async (formatType) => {
    try {
      setExporting(true);
      toast.info(`Generating ${formatType.toUpperCase()} report...`);

      const payload = {
        report_type: reportType === 'TASK_SUMMARY' ? 'TASK_SUMMARY' : 'TIMESHEET_DETAIL',
        file_format: formatType,
        job_id: selectedJobId || undefined,
        employee_id: selectedEmployeeId || undefined,
        start_date: dateFrom || undefined,
        end_date: dateTo || undefined,
      };

      const response = await managerReportService.exportReport(payload);

      // Tạo Blob link tải về
      const blob = new Blob([response.data], {
        type:
          formatType === 'pdf'
            ? 'application/pdf'
            : formatType === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = formatType === 'excel' ? 'xlsx' : formatType;
      link.setAttribute('download', `WorkTracker_Report_${reportType}_${format(new Date(), 'yyyyMMdd')}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Report exported as ${formatType.toUpperCase()} successfully!`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Cấu hình Cột Bảng Preview
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
            <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">{row.title}</span>
          </div>
          <p className="text-[10px] text-slate-400 truncate">{row.job?.job_name || 'Project'}</p>
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
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => {
        const config = {
          TODO: 'bg-blue-50 text-blue-700 border-blue-200',
          IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          REVIEWING: 'bg-purple-50 text-purple-700 border-purple-200',
          COMPLETED: 'bg-orange-50 text-orange-700 border-orange-200',
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
      header: 'Logged Effort',
      accessorKey: 'actual_hours',
      cell: (row) => (
        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
          {parseFloat(row.actual_hours || row.logged_hours || 0).toFixed(1)} hrs
        </span>
      ),
    },
  ];

  const timesheetColumns = [
    {
      header: 'Employee',
      accessorKey: 'employee_name',
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-900">{row.employee_name || row.user?.full_name || 'Staff'}</p>
          <p className="text-[10px] text-slate-400">{row.user?.email || ''}</p>
        </div>
      ),
    },
    {
      header: 'Project & Task',
      accessorKey: 'task',
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">{row.task?.title || 'Deliverable'}</p>
          <span className="text-[10px] text-blue-600 font-mono">{row.task?.job?.job_code || 'JOB'}</span>
        </div>
      ),
    },
    {
      header: 'Work Date',
      accessorKey: 'work_date',
      cell: (row) => <span className="text-xs font-medium text-slate-700">{row.work_date}</span>,
    },
    {
      header: 'Hours',
      accessorKey: 'hours_spent',
      cell: (row) => (
        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
          {row.hours_spent} hrs
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
            row.review_status === 'REJECTED' && 'bg-rose-50 text-rose-700 border-rose-200'
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

        {/* Nút Xuất File Báo Cáo */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* 🧭 REPORT TYPE TABS */}
      <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs max-w-md">
        <button
          onClick={() => setReportType('TASK_SUMMARY')}
          className={cn(
            'flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all',
            reportType === 'TASK_SUMMARY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          Task Delivery Summary
        </button>
        <button
          onClick={() => setReportType('TIMESHEET_EFFORT')}
          className={cn(
            'flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all',
            reportType === 'TIMESHEET_EFFORT' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          Detailed Timesheet Effort
        </button>
      </div>

      {/* 🔍 FILTER TOOLBAR */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <label className="text-[11px] font-bold text-slate-500 uppercase">Employee</label>
          <SelectDropdown
            value={selectedEmployeeId}
            onChange={(val) => setSelectedEmployeeId(val)}
            options={[{ value: '', label: 'All Employees' }, ...employeeOptions]}
            placeholder="Select employee..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Date To</label>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột Trái: 3 Thẻ Chỉ số */}
          <div className="space-y-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-slate-500">Total Tasks in Period</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{kpis.totalTasks}</span>
                <span className="text-xs font-semibold text-slate-400">tasks</span>
              </div>
            </div>

            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-emerald-800">Deliverable Completion Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-900">{kpis.completionRate}%</span>
                <span className="text-xs font-semibold text-emerald-700">({kpis.completed}/{kpis.totalTasks} tasks)</span>
              </div>
            </div>

            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-200/80 shadow-2xs space-y-1">
              <span className="text-xs font-bold text-blue-800">Total Actual Effort</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-900">{kpis.totalHours.toFixed(1)}</span>
                <span className="text-xs font-semibold text-blue-700">hours</span>
              </div>
            </div>
          </div>

          {/* Cột Phải: Biểu đồ Donut phân bổ Task Status */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Task Delivery QA Distribution</h3>
            </div>

            {chartStatusData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                No chart data available for the selected period
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-xs font-bold text-slate-500">Total Timesheet Records</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{kpis.totalRecords}</span>
              <span className="text-xs font-semibold text-slate-400">entries</span>
            </div>
          </div>

          <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-200/80 shadow-2xs space-y-1">
            <span className="text-xs font-bold text-blue-800">Total Logged Hours</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-blue-900">{kpis.totalHours.toFixed(1)}</span>
              <span className="text-xs font-semibold text-blue-700">hours</span>
            </div>
          </div>

          <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
            <span className="text-xs font-bold text-emerald-800">Approved Effort</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-900">{kpis.approvedHours.toFixed(1)}</span>
              <span className="text-xs font-semibold text-emerald-700">verified hours</span>
            </div>
          </div>
        </div>
      )}

      {/* 📋 PREVIEW DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            {reportType === 'TASK_SUMMARY' ? 'Task Delivery & Effort Dataset' : 'Detailed Timesheet Dataset'}
          </h3>
          <span className="text-xs text-slate-400 font-mono">Showing {previewData.length} records</span>
        </div>

        <DataTable
          columns={reportType === 'TASK_SUMMARY' ? taskColumns : timesheetColumns}
          data={previewData}
          isLoading={reportType === 'TASK_SUMMARY' ? loadingTasks : loadingTimesheet}
          emptyMessage="No report data matching the selected filters."
        />
      </div>
    </div>
  );
}
