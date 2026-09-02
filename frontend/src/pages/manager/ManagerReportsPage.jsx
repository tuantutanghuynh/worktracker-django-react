import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Modular Sub-Components
import ReportsHeroHeader from '../../components/manager/reports/ReportsHeroHeader';
import ReportFilterToolbar from '../../components/manager/reports/ReportFilterToolbar';
import TaskSummaryAnalyticsView from '../../components/manager/reports/TaskSummaryAnalyticsView';
import TimesheetDetailAnalyticsView from '../../components/manager/reports/TimesheetDetailAnalyticsView';
import ReportDataTable from '../../components/manager/reports/ReportDataTable';

import managerReportService from '../../services/manager/managerReportService';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';

const PIE_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

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

      const approvedCount =
        typeof reviewSum.APPROVED === 'number'
          ? reviewSum.APPROVED
          : previewRows.filter((r) => r.review_status === 'APPROVED').length;

      const approvedHours = previewRows
        .filter((r) => r.review_status === 'APPROVED')
        .reduce((sum, r) => sum + parseFloat(r.hours_spent || 0), 0);

      const pendingCount =
        typeof reviewSum.PENDING === 'number'
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
    return jobSummary
      .slice(0, 5)
      .map((item, idx) => ({
        name: item.job_name || `Job #${item.job_id}`,
        value: parseFloat(item.total_hours || 0),
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }))
      .filter((item) => item.value > 0);
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
          completed,
          inProgress,
          rate,
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
          rate,
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
        status: reportType === 'TASK_SUMMARY' ? selectedStatus || undefined : undefined,
        review_status: reportType === 'TIMESHEET_DETAIL' ? selectedStatus || undefined : undefined,
        deadline_from: reportType === 'TASK_SUMMARY' ? dateFrom || undefined : undefined,
        deadline_to: reportType === 'TASK_SUMMARY' ? dateTo || undefined : undefined,
        work_date_from: reportType === 'TIMESHEET_DETAIL' ? dateFrom || undefined : undefined,
        work_date_to: reportType === 'TIMESHEET_DETAIL' ? dateTo || undefined : undefined,
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

  const handleRefresh = () => {
    if (reportType === 'TASK_SUMMARY') refetchTasks();
    else refetchTimesheet();
    toast.success('Report data refreshed!');
  };

  return (
    <div className="space-y-6 text-slate-800 pb-12 antialiased">
      {/* 🌟 Hero Header & Export Actions */}
      <ReportsHeroHeader
        onRefresh={handleRefresh}
        isFetching={isFetching}
        onExport={handleExport}
        exporting={exporting}
      />

      {/* 🧭 Report Type Tabs & Filter Toolbar */}
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

      {/* 📊 Summary StatCards & Charts */}
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

      {/* 📋 Bảng Dữ Liệu Chi Tiết Có Phân Trang */}
      <ReportDataTable
        reportType={reportType}
        paginatedRows={paginatedRows}
        previewRows={previewRows}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={(newPage) => setCurrentPage(newPage)}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
