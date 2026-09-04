import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Users,
  Clock,
  Info,
  AlertCircle,
  CalendarRange,
} from 'lucide-react';

import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';
import JobHeroBanner from '../../components/manager/job-detail/JobHeroBanner';
import JobTasksTab from '../../components/manager/job-detail/JobTasksTab';
import JobGanttTab from '../../components/manager/job-detail/JobGanttTab';
import JobTeamTab from '../../components/manager/job-detail/JobTeamTab';
import JobTimesheetsTab from '../../components/manager/job-detail/JobTimesheetsTab';
import JobInfoTab from '../../components/manager/job-detail/JobInfoTab';
import CreateTaskDrawer from '../../components/manager/job-detail/CreateTaskDrawer';
import ChangeJobStatusModal from '../../components/manager/job-detail/ChangeJobStatusModal';
import { cn } from '../../utils/cn';

// Query Hooks & Stores
import { useManagerJobDetail } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerTasks } from '../../hooks/queries/manager/useManagerTasks';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';
import { useLogWorks } from '../../hooks/queries/manager/useManagerTimesheets';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';
import { useUIStore } from '../../stores/useUIStore';

/**
 * Module: pages/manager/ManagerJobDetailPage
 * Description: Master Project Job workspace providing tabs for task management, interactive Gantt timelines, team workloads, timesheets, and metadata.
 */

// 5 Tab Cốt lõi của Trang Chi tiết Job (Bao gồm Gantt Timeline)
const TABS = [
  { id: 'tasks', label: 'Tasks List', icon: CheckSquare },
  { id: 'gantt', label: 'Gantt Timeline', icon: CalendarRange },
  { id: 'team', label: 'Team & Workload', icon: Users },
  { id: 'timesheets', label: 'Timesheets & Work Logs', icon: Clock },
  { id: 'info', label: 'Project & Client Info', icon: Info },
];

