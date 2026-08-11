import React, { useState, useEffect } from 'react';
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
import managerReportService from '../../services/manager/managerReportService';

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
  const [loading, setLoading] = useState(false);

  // State các chỉ số tính toán từ Backend Database
  const [metrics, setMetrics] = useState({
    managed_jobs: 12,
    overdue_task_rate: '8.7%',
    pending_timesheets: 18,
    team_work_hours: '542.5h',
    team_members: 18,
    today_logged_hours: '32.8h',
  });

  const [donutItems, setDonutItems] = useState([
    { label: 'To Do', count: 52, percentage: 30, color: 'bg-blue-600' },
    { label: 'In Progress', count: 43, percentage: 25, color: 'bg-emerald-500' },
    { label: 'Reviewing', count: 34, percentage: 20, color: 'bg-purple-500' },
    { label: 'Completed', count: 26, percentage: 15, color: 'bg-orange-500' },
    { label: 'Cancelled', count: 17, percentage: 10, color: 'bg-rose-500' },
  ]);

  const [totalTaskCount, setTotalTaskCount] = useState(172);

  // State cho Biểu đồ Cột Ngang Workload và Heatmap Năng suất
  const [workloadData, setWorkloadData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const data = await managerReportService.getDashboard();
        if (data) {
          // Ánh xạ chính xác các key từ Django Backend
          setMetrics((prev) => ({
            ...prev,
            managed_jobs: data.managed_jobs_count ?? prev.managed_jobs,
            overdue_task_rate: data.overdue_task_rate?.overdue_rate_percentage 
              ? `${data.overdue_task_rate.overdue_rate_percentage}%` 
              : prev.overdue_task_rate,
            team_work_hours: data.team_total_hours ? `${data.team_total_hours}h` : prev.team_work_hours,
          }));

          // Nạp dữ liệu thật cho Biểu đồ Cột Ngang Workload Nhân sự từ API
          if (data.workload_per_employee && Array.isArray(data.workload_per_employee)) {
            setWorkloadData(
              data.workload_per_employee.map((emp) => ({
                name: emp.full_name || emp.email || 'Employee',
                value: emp.total_hours || 0,
              }))
            );
          }

          // Nạp dữ liệu thật cho Biểu đồ Heatmap Năng suất từ API
          if (data.productivity_heatmap) {
            setHeatmapData(formatHeatmapForComponent(data.productivity_heatmap));
          }

          // Nạp dữ liệu thật cho Biểu đồ Donut Chart từ API
          if (data.task_status_summary) {
            const summary = data.task_status_summary;
            const total = summary.total || 172;
            setTotalTaskCount(total);

            setDonutItems([
              { label: 'To Do', count: summary.TODO || 0, color: 'bg-blue-600' },
              { label: 'In Progress', count: summary.IN_PROGRESS || 0, color: 'bg-emerald-500' },
              { label: 'Reviewing', count: summary.REVIEWING || 0, color: 'bg-purple-500' },
              { label: 'Completed', count: summary.COMPLETED || 0, color: 'bg-orange-500' },
              { label: 'Cancelled', count: summary.CANCELLED || 0, color: 'bg-rose-500' },
            ]);
          }
        }
      } catch (err) {
        console.warn('Dashboard API fallback:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const userName = user?.full_name || user?.email || 'Nguyen Van A';

  return (
    <div className="space-y-5 text-slate-800 pb-10">

      {/* HEADER XIN CHÀO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {userName} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Here's what's happening with your projects today.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-xs cursor-pointer hover:bg-slate-50 transition-colors">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Jun 1 – Jun 30, 2026</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
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
            <p className="text-[10px] text-slate-400">Approve pending logs ({metrics.pending_timesheets})</p>
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

      {/* 6 THẺ KPI STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs">
              <Folder className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">JOB Scope</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Managed Jobs</p>
            <h3 className="text-xl font-bold text-slate-900">{metrics.managed_jobs}</h3>
            <p className="text-[10px] text-slate-400">8 Active • 2 Planning • 2 On Hold</p>
          </div>
          <p className="text-[10px] font-bold text-emerald-600 pt-0.5">↑ 20% <span className="text-slate-400 font-normal">vs last month</span></p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 text-xs">
              <TriangleAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Overdue Task Rate</p>
            <h3 className="text-xl font-bold text-slate-900">{metrics.overdue_task_rate}</h3>
            <p className="text-[10px] text-slate-400">5 overdue of active tasks</p>
          </div>
          <p className="text-[10px] font-bold text-emerald-600 pt-0.5">↓ 3.2% <span className="text-slate-400 font-normal">vs last month</span></p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 text-xs">
              <Hourglass className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pending Timesheets</p>
            <h3 className="text-xl font-bold text-slate-900">{metrics.pending_timesheets}</h3>
            <p className="text-[10px] text-slate-400">{metrics.pending_timesheets} logs waiting approval</p>
          </div>
          <p className="text-[10px] font-bold text-amber-600 pt-0.5">↑ 12 <span className="text-slate-400 font-normal">vs last week</span></p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 text-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Team Work Hours</p>
            <h3 className="text-xl font-bold text-slate-900">{metrics.team_work_hours}</h3>
            <p className="text-[10px] text-slate-400">This month</p>
          </div>
          <p className="text-[10px] font-bold text-emerald-600 pt-0.5">↑ 15.2% <span className="text-slate-400 font-normal">vs last month</span></p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Team Members</p>
            <h3 className="text-xl font-bold text-slate-900">{metrics.team_members}</h3>
            <p className="text-[10px] text-slate-400">15 active today</p>
          </div>
          <p className="text-[10px] font-bold text-rose-500 pt-0.5">↓ 1 <span className="text-slate-400 font-normal">on leave</span></p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 text-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Today's Logged Hours</p>
            <h3 className="text-xl font-bold text-slate-900">{metrics.today_logged_hours}</h3>
            <p className="text-[10px] text-slate-400">As of now</p>
          </div>
          <p className="text-[10px] font-bold text-emerald-600 pt-0.5">↑ 8.3h <span className="text-slate-400 font-normal">yesterday</span></p>
        </div>
      </div>

      {/* MIDDLE ROW CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DonutChartCard
          title="Task Status Distribution"
          data={donutItems.map((item) => ({ name: item.label, value: item.count }))}
          centerValue={totalTaskCount}
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

      {/* BOTTOM ROW DETAIL CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Risk Summary</h3>
            <span className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer">View all</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-start space-x-2.5 p-2 bg-rose-50/50 rounded-lg border border-rose-100">
              <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-xs">2 Jobs At Risk</p>
                <p className="text-[9px] text-slate-400">Jobs have overdue tasks or low progress</p>
              </div>
            </div>
            <div className="flex items-start space-x-2.5 p-2 bg-amber-50/50 rounded-lg border border-amber-100">
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                <TriangleAlert className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-xs">5 Overdue Tasks</p>
                <p className="text-[9px] text-slate-400">Require immediate attention</p>
              </div>
            </div>
            <div className="flex items-start space-x-2.5 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                <UserX className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-xs">1 Employee Overloaded</p>
                <p className="text-[9px] text-slate-400">Workload &gt; 100% capacity</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tasks Need Review</h3>
            <span onClick={() => navigate('/manager/kanban')} className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer">
              View all
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition">
              <div className="flex items-center space-x-2 min-w-0">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                <div className="truncate">
                  <p className="font-semibold text-slate-800 text-[11px] truncate">Design Database Schema</p>
                  <p className="text-[9px] text-slate-400 truncate">ERP System Implementation</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="px-1.5 py-0.2 font-bold text-[8px] rounded bg-rose-50 text-rose-600 border border-rose-200">High</span>
                <button
                  onClick={() => navigate('/manager/timesheet')}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold rounded text-[9px] transition-colors cursor-pointer">
                  Review
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition">
              <div className="flex items-center space-x-2 min-w-0">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                <div className="truncate">
                  <p className="font-semibold text-slate-800 text-[11px] truncate">API Integration Module</p>
                  <p className="text-[9px] text-slate-400 truncate">Mobile App Development</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="px-1.5 py-0.2 font-bold text-[8px] rounded bg-amber-50 text-amber-600 border border-amber-200">Medium</span>
                <button
                  onClick={() => navigate('/manager/timesheet')}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold rounded text-[9px] transition-colors cursor-pointer">
                  Review
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition">
              <div className="flex items-center space-x-2 min-w-0">
                <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                <div className="truncate">
                  <p className="font-semibold text-slate-800 text-[11px] truncate">User Interface Mockup</p>
                  <p className="text-[9px] text-slate-400 truncate">Website Redesign</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="px-1.5 py-0.2 font-bold text-[8px] rounded bg-emerald-50 text-emerald-600 border border-emerald-200">Low</span>
                <button
                  onClick={() => navigate('/manager/timesheet')}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold rounded text-[9px] transition-colors cursor-pointer">
                  Review
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Upcoming Deadlines</h3>
            <span onClick={() => navigate('/manager/jobs')} className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer">
              View all
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-[10px] shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-800 text-[11px] truncate">ERP System Implementation</p>
                  <p className="text-[9px] text-slate-400 truncate">Deadline: Jun 5, 2026</p>
                </div>
              </div>
              <span className="px-1.5 py-0.2 font-bold text-[8px] rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0">2 days left</span>
            </div>

            <div className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-800 text-[11px] truncate">Mobile App Development</p>
                  <p className="text-[9px] text-slate-400 truncate">Deadline: Jun 12, 2026</p>
                </div>
              </div>
              <span className="px-1.5 py-0.2 font-bold text-[8px] rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">9 days left</span>
            </div>

            <div className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-800 text-[11px] truncate">Website Redesign</p>
                  <p className="text-[9px] text-slate-400 truncate">Deadline: Jun 20, 2026</p>
                </div>
              </div>
              <span className="px-1.5 py-0.2 font-bold text-[8px] rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0">17 days left</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Quick Actions &amp; Links</h3>
          </div>
          <div className="space-y-2 text-xs">
            <button
              onClick={() => navigate('/manager/jobs')}
              className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between cursor-pointer"
            >
              <span className="font-semibold text-slate-700">View All My Jobs</span>
              <Folder className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => navigate('/manager/timesheet')}
              className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between cursor-pointer"
            >
              <span className="font-semibold text-slate-700">Approve Logworks</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => navigate('/manager/reports')}
              className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between cursor-pointer"
            >
              <span className="font-semibold text-slate-700">Export System Reports</span>
              <Kanban className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
