import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  TriangleAlert,
  Hourglass,
  Clock,
  Users,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Activity,
  TrendingUp,
  RotateCcw,
  Plus,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import TeamMonthlyEffortCard from '../../components/manager/TeamMonthlyEffortCard';
import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';

import { useManagerDashboard } from '../../hooks/queries/manager/useManagerDashboard';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerTasks } from '../../hooks/queries/manager/useManagerTasks';
import { useLogWorks } from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerAuditLogs } from '../../hooks/queries/manager/useManagerAuditLogs';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';
import { useUIStore } from '../../stores/useUIStore';
import { cn } from '../../utils/cn';

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const addRecentJob = useRecentJobsStore((state) => state.addRecentJob);
  const openTaskDrawer = useUIStore((state) => state.openTaskDrawer);

  // ⚡ Real-time WebSocket connection
  useWebSocket();

  // State Bộ chọn Kỳ Báo cáo (Tháng & Năm)
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

  const { data: jobsResponse } = useManagerJobs({ page_size: 20 });
  const { data: tasksResponse } = useManagerTasks({ page_size: 50 });
  const { data: pendingLogsResponse } = useLogWorks({ review_status: 'PENDING', page_size: 200 });
  const { data: auditResponse } = useManagerAuditLogs();

  // Xử lý làm mới dữ liệu
  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Dashboard metrics refreshed!');
  }, [refetch]);

  // Chuẩn hóa 4 chỉ số StatCards cốt lõi
  const metrics = useMemo(() => {
    const overdueObj = dashboardData?.overdue_task_rate;
    const overdueRateNum =
      overdueObj?.overdue_rate_percent !== undefined ? overdueObj.overdue_rate_percent : 0;

    const teamHoursStr =
      dashboardData?.team_total_hours !== undefined ? `${dashboardData.team_total_hours}h` : '0h';

    // 🌟 Đếm số lượng Ngày công (Daily Timesheets) duy nhất đang có logwork PENDING
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
    const pendingCount = uniquePendingDays.size;

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
      pending_timesheets: pendingCount,
      team_work_hours: teamHoursStr,
    };
  }, [dashboardData, pendingLogsResponse]);

  // Donut Chart Data (Task Status Distribution)
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

  // Danh sách các Tasks Overdue & Khẩn cấp (Khớp 100% với StatCard Overdue ở trên)
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

  // Widget 2: Pending Logs (Chuẩn hóa chính xác 5 items)
  const pendingLogs = useMemo(() => {
    const list = Array.isArray(pendingLogsResponse)
      ? pendingLogsResponse
      : pendingLogsResponse?.results || [];
    return list.slice(0, 5);
  }, [pendingLogsResponse]);

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

  // Widget 3: Recent Activities (Chuẩn hóa chính xác 5 items)
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
    <div className="space-y-6 text-slate-800 pb-12">
      {/* 🌟 HERO BANNER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back, {userName} 👋
            </h1>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
             Manager
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Real-time project operations, team capacity metrics, and actionable deliverables.
          </p>
        </div>

        {/* Controls: Month/Year Filter + Refresh Button + Create Job CTA */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-2xs gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Month {m < 10 ? `0${m}` : m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer border-l border-slate-200 pl-2"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RotateCcw className={cn('w-3.5 h-3.5', (isLoading || isRefetching) && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/manager/jobs')}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Job</span>
          </button>
        </div>
      </div>

      {/* 📊 TIER 1: 5 CORE OPERATIONAL STATCARDS (CLEAN KPI TILES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* CARD 1: MANAGED JOBS */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Folder className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">Managed Jobs</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {metrics.managed_jobs}
              </span>
              <span className="text-xs font-semibold text-slate-400">in scope</span>
            </div>
          </div>
        </div>

        {/* CARD 2: TEAM MEMBERS */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">Team Members</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {metrics.team_members}
              </span>
              <span className="text-xs font-semibold text-slate-400">assigned</span>
            </div>
          </div>
        </div>

        {/* CARD 3: PENDING TIMESHEETS */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Hourglass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">Pending Timesheets</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
                {metrics.pending_timesheets}
              </span>
              <span className="text-xs font-semibold text-slate-400">waiting review</span>
            </div>
          </div>
        </div>

        {/* CARD 4: TEAM WORK HOURS */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">Team Work Hours</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {metrics.team_work_hours}
              </span>
              <span className="text-xs font-semibold text-slate-400">logged</span>
            </div>
          </div>
        </div>

        {/* CARD 5: OVERDUE TASK RATE */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center',
              metrics.overdue_rate_num > 10
                ? 'bg-rose-50 text-rose-500 border border-rose-100'
                : 'bg-emerald-50 text-emerald-600'
            )}
          >
            <TriangleAlert className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">Overdue Task Rate</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className={cn(
                  'text-2xl sm:text-3xl font-extrabold tracking-tight',
                  metrics.overdue_rate_num > 10 ? 'text-rose-600' : 'text-emerald-600'
                )}
              >
                {metrics.overdue_task_rate}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                ({metrics.overdue_count} of {metrics.active_tasks_count})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 TIER 2: MASTER-DETAIL ANALYTICS CENTER (MATCHING USER REFERENCE IMAGE - EQUAL HEIGHT 100%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT (68% - 70% WIDTH): TEAM MONTHLY EFFORT TIMELINE BAR CHART */}
        <div className="lg:col-span-8 flex flex-col">
          <TeamMonthlyEffortCard
            month={selectedMonth}
            year={selectedYear}
            heatmapRawData={dashboardData?.productivity_heatmap || []}
            totalHours={metrics.team_work_hours}
          />
        </div>

        {/* RIGHT (30% - 32% WIDTH): INLINE LARGE DONUT CHART (EQUAL HEIGHT 100%) */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs h-full flex flex-col justify-between space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-purple-600" />
                <span>Task Status Distribution</span>
              </h3>
              <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                {totalTaskCount} tasks
              </span>
            </div>

            {/* Large Donut Chart + Legend */}
            <div className="flex items-center justify-center gap-4 py-2 flex-1">
              {/* 180px Donut Circle */}
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutItems.map((item) => ({ name: item.label, value: item.count }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {donutItems.map((entry) => (
                        <Cell key={entry.label} fill={entry.hexColor} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-0.5 shadow-lg border border-slate-800">
                              <p className="font-bold text-slate-200">{data.name}</p>
                              <p className="font-extrabold text-sm" style={{ color: data.payload.fill }}>
                                {data.value} tasks ({totalTaskCount ? Math.round((data.value / totalTaskCount) * 100) : 0}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Text */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {isLoading ? 0 : totalTaskCount}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    TASKS
                  </span>
                </div>
              </div>

              {/* Status Legend Breakdown */}
              <div className="flex-1 space-y-2 text-xs">
                {donutItems.map((item) => {
                  const pct = totalTaskCount ? Math.round((item.count / totalTaskCount) * 100) : 0;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between hover:bg-slate-50 p-1.5 rounded-lg transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.hexColor }}
                        />
                        <span className="font-semibold text-slate-700 truncate">{item.label}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 mr-1">{item.count}</span>
                        <span className="text-slate-400 font-medium text-[11px]">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Workflow Scope</span>
              <span className="text-emerald-700 font-bold">100% active</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 TIER 3: 3 STANDARDIZED ACTION QUEUES (EXACTLY 5 ITEMS EACH) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* QUEUE 1: OVERDUE & CRITICAL TASKS (FIXES DATA CONTRADICTION) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 text-rose-500" />
                <span>Overdue & Critical Tasks</span>
              </h3>
              <button
                onClick={() => navigate('/manager/kanban')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
              >
                Kanban →
              </button>
            </div>

            <div className="space-y-2.5 mt-3.5">
              {overdueTasks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  🎉 Excellent! No tasks currently past their deadline.
                </p>
              ) : (
                overdueTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => openTaskDrawer(task.id)}
                    className="flex items-center justify-between p-2.5 hover:bg-rose-50/40 rounded-xl transition border border-slate-100 hover:border-rose-200 cursor-pointer gap-2.5 group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 font-extrabold text-xs flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-800 text-xs truncate group-hover:text-rose-600 transition">
                          {task.task_code}: {task.title}
                        </p>
                        <p className="text-xs text-slate-500 font-medium truncate">
                          {task.assignee_name} • Due: {task.deadlineStr}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 font-bold text-xs rounded-full border shrink-0 bg-rose-50 text-rose-700 border-rose-200">
                      {task.daysOverdue}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Critical Priority</span>
            <span className="text-rose-600 font-bold">{metrics.overdue_count} tasks need action</span>
          </div>
        </div>

        {/* QUEUE 2: PENDING WORK LOGS (5 ITEMS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-amber-500" />
                <span>Pending Work Logs</span>
              </h3>
              <button
                onClick={() => navigate('/manager/timesheet')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
              >
                Review all →
              </button>
            </div>

            <div className="space-y-2.5 mt-3.5">
              {pendingLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  🎉 All caught up! No work logs waiting for review.
                </p>
              ) : (
                pendingLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition border border-slate-100 gap-2.5"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                        {(log.user?.full_name || log.user?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-800 text-xs truncate">
                          {log.task?.title || `LogWork #${log.id}`}
                        </p>
                        <p className="text-xs text-slate-500 font-medium truncate">
                          {log.user?.full_name || log.user?.email} •{' '}
                          <span className="font-bold text-slate-700">{log.hours_spent}h</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/manager/timesheet')}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-bold rounded-lg text-xs transition cursor-pointer shrink-0 border border-blue-200/80"
                    >
                      Review
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Showing Top 5 Pending</span>
            <span className="text-amber-700 font-bold">{metrics.pending_timesheets} in queue</span>
          </div>
        </div>

        {/* QUEUE 3: RECENT AUDIT ACTIVITIES (5 ITEMS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span>Recent Activities</span>
              </h3>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Stream
              </span>
            </div>

            <div className="space-y-2.5 mt-3.5">
              {recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No recent activities logged.</p>
              ) : (
                recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition border border-slate-100 gap-2"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                        {act.user[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-800 text-xs truncate">{act.user}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span
                            className={cn(
                              'px-2 py-0.2 rounded text-[11px] font-bold border',
                              act.actionColor
                            )}
                          >
                            {act.actionLabel}
                          </span>
                          <span className="text-xs text-slate-500 font-medium truncate">
                            on {act.target}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold shrink-0">
                      {act.time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Real-time Audit Trail</span>
            <span className="text-slate-700 font-bold">5 events</span>
          </div>
        </div>
      </div>

      {/* Task Detail Slide-over */}
      <TaskDetailDrawer />
    </div>
  );
}