export default function ManagerJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addRecentJob = useRecentJobsStore((state) => state.addRecentJob);
  const openTaskDrawer = useUIStore((state) => state.openTaskDrawer);

  const [activeTab, setActiveTab] = useState('tasks');
  const [createTaskDrawerOpen, setCreateTaskDrawerOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // 🚀 TANSTACK REACT QUERY HOOKS: Nạp dữ liệu Job, Tasks, Employees và Timesheets
  const { data: job, isLoading: jobLoading, error: jobError } = useManagerJobDetail(id);
  const { data: taskResponse, isLoading: tasksLoading } = useManagerTasks({ job_id: id });
  const { data: employeesResponse = [] } = useManagerEmployees();
  const { data: timesheetsData, isLoading: timesheetsLoading } = useLogWorks({ job_id: id });

  // 🌟 Tự động lưu Job vào Store Recently Viewed Jobs
  useEffect(() => {
    if (job && job.id) {
      addRecentJob(job);
    }
  }, [job, addRecentJob]);

  // Chuẩn hóa danh sách Nhân viên cho Dropdown chọn Assignee kèm Smart Workload
  const employeeOptions = useMemo(() => {
    const list = Array.isArray(employeesResponse)
      ? employeesResponse
      : employeesResponse.results || [];
    return list.map((emp) => {
      const swp = emp.smart_workload_pressure;
      const statusLabel =
        swp?.workload_status === 'OVERLOADED'
          ? '🔴 Overloaded'
          : swp?.workload_status === 'BALANCED'
          ? '🟢 Balanced'
          : '⚪ Available';
      const name = emp.full_name || emp.email;
      const email = emp.email || '';
      const dept = emp.department_name || 'Staff';
      return {
        value: String(emp.user_id || emp.id),
        label: `${name} (${dept})`,
        description: email !== name ? `${email} • ${dept}` : dept,
        badge: statusLabel,
      };
    });
  }, [employeesResponse]);

  // Chuẩn hóa danh sách Tasks
  const tasks = useMemo(() => {
    if (Array.isArray(taskResponse)) return taskResponse;
    if (taskResponse && Array.isArray(taskResponse.results)) return taskResponse.results;
    return [];
  }, [taskResponse]);

  // Tính toán Tiến độ dự án
  const progressMetrics = useMemo(() => {
    const total = tasks.length;
    if (!total) return { total: 0, completed: 0, inProgress: 0, reviewing: 0, todo: 0, pct: 0 };

    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const reviewing = tasks.filter((t) => t.status === 'REVIEWING').length;
    const todo = tasks.filter((t) => t.status === 'TODO').length;
    const pct = Math.round((completed / total) * 100);

    return { total, completed, inProgress, reviewing, todo, pct };
  }, [tasks]);

  // Nhóm Tasks theo Team Member (Tab Team & Workload - Server-Driven Smart Workload)
  const groupedTeamMembers = useMemo(() => {
    const rawEmployees = Array.isArray(employeesResponse)
      ? employeesResponse
      : employeesResponse?.results || [];

    const empMap = {};
    rawEmployees.forEach((emp) => {
      empMap[emp.id] = emp;
    });

    const memberMap = {};

    // 1. Khởi tạo toàn bộ nhân sự được phân bổ vào dự án (job.project_team)
    const projectTeam = Array.isArray(job?.project_team) ? job.project_team : [];
    projectTeam.forEach((pm) => {
      const empData = empMap[pm.id] || {};
      memberMap[pm.id] = {
        id: pm.id,
        name: pm.full_name || empData.full_name || pm.email,
        email: pm.email || empData.email,
        avatar_url: pm.avatar_url || empData.avatar_url,
        department_name: pm.department_name || empData.departmentName || empData.department_name || 'General Staff',
        capacityPct: empData.capacity_pct !== undefined && empData.capacity_pct !== null ? parseFloat(empData.capacity_pct) : 0,
        dailyRequiredHours: parseFloat(empData.daily_required_hours || 0),
        activeJobs: empData.active_jobs_count !== undefined && empData.active_jobs_count !== null ? empData.active_jobs_count : 0,
        workloadStatus: empData.smart_workload_status || empData.workload_status || 'AVAILABLE',
        tasks: [],
        stats: { total: 0, completed: 0, inProgress: 0, reviewing: 0, todo: 0 },
      };
    });

    // 2. Gán task vào nhân sự tương ứng (Bỏ qua task Unassigned / Assigned to Manager)
    tasks.forEach((t) => {
      const assignee = t.assignee;
      if (!assignee || !assignee.id) {
        return; // Unassigned task -> không đưa vào thẻ nhân viên
      }
      if (assignee.role === 'MANAGER' || (job && assignee.id === job.manager_id)) {
        return; // Task thuộc về Manager -> không tính vào khối lượng nhân viên
      }

      const memberId = assignee.id;
      if (!memberMap[memberId]) {
        const empData = empMap[memberId] || {};
        memberMap[memberId] = {
          id: memberId,
          name: assignee.full_name || empData.full_name || assignee.email,
          email: assignee.email || empData.email,
          avatar_url: assignee.avatar_url || empData.avatar_url,
          department_name: assignee.department_name || empData.departmentName || empData.department_name || 'General Staff',
          capacityPct: empData.capacity_pct !== undefined && empData.capacity_pct !== null ? parseFloat(empData.capacity_pct) : 0,
          dailyRequiredHours: parseFloat(empData.daily_required_hours || 0),
          activeJobs: empData.active_jobs_count !== undefined && empData.active_jobs_count !== null ? empData.active_jobs_count : 0,
          workloadStatus: empData.smart_workload_status || empData.workload_status || 'AVAILABLE',
          tasks: [],
          stats: { total: 0, completed: 0, inProgress: 0, reviewing: 0, todo: 0 },
        };
      }

      memberMap[memberId].tasks.push(t);
      memberMap[memberId].stats.total += 1;
      if (t.status === 'COMPLETED') memberMap[memberId].stats.completed += 1;
      else if (t.status === 'IN_PROGRESS') memberMap[memberId].stats.inProgress += 1;
      else if (t.status === 'REVIEWING') memberMap[memberId].stats.reviewing += 1;
      else if (t.status === 'TODO') memberMap[memberId].stats.todo += 1;
    });

    return Object.values(memberMap);
  }, [job, tasks, employeesResponse]);

  // Chuẩn hóa Danh sách Timesheets & Tính Metrics Tổng giờ
  const { timesheetsList, timesheetsMetrics } = useMemo(() => {
    const rawList = Array.isArray(timesheetsData)
      ? timesheetsData
      : timesheetsData?.results || [];

    const totalHours = rawList.reduce((acc, log) => acc + (parseFloat(log.hours_spent) || 0), 0);
    const pendingReview = rawList.filter((log) => log.review_status === 'PENDING').length;
    const approved = rawList.filter((log) => log.review_status === 'APPROVED').length;
    const rejected = rawList.filter((log) => log.review_status === 'REJECTED').length;

    return {
      timesheetsList: rawList,
      timesheetsMetrics: {
        totalHours: totalHours.toFixed(1),
        totalLogs: rawList.length,
        pendingReview,
        approved,
        rejected,
      },
    };
  }, [timesheetsData]);

  // Trạng thái Client và Job Frozen
  const isClientInactive = Boolean(job?.client && job.client.is_active === false);
  const isJobFrozen = isClientInactive || job?.status === 'ON_HOLD' || job?.status === 'CANCELLED';

  if (jobLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto text-slate-800 pb-12 animate-pulse">
        <div className="h-44 bg-slate-200/80 rounded-2xl"></div>
        <div className="h-12 bg-slate-200/80 rounded-xl w-96"></div>
        <div className="h-96 bg-slate-200/80 rounded-2xl"></div>
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Project Job Not Found</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          The requested project job either does not exist or you do not have permission to view it.
        </p>
        <button
          onClick={() => navigate('/manager/jobs')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          Back to Projects & Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-[1750px] mx-auto text-slate-800 pb-12">
      {/* 🌟 HERO MASTER INFO BANNER */}
      <JobHeroBanner
        job={job}
        tasks={tasks}
        progressMetrics={progressMetrics}
        isClientInactive={isClientInactive}
        isJobFrozen={isJobFrozen}
        onOpenStatusModal={() => setIsStatusModalOpen(true)}
        onOpenCreateTaskDrawer={() => setCreateTaskDrawerOpen(true)}
      />

      {/* 📑 TABS NAVIGATION ROW */}
      <div className="flex items-center gap-6 border-b border-slate-200/80 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3 border-b-2 font-extrabold text-sm transition-colors cursor-pointer shrink-0',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'tasks' && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-extrabold border border-blue-100">
                  {tasks.length}
                </span>
              )}
              {tab.id === 'gantt' && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-100">
                  Timeline
                </span>
              )}
              {tab.id === 'team' && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-extrabold border border-slate-200">
                  {groupedTeamMembers.length}
                </span>
              )}
              {tab.id === 'timesheets' && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-100 font-mono">
                  {timesheetsMetrics.totalHours}h
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 📋 TAB 1: Tasks List */}
      {activeTab === 'tasks' && (
        <JobTasksTab
          tasks={tasks}
          tasksLoading={tasksLoading}
          openTaskDrawer={openTaskDrawer}
        />
      )}

      {/* 📊 TAB 2: Schedule & Gantt Timeline (NEW) */}
      {activeTab === 'gantt' && (
        <JobGanttTab
          job={job}
          tasks={tasks}
          tasksLoading={tasksLoading}
          openTaskDrawer={openTaskDrawer}
        />
      )}

      {/* 👥 TAB 3: Team & Workload */}
      {activeTab === 'team' && (
        <JobTeamTab
          groupedTeamMembers={groupedTeamMembers}
          openTaskDrawer={openTaskDrawer}
        />
      )}

      {/* ⏱️ TAB 4: Timesheets & Work Logs */}
      {activeTab === 'timesheets' && (
        <JobTimesheetsTab
          jobId={id}
          timesheetsList={timesheetsList}
          timesheetsMetrics={timesheetsMetrics}
          timesheetsLoading={timesheetsLoading}
        />
      )}

      {/* 🏢 TAB 5: Project & Client Info */}
      {activeTab === 'info' && (
        <JobInfoTab job={job} />
      )}

      {/* SideDrawer: Form Tạo Task Mới */}
      <CreateTaskDrawer
        isOpen={createTaskDrawerOpen}
        onClose={() => setCreateTaskDrawerOpen(false)}
        job={job}
        employeeOptions={employeeOptions}
      />

      {/* Modal: Đổi trạng thái Job */}
      <ChangeJobStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        job={job}
        isClientInactive={isClientInactive}
      />

      {/* Global Task Detail Drawer */}
      <TaskDetailDrawer />
    </div>
  );
}