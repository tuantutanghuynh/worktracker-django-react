import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Folder, 
  TriangleAlert, 
  Hourglass, 
  Clock, 
  Users, 
  Plus, 
  Kanban, 
  Calendar, 
  ChevronDown, 
  AlertCircle, 
  UserX
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import DonutChartCard from '../../components/common/charts/DonutChartCard';
import HorizontalBarChartCard from '../../components/common/charts/HorizontalBarChartCard';
import ProductivityHeatmap from '../../components/common/charts/ProductivityHeatmap';
import { useManagerDashboard } from '../../hooks/queries/manager/useManagerDashboard';

// Hàm tự động gom nhóm & dùng thư viện date-fns định dạng ngày tháng sang { label, cells: [...] }
const formatHeatmapForComponent = (rawList) => {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [];
  }

  const grouped = {};
  rawList.forEach((item) => {
    const name = item.full_name || item.email || 'Member';
    if (!grouped[name]) {
      grouped[name] = { label: name, cells: [] };
    }

    const formattedDate = item.work_date
      ? format(new Date(item.work_date), 'EEE MM/dd')
      : 'Date';

    grouped[name].cells.push({
      date: formattedDate,
      hours: item.total_hours || 0,
    });
  });

  return Object.values(grouped);
};

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // 🚀 TanStack React Query Hook: Tự động Caching, Background Refetching & Stale Management
  const { data: dashboardData, isLoading, isError } = useManagerDashboard();

  // 100% DỮ LIỆU THẬT TỪ DATABASE BACKEND DJANGO
  const metrics = useMemo(() => {
    const overdueObj = dashboardData?.overdue_task_rate;
    const overdueRateStr = overdueObj?.overdue_rate_percent !== undefined 
      ? `${overdueObj.overdue_rate_percent}%` 
      : '0%';

    const teamHoursStr = dashboardData?.team_total_hours !== undefined 
      ? `${dashboardData.team_total_hours}h` 
      : '0h';

    const teamMembersCount = Array.isArray(dashboardData?.workload_per_employee) 
      ? dashboardData.workload_per_employee.length 
      : 0;

    return {
      managed_jobs: dashboardData?.managed_jobs_count ?? 0,
      overdue_task_rate: overdueRateStr,
      overdue_count: overdueObj?.overdue_tasks ?? 0,
      active_tasks_count: overdueObj?.total_active_tasks ?? 0,
      team_work_hours: teamHoursStr,
      team_members: teamMembersCount,
    };
  }, [dashboardData]);

  // TÍNH TOÁN DỮ LIỆU DONUT CHART TỪ REAL DATABASE DATA
  const donutItems = useMemo(() => {
    const summary = dashboardData?.task_status_summary || {};
    return [
      { label: 'To Do', count: summary.TODO || 0, color: 'bg-blue-600' },
      { label: 'In Progress', count: summary.IN_PROGRESS || 0, color: 'bg-emerald-500' },
      { label: 'Reviewing', count: summary.REVIEWING || 0, color: 'bg-purple-500' },
      { label: 'Completed', count: summary.COMPLETED || 0, color: 'bg-orange-500' },
      { label: 'Cancelled', count: summary.CANCELLED || 0, color: 'bg-rose-500' },
    ];
  }, [dashboardData]);

  // TỔNG SỐ TASK THẬT ĐỰƠC CỘNG CHÍNH XÁC TỪ CÁC TRẠNG THÁI REAL DATA (KHÔNG ĐỂ BỊ BÁO NHẦM SỐ 0)
  const totalTaskCount = useMemo(() => {
    return donutItems.reduce((sum, item) => sum + (item.count || 0), 0);
  }, [donutItems]);

  // TÍNH TOÁN DỮ LIỆU WORKLOAD CỘT NGANG TỪ REAL DATABASE DATA
  const workloadData = useMemo(() => {
    const raw = dashboardData?.workload_per_employee;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((emp) => ({
      name: emp.full_name || emp.email || 'Employee',
      value: emp.total_hours || 0,
    }));
  }, [dashboardData]);

  // TÍNH TOÁN DỮ LIỆU HEATMAP NĂNG SUẤT TỪ REAL DATABASE DATA
  const heatmapData = useMemo(() => {
    return formatHeatmapForComponent(dashboardData?.productivity_heatmap);
  }, [dashboardData]);

  const userName = user?.full_name || user?.email || 'Manager';

  return (
    <div className="space-y-5 text-slate-800 pb-10">

      {/* HEADER XIN CHÀO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {userName} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time project &amp; team performance metrics from database.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{format(new Date(), 'MMMM yyyy')}</span>
        </div>
      </div>

      {/* 4 THẺ THAO TÁC NHANH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => navigate('/manager/jobs')} className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs flex items-center space-x-3.5 hover:border-blue-300 transition cursor-pointer group">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Create Task</h4>
            <p className="text-[10px] text-slate-400">Add new task</p>
          </div>
        </div>

        <div onClick={() => navigate('/manager/jobs')} className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs flex items-center space-x-3.5 hover:border-emerald-300 transition cursor-pointer group">
          <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-sm shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Create Job</h4>
            <p className="text-[10px] text-slate-400">Add new job / project</p>
          </div>
        </div>

        <div onClick={() => navigate('/manager/timesheet')} className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs flex items-center space-x-3.5 hover:border-amber-300 transition cursor-pointer group">
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center text-sm shrink-0 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Review Timesheets</h4>
            <p className="text-[10px] text-slate-400">Approve work logs</p>
          </div>
        </div>

        <div onClick={() => navigate('/manager/kanban')} className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs flex items-center space-x-3.5 hover:border-purple-300 transition cursor-pointer group">
          <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center text-sm shrink-0 shadow-md shadow-slate-700/20 group-hover:scale-105 transition-transform">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Go to Kanban</h4>
            <p className="text-[10px] text-slate-400">Open board view</p>
          </div>
        </div>
      </div>

      {/* THẺ KPI STAT CARDS DÙNG DỮ LIỆU THẬT 100% */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs">
              <Folder className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Database</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Managed Jobs</p>
            <h3 className="text-xl font-bold text-slate-900">{isLoading ? '...' : metrics.managed_jobs}</h3>
            <p className="text-[10px] text-slate-400">Jobs assigned to you</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 text-xs">
              <TriangleAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Overdue Task Rate</p>
            <h3 className="text-xl font-bold text-slate-900">{isLoading ? '...' : metrics.overdue_task_rate}</h3>
            <p className="text-[10px] text-slate-400">{metrics.overdue_count} overdue of {metrics.active_tasks_count} active tasks</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 text-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Team Total Hours</p>
            <h3 className="text-xl font-bold text-slate-900">{isLoading ? '...' : metrics.team_work_hours}</h3>
            <p className="text-[10px] text-slate-400">Logged hours this month</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Team Members</p>
            <h3 className="text-xl font-bold text-slate-900">{isLoading ? '...' : metrics.team_members}</h3>
            <p className="text-[10px] text-slate-400">Members with logged tasks</p>
          </div>
        </div>
      </div>

      {/* MIDDLE ROW CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DonutChartCard
          title="Task Status Distribution"
          data={donutItems.map((item) => ({ name: item.label, value: item.count }))}
          centerValue={isLoading ? 0 : totalTaskCount}
          centerLabel="TASKS"
        />
        <HorizontalBarChartCard
          title="Team Workload Distribution"
          data={workloadData}
          dataKey="value"
          barColor="#2563eb"
        />
        <ProductivityHeatmap
          title="Team Weekly Productivity"
          data={heatmapData}
        />
      </div>

    </div>
  );
}
