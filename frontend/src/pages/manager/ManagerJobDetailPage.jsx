import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Users,
  Clock,
  Info,
  AlertCircle,
} from 'lucide-react';

import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';
import JobHeroBanner from '../../components/manager/job-detail/JobHeroBanner';
import JobTasksTab from '../../components/manager/job-detail/JobTasksTab';
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

// 4 Tab Cốt lõi của Trang Chi tiết Job
const TABS = [
  { id: 'tasks', label: 'Tasks List', icon: CheckSquare },
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
  const { data: employeesResponse = [] } = useManagerEmployees({ job_id: id });
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
      return {
        value: String(emp.user_id || emp.id),
        label: `${emp.full_name || emp.email} (${emp.department_name || 'Staff'}) [${statusLabel}]`,
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

  // Nhóm nhân sự dự án cho Tab 2 (Team & Workload)
  const groupedTeamMembers = useMemo(() => {
    const rawTeam = job?.project_team || (Array.isArray(employeesResponse) ? employeesResponse : []);
    const memberMap = {};

    rawTeam.forEach((emp) => {
      const key = String(emp.id);
      memberMap[key] = {
        id: emp.id,
        name: emp.full_name || emp.email,
        email: emp.email || '',
        avatar_url: emp.avatar_url || emp.profile?.avatar_url || null,
        department_name: emp.department_name || emp.department?.name || 'General Staff',
        tasks: [],
      };
    });

    tasks.forEach((task) => {
      const assignee = task.assignee;
      const key = assignee?.id ? String(assignee.id) : 'unassigned';
      if (!memberMap[key]) {
        memberMap[key] = {
          id: assignee?.id || null,
          name: assignee?.full_name || assignee?.email || 'Unassigned Tasks',
          email: assignee?.email || '',
          avatar_url: assignee?.avatar_url || assignee?.profile?.avatar_url || null,
          department_name: 'General Staff',
          tasks: [],
        };
      }
      memberMap[key].tasks.push(task);
    });

    return Object.values(memberMap);
  }, [tasks, job?.project_team, employeesResponse]);

  // Chuẩn hóa dữ liệu Timesheets của Job này
  const timesheetsList = useMemo(() => {
    if (Array.isArray(timesheetsData)) return timesheetsData;
    if (timesheetsData && Array.isArray(timesheetsData.results)) return timesheetsData.results;
    return [];
  }, [timesheetsData]);

  // Tổng hợp chỉ số Giờ công của Dự án
  const timesheetsMetrics = useMemo(() => {
    let total = 0;
    let approved = 0;
    let pending = 0;
    timesheetsList.forEach((lw) => {
      const h = parseFloat(lw.hours_spent) || 0;
      total += h;
      if (lw.review_status === 'APPROVED') approved += h;
      else if (lw.review_status === 'PENDING') pending += h;
    });
    return {
      totalHours: total.toFixed(1),
      approvedHours: approved.toFixed(1),
      pendingHours: pending.toFixed(1),
    };
  }, [timesheetsList]);

  // Kiểm tra khách hàng và dự án có bị đóng băng không
  const isClientInactive = Boolean(job?.client && job.client.is_active === false);
  const isJobFrozen = Boolean(
    isClientInactive || (job && ['ON_HOLD', 'CANCELLED', 'COMPLETED'].includes(job.status))
  );

  if (jobLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-sm font-bold text-rose-900">Project Not Found</h3>
        <p className="text-xs text-rose-700">
          The requested project workspace could not be located or you do not have permission to access it.
        </p>
        <button
          onClick={() => navigate('/manager/jobs')}
          className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition cursor-pointer"
        >
          Return to Projects Hub
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-800 pb-12">
      {/* 🌟 HERO MASTER INFO BANNER */}
      <JobHeroBanner
        job={job}
        progressMetrics={progressMetrics}
        isClientInactive={isClientInactive}
        isJobFrozen={isJobFrozen}
        onOpenStatusModal={() => setIsStatusModalOpen(true)}
        onOpenCreateTaskDrawer={() => setCreateTaskDrawerOpen(true)}
      />

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-6 overflow-x-auto">
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

      {/* 👥 TAB 2: Team & Workload */}
      {activeTab === 'team' && (
        <JobTeamTab
          groupedTeamMembers={groupedTeamMembers}
          openTaskDrawer={openTaskDrawer}
        />
      )}

      {/* ⏱️ TAB 3: Timesheets & Work Logs */}
      {activeTab === 'timesheets' && (
        <JobTimesheetsTab
          jobId={id}
          timesheetsList={timesheetsList}
          timesheetsMetrics={timesheetsMetrics}
          timesheetsLoading={timesheetsLoading}
        />
      )}

      {/* 🏢 TAB 4: Project & Client Info */}
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