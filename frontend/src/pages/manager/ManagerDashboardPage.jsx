import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';

import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';
import { useUIStore } from '../../stores/useUIStore';

// Subcomponents & Shared Components
import DashboardHeroBanner from '../../components/manager/dashboard/DashboardHeroBanner';
import DashboardKPICards from '../../components/manager/dashboard/DashboardKPICards';
import DashboardDonutChart from '../../components/manager/dashboard/DashboardDonutChart';
import DashboardActionQueues from '../../components/manager/dashboard/DashboardActionQueues';
import TeamMonthlyEffortCard from '../../components/manager/TeamMonthlyEffortCard';
import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';

// TanStack Query Hooks
import { useManagerDashboard } from '../../hooks/queries/manager/useManagerDashboard';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerTasks } from '../../hooks/queries/manager/useManagerTasks';
import { useLogWorks } from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerAuditLogs } from '../../hooks/queries/manager/useManagerAuditLogs';

const ACTION_LABELS = {
  CREATE_JOB: { label: 'Created project', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  UPDATE_JOB: { label: 'Updated project', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  UPDATE_JOB_STATUS: { label: 'Changed project status', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  CREATE_TASK: { label: 'Created task', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UPDATE_TASK_STATUS: { label: 'Moved task status', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  REORDER_TASK: { label: 'Reordered Kanban task', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  TASK_APPROVE: { label: 'Approved task', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  TASK_REJECT: { label: 'Rejected task', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  APPROVE_LOGWORK: { label: 'Approved work log', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECT_LOGWORK: { label: 'Rejected work log', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  RESTORE_TASK: { label: 'Restored task', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const openTaskDrawer = useUIStore((state) => state.openTaskDrawer);

  // ⚡ Real-time WebSocket
  useWebSocket();

  // State Bộ chọn Kỳ Báo cáo
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // 🚀 TanStack React Query Hooks
  const {
    data: dashboardData,
    isLoading,
    isRefetching,
    refetch,
  } = useManagerDashboard({
    month: selectedMonth,
    year: selectedYear,
  });

  const { data: tasksResponse } = useManagerTasks({ page_size: 50 });
  const { data: pendingLogsResponse } = useLogWorks({ review_status: 'PENDING', page_size: 200 });
  const { data: auditResponse } = useManagerAuditLogs();

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Dashboard metrics refreshed!');
  }, [refetch]);

  // Chuẩn hóa 5 chỉ số KPI cốt lõi
  const metrics = useMemo(() => {
    const overdueObj = dashboardData?.overdue_task_rate;
    const overdueRateNum =
      overdueObj?.overdue_rate_percent !== undefined ? overdueObj.overdue_rate_percent : 0;

    const teamHoursStr =
      dashboardData?.team_total_hours !== undefined ? `${dashboardData.team_total_hours}h` : '0h';

    const logsList = Array.isArray(pendingLogsResponse)
      ? pendingLogsResponse
      : Array.isArray(pendingLogsResponse?.results)
      ? pendingLogsResponse.results
      : [];
    const uniquePendingDays = new Set();
    logsList.forEach((lw) => {
      const userId = lw.user?.id || lw.user_id || (typeof lw.user === 'number' ? lw.user : null);
      const date = lw.work_date;
      if (userId && date) uniquePendingDays.add(`${userId}_${date}`);
    });

    const teamMembersCount = Array.isArray(dashboardData?.workload_per_employee)
      ? dashboardData.workload_per_employee.length
      : 15;

    return {
      managed_jobs: dashboardData?.managed_jobs_count ?? 0,
      team_members: teamMembersCount,
      overdue_task_rate: `${overdueRateNum}%`,
      overdue_rate_num: overdueRateNum,
      overdue_count: overdueObj?.overdue_tasks ?? 0,
      active_tasks_count: overdueObj?.total_active_tasks ?? 0,
      pending_timesheets: uniquePendingDays.size,
      team_work_hours: teamHoursStr,
    };
  }, [dashboardData, pendingLogsResponse]);

  // Donut Chart Data
  const donutItems = useMemo(() => {
    const summary = dashboardData?.task_status_summary || {};
    return [
      { label: 'To Do', count: summary.TODO || 0, hexColor: '#2563eb' },
      { label: 'In Progress', count: summary.IN_PROGRESS || 0, hexColor: '#10b981' },
      { label: 'Reviewing', count: summary.REVIEWING || 0, hexColor: '#8b5cf6' },
      { label: 'Completed', count: summary.COMPLETED || 0, hexColor: '#f97316' },
      { label: 'Cancelled', count: summary.CANCELLED || 0, hexColor: '#ef4444' },
    ];
  }, [dashboardData]);

  const totalTaskCount = useMemo(() => {
    return donutItems.reduce((sum, item) => sum + (item.count || 0), 0);
  }, [donutItems]);

  // Overdue & Critical Tasks
  const overdueTasks = useMemo(() => {
    const rawTasks = Array.isArray(tasksResponse) ? tasksResponse : tasksResponse?.results || [];
    const now = new Date();

    return rawTasks
      .filter((t) => {
        if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
        if (!t.deadline) return false;
        return new Date(t.deadline) < now;
      })
      .slice(0, 5)
      .map((t) => {
        const daysOverdue = Math.abs(differenceInDays(new Date(t.deadline), now));
        return {
          id: t.id,
          task_code: t.task_code || `TSK-${t.id}`,
          title: t.title,
          job_name: t.job?.job_name || 'Project',
          assignee_name: t.assignee?.full_name || t.assignee?.email || 'Unassigned',
          deadlineStr: format(new Date(t.deadline), 'dd/MM/yyyy'),
          daysOverdue: daysOverdue === 0 ? 'Due today' : `${daysOverdue}d overdue`,
        };
      });
  }, [tasksResponse]);

  // Pending Logs (Top 5)
  const pendingLogs = useMemo(() => {
    const list = Array.isArray(pendingLogsResponse)
      ? pendingLogsResponse
      : pendingLogsResponse?.results || [];
    return list.slice(0, 5);
  }, [pendingLogsResponse]);

  // Recent Activities (Top 5)
  const recentActivities = useMemo(() => {
    const rawLogs = Array.isArray(auditResponse) ? auditResponse : auditResponse?.results || [];

    return rawLogs.slice(0, 5).map((log) => {
      const actorName =
        log.actor_name || (log.actor_email ? log.actor_email.split('@')[0] : 'Manager');
      const actionConfig = ACTION_LABELS[log.action] || {
        label: (log.action || 'Updated record').replace(/_/g, ' '),
        color: 'bg-slate-50 text-slate-700 border-slate-200',
      };

      const targetDetail = log.table_name ? `${log.table_name} #${log.record_id || ''}` : 'record';

      return {
        id: log.id,
        user: actorName,
        email: log.actor_email,
        actionLabel: actionConfig.label,
        actionColor: actionConfig.color,
        target: targetDetail,
        time: log.created_at ? format(new Date(log.created_at), 'HH:mm • dd/MM') : 'Recently',
      };
    });
  }, [auditResponse]);

  const userName = user?.full_name || user?.email || 'Project Manager';

  return (
    <div className="space-y-6 text-slate-800 pb-12 antialiased">
      {/* 🌟 Tier 1: Hero Banner & Controls */}
      <DashboardHeroBanner
        userName={userName}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        isRefetching={isRefetching}
        onCreateJob={() => navigate('/manager/jobs')}
      />

      {/* 📊 Tier 2: 5 Core Operational KPI Cards */}
      <DashboardKPICards metrics={metrics} />

      {/* 📊 Tier 3: Master-Detail Analytics Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Team Monthly Effort Timeline (Shared Component) */}
        <div className="lg:col-span-8 flex flex-col">
          <TeamMonthlyEffortCard
            month={selectedMonth}
            year={selectedYear}
            heatmapRawData={dashboardData?.productivity_heatmap || []}
            totalHours={metrics.team_work_hours}
          />
        </div>

        {/* Right: Task Status Donut Distribution */}
        <div className="lg:col-span-4 flex flex-col">
          <DashboardDonutChart
            donutItems={donutItems}
            totalTaskCount={totalTaskCount}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* 🌟 Tier 4: 3 Standardized Action Queues */}
      <DashboardActionQueues
        overdueTasks={overdueTasks}
        pendingLogs={pendingLogs}
        recentActivities={recentActivities}
        overdueCount={metrics.overdue_count}
        pendingTimesheetsCount={metrics.pending_timesheets}
        onOpenTaskDrawer={openTaskDrawer}
        onNavigate={navigate}
      />

      {/* Slide-over Task Detail Drawer (Shared Component) */}
      <TaskDetailDrawer />
    </div>
  );
}
