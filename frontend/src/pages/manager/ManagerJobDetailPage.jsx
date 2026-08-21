import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Users,
  Lock,
  Layers,
  FileText,
  AlertCircle,
  Eye,
  History,
  Kanban,
  CheckSquare,
  Flame,
  Unlock,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  MessageSquare,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import BaseModal from '../../components/common/modal/BaseModal';
import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';
import ActivityFeedTimeline from '../../components/common/feeds/ActivityFeedTimeline';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';
import { cn } from '../../utils/cn';

// Query Hooks & Stores
import { useManagerJobDetail, useChangeJobStatus } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerTasks, useCreateTask } from '../../hooks/queries/manager/useManagerTasks';
import {
  useTimeLocks,
  useCreateTimeLock,
  useUnlockTimeLock,
} from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerAuditLogs } from '../../hooks/queries/manager/useManagerAuditLogs';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';
import { useUIStore } from '../../stores/useUIStore';

// Danh sách các Tab trong trang Chi tiết Job
const TABS = [
  { id: 'tasks', label: 'Tasks List', icon: CheckSquare },
  { id: 'team', label: 'Team & Workload', icon: Users },
  { id: 'timelocks', label: 'Period Locks', icon: Lock },
  { id: 'audit', label: 'Audit History', icon: History },
];

// Helper format ngày an toàn
function formatDateSafe(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function ManagerJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addRecentJob = useRecentJobsStore((state) => state.addRecentJob);
  const openTaskDrawer = useUIStore((state) => state.openTaskDrawer);

  const [activeTab, setActiveTab] = useState('tasks');

  // State Drawer & Modals
  const [createTaskDrawerOpen, setCreateTaskDrawerOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatusValue, setNewStatusValue] = useState('ACTIVE');
  const [statusReason, setStatusReason] = useState('');

  // State cho Khóa / Mở khóa kỳ công
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [selectedLockToUnlock, setSelectedLockToUnlock] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [lockFormData, setLockFormData] = useState({
    lock_month: new Date().getMonth() + 1,
    lock_year: new Date().getFullYear(),
    reason: '',
  });

  // State cho Audit Log Diff Viewer Slide-over
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);

  // Form State tạo Task mới
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    priority: 'MEDIUM',
    deadline: '',
  });

  // 🚀 TANSTACK REACT QUERY HOOKS: Nạp dữ liệu đồng thời
  const { data: job, isLoading: jobLoading } = useManagerJobDetail(id);
  const { data: taskResponse, isLoading: tasksLoading } = useManagerTasks({ job_id: id });
  const { data: lockResponse } = useTimeLocks({ job_id: id });
  const { data: auditResponse } = useManagerAuditLogs({ record_id: id });
  const { data: employeesResponse = [] } = useManagerEmployees();

  // Mutations
  const createTaskMutation = useCreateTask();
  const changeJobStatusMutation = useChangeJobStatus();
  const createTimeLockMutation = useCreateTimeLock();
  const unlockTimeLockMutation = useUnlockTimeLock();

  // 🌟 Tự động lưu Job vào Store Recently Viewed Jobs
  useEffect(() => {
    if (job && job.id) {
      addRecentJob(job);
    }
  }, [job, addRecentJob]);

  // Chuẩn hóa danh sách Nhân viên cho Dropdown chọn Assignee
  const employeeOptions = useMemo(() => {
    const list = Array.isArray(employeesResponse)
      ? employeesResponse
      : employeesResponse.results || [];
    return list.map((emp) => ({
      value: String(emp.user_id || emp.id),
      label: `${emp.full_name || emp.email} (${emp.department_name || 'Staff'})`,
    }));
  }, [employeesResponse]);

  // Chuẩn hóa dữ liệu Tasks
  const tasks = useMemo(() => {
    if (Array.isArray(taskResponse)) return taskResponse;
    if (taskResponse && Array.isArray(taskResponse.results)) return taskResponse.results;
    return [];
  }, [taskResponse]);

  // Chuẩn hóa dữ liệu TimeLocks
  const timeLocks = useMemo(() => {
    if (Array.isArray(lockResponse)) return lockResponse;
    if (lockResponse && Array.isArray(lockResponse.results)) return lockResponse.results;
    return [];
  }, [lockResponse]);

  // Chuẩn hóa dữ liệu Audit Logs
  const auditLogs = useMemo(() => {
    const rawLogs = Array.isArray(auditResponse)
      ? auditResponse
      : auditResponse?.results || [];

    return rawLogs.map((log) => ({
      id: log.id,
      eventType: log.action || 'UPDATE_JOB',
      title: `${(log.action || 'UPDATE_RECORD').replace(/_/g, ' ')} by ${
        log.actor_name || log.actor_email || 'Manager'
      }`,
      description: `Target: ${log.table_name || 'record'} #${log.record_id || log.id}`,
      timestamp: log.created_at || new Date().toISOString(),
      user: {
        full_name: log.actor_name || log.actor_email || 'Manager',
      },
      originalLog: log,
    }));
  }, [auditResponse]);

  // Tính toán Tiến độ hoàn thành (%) của Job
  const progressMetrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const reviewing = tasks.filter((t) => t.status === 'REVIEWING').length;
    const todo = tasks.filter((t) => t.status === 'TODO').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, reviewing, todo, pct };
  }, [tasks]);

  // Nhóm nhân sự phụ trách (Unique Team Members)
  const groupedTeamMembers = useMemo(() => {
    const memberMap = {};

    tasks.forEach((task) => {
      const assignee = task.assignee;
      const key = assignee?.id ? String(assignee.id) : 'unassigned';
      if (!memberMap[key]) {
        memberMap[key] = {
          id: assignee?.id || null,
          name: assignee?.full_name || assignee?.email || 'Unassigned Tasks',
          email: assignee?.email || '',
          tasks: [],
        };
      }
      memberMap[key].tasks.push(task);
    });

    return Object.values(memberMap);
  }, [tasks]);

  // Xử lý Tạo Task Mới
  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    const payload = {
      title: taskFormData.title.trim(),
      description: taskFormData.description.trim() || undefined,
      job_id: Number(id),
      assignee_id: taskFormData.assignee_id ? Number(taskFormData.assignee_id) : undefined,
      priority: taskFormData.priority,
      deadline: taskFormData.deadline || undefined,
    };

    createTaskMutation.mutate(payload, {
      onSuccess: () => {
        setCreateTaskDrawerOpen(false);
        setTaskFormData({
          title: '',
          description: '',
          assignee_id: '',
          priority: 'MEDIUM',
          deadline: '',
        });
      },
    });
  };

const ALLOWED_TRANSITIONS = {
  PLANNING: [
    { value: 'ACTIVE', label: 'ACTIVE - Start project execution' },
    { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
  ],
  ACTIVE: [
    { value: 'ON_HOLD', label: 'ON HOLD - Temporarily pause project' },
    { value: 'COMPLETED', label: 'COMPLETED - Mark project as finished' },
    { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
  ],
  ON_HOLD: [
    { value: 'ACTIVE', label: 'ACTIVE - Resume project execution' },
    { value: 'CANCELLED', label: 'CANCELLED - Discontinue project' },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

  // Xử lý Đổi trạng thái Job
  const handleOpenStatusModal = () => {
    const currentStatus = job?.status || 'ACTIVE';
    const validTransitions = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (validTransitions.length === 0) {
      toast.info(`Project is in ${currentStatus} state and cannot be changed further.`);
      return;
    }
    setNewStatusValue(validTransitions[0].value);
    setStatusReason('');
    setIsStatusModalOpen(true);
  };

  const handleStatusSubmit = (e) => {
    e.preventDefault();
    if ((newStatusValue === 'ON_HOLD' || newStatusValue === 'CANCELLED') && !statusReason.trim()) {
      toast.error('Reason is required when putting project on hold or cancelling.');
      return;
    }

    changeJobStatusMutation.mutate(
      {
        id,
        newStatus: newStatusValue,
        reason: statusReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setIsStatusModalOpen(false);
        },
      }
    );
  };

  // Xử lý Khóa kỳ công
  const handleCreateTimeLockSubmit = (e) => {
    e.preventDefault();
    createTimeLockMutation.mutate(
      {
        job_id: Number(id),
        lock_month: Number(lockFormData.lock_month),
        lock_year: Number(lockFormData.lock_year),
        reason: lockFormData.reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setLockModalOpen(false);
          setLockFormData({
            lock_month: new Date().getMonth() + 1,
            lock_year: new Date().getFullYear(),
            reason: '',
          });
        },
      }
    );
  };

  // Xử lý Mở khóa kỳ công
  const handleUnlockSubmit = (e) => {
    e.preventDefault();
    if (!selectedLockToUnlock) return;
    if (!unlockReason.trim()) {
      toast.error('Please provide a reason for unlocking this period.');
      return;
    }

    unlockTimeLockMutation.mutate(
      {
        id: selectedLockToUnlock.id,
        reason: unlockReason.trim(),
      },
      {
        onSuccess: () => {
          setUnlockModalOpen(false);
          setSelectedLockToUnlock(null);
          setUnlockReason('');
        },
      }
    );
  };

  // Mở Audit Diff Viewer
  const handleSelectAuditLog = (timelineEvent) => {
    if (timelineEvent?.originalLog) {
      setSelectedAuditLog(timelineEvent.originalLog);
      setAuditDrawerOpen(true);
    }
  };

  if (jobLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="text-xs text-slate-400 font-medium">Loading project details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md mx-auto my-12 space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Project Not Found</h3>
        <p className="text-xs text-slate-500">
          The requested project ID #{id} does not exist or you don't have permission to access it.
        </p>
        <button
          onClick={() => navigate('/manager/jobs')}
          className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition"
        >
          Back to Projects List
        </button>
      </div>
    );
  }

  // Cấu hình Cột Bảng Task con
  const taskColumns = [
    {
      header: 'Task Code & Title',
      accessorKey: 'title',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
            {row.task_code || `TSK-${row.id}`}
          </span>
          <button
            onClick={() => openTaskDrawer(row.id)}
            className="font-bold text-slate-900 hover:text-blue-600 text-xs text-left transition-colors cursor-pointer"
          >
            {row.title}
          </button>
        </div>
      ),
    },
    {
      header: 'Assignee',
      accessorKey: 'assignee',
      cell: (row) => (
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
            {(row.assignee?.full_name || row.assignee?.email || 'U')[0]}
          </div>
          <span className="font-medium truncate max-w-[130px]">
            {row.assignee?.full_name || row.assignee?.email || 'Unassigned'}
          </span>
        </div>
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
              'px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
              config[row.status] || 'bg-slate-100 text-slate-700'
            )}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (row) => {
        const isHigh = row.priority === 'HIGH';
        return (
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-bold uppercase border',
              isHigh
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            )}
          >
            {row.priority || 'MEDIUM'}
          </span>
        );
      },
    },
    {
      header: 'Deadline',
      accessorKey: 'deadline',
      cell: (row) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{formatDateSafe(row.deadline)}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openTaskDrawer(row.id)}
            className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-500 transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-slate-800 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/manager/jobs')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects List</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span>Projects</span>
          <span>/</span>
          <span className="text-slate-800">{job.job_code || `JOB-${job.id}`}</span>
        </div>
      </div>

      {/* 🌟 HERO MASTER INFO CARD */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left: Job Titles & Metadata */}
          <div className="flex items-start gap-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
              <Briefcase className="w-7 h-7" />
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                  {job.job_code || `JOB-${job.id}`}
                </span>

                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {job.status}
                </span>

                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border',
                    job.priority === 'HIGH'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  )}
                >
                  {job.priority === 'HIGH' && <Flame className="w-3 h-3 text-rose-500" />}
                  {job.priority} Priority
                </span>

                {job.is_overdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    OVERDUE
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{job.job_name}</h1>

              <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                {job.description || 'No detailed scope description provided for this project.'}
              </p>

              {/* Metadata row */}
              <div className="pt-2 flex items-center gap-6 text-xs text-slate-600 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800">Client:</span>
                  <span>{job.client?.client_name || job.client_name || 'N/A'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800">Timeline:</span>
                  <span>
                    {formatDateSafe(job.start_date)} → {formatDateSafe(job.deadline)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800">Created:</span>
                  <span>{formatDateSafe(job.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={() => navigate(`/manager/chat?job=${job.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs border border-blue-200 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Project Chat</span>
            </button>

            <button
              onClick={() => navigate(`/manager/kanban?job_id=${job.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 transition cursor-pointer"
            >
              <Kanban className="w-4 h-4 text-indigo-600" />
              <span>Kanban Board</span>
            </button>

            <button
              onClick={handleOpenStatusModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-500" />
              <span>Change Status</span>
            </button>

            <button
              onClick={() => setCreateTaskDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Task Progress Bar */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Project Deliverable Progress</span>
              <span className="text-slate-400 font-normal">
                ({progressMetrics.completed}/{progressMetrics.total} tasks completed)
              </span>
            </span>
            <span className="text-blue-600 text-sm font-extrabold">{progressMetrics.pct}%</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-2 transition-all duration-500"
              style={{
                width: `${
                  progressMetrics.total > 0
                    ? (progressMetrics.completed / progressMetrics.total) * 100
                    : 0
                }%`,
              }}
              title="Completed"
            />
            <div
              className="bg-blue-500 h-2 transition-all duration-500"
              style={{
                width: `${
                  progressMetrics.total > 0
                    ? (progressMetrics.inProgress / progressMetrics.total) * 100
                    : 0
                }%`,
              }}
              title="In Progress"
            />
            <div
              className="bg-purple-500 h-2 transition-all duration-500"
              style={{
                width: `${
                  progressMetrics.total > 0
                    ? (progressMetrics.reviewing / progressMetrics.total) * 100
                    : 0
                }%`,
              }}
              title="Reviewing"
            />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3.5 border-b-2 font-bold text-xs transition-colors cursor-pointer',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'tasks' && (
                <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                  {tasks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 📋 TAB 1: Tasks List */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <DataTable
            columns={taskColumns}
            data={tasks}
            isLoading={tasksLoading}
            onRowClick={(row) => openTaskDrawer(row.id)}
            emptyMessage="No tasks found in this project. Click 'Add Task' to create one."
          />
        </div>
      )}

      {/* 👥 TAB 2: Team & Workload */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Project Personnel & Assigned Tasks</h3>
              <p className="text-xs text-slate-500">
                Summary of task assignments and workload distribution across project members.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedTeamMembers.map((member, idx) => (
              <div
                key={member.id || `unassigned-${idx}`}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center border border-blue-200">
                      {member.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{member.name}</h4>
                      <p className="text-[11px] text-slate-400">{member.email || 'Unassigned queue'}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {member.tasks.length} {member.tasks.length === 1 ? 'Task' : 'Tasks'}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Assigned Deliverables:
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {member.tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTaskDrawer(t.id)}
                        className="p-1.5 bg-slate-50 hover:bg-blue-50/60 rounded-lg border border-slate-100 flex items-center justify-between cursor-pointer transition"
                      >
                        <span className="text-[11px] font-medium text-slate-800 truncate max-w-[180px]">
                          {t.title}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🔒 TAB 3: Period Locks (Khóa kỳ công) */}
      {activeTab === 'timelocks' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Project Period Locks</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lock timesheet reporting periods to prevent employee modifications after payroll cutoff.
              </p>
            </div>

            <button
              onClick={() => setLockModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer transition shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock New Period</span>
            </button>
          </div>

          {timeLocks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No periods have been locked for this job.</p>
              <p className="text-slate-400">All work logs remain open for regular employee timesheet submissions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeLocks.map((lock) => {
                const isLocked = lock.is_locked !== false && !lock.unlocked_at;

                return (
                  <div
                    key={lock.id}
                    className={cn(
                      "p-4 rounded-xl border transition flex items-center justify-between text-xs gap-4",
                      isLocked
                        ? "border-rose-200/80 bg-rose-50/20 hover:border-rose-300"
                        : "border-emerald-200/80 bg-emerald-50/20 hover:border-emerald-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                          isLocked
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-600"
                        )}
                      >
                        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            Period: Month {lock.lock_month}/{lock.lock_year}
                          </span>
                          {isLocked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              LOCKED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              UNLOCKED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {isLocked
                            ? lock.lock_reason || lock.reason || 'Period locked by Manager for payroll processing.'
                            : lock.unlock_reason
                            ? `Unlocked: ${lock.unlock_reason}`
                            : 'Period unlocked. Work log submissions are open.'}
                        </p>
                      </div>
                    </div>

                    {isLocked ? (
                      <button
                        onClick={() => {
                          setSelectedLockToUnlock(lock);
                          setUnlockReason('');
                          setUnlockModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs transition cursor-pointer shrink-0"
                      >
                        <Unlock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Unlock Period</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg font-medium text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Open for submissions</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 📜 TAB 4: Audit History */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Project Change Audit Trail</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log of operational changes, status transitions, and data edits.
            </p>
          </div>

          <ActivityFeedTimeline events={auditLogs} onSelectEvent={handleSelectAuditLog} />
        </div>
      )}

      {/* SideDrawer: Form Tạo Task Mới */}
      <SideDrawer
        isOpen={createTaskDrawerOpen}
        onClose={() => setCreateTaskDrawerOpen(false)}
        title={`Add Task to ${job.job_name}`}
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <InputField
            label="Task Title *"
            value={taskFormData.title}
            onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
            placeholder="e.g. Design Database Schema"
            required
          />

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assign to Employee</label>
            <select
              value={taskFormData.assignee_id}
              onChange={(e) => setTaskFormData({ ...taskFormData, assignee_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Unassigned (Assign later) --</option>
              {employeeOptions.map((emp) => (
                <option key={emp.value} value={emp.value}>
                  {emp.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectDropdown
              label="Priority"
              value={taskFormData.priority}
              onChange={(val) => setTaskFormData({ ...taskFormData, priority: val })}
              options={[
                { value: 'HIGH', label: 'High Priority' },
                { value: 'MEDIUM', label: 'Medium Priority' },
                { value: 'LOW', label: 'Low Priority' },
              ]}
            />

            <InputField
              label="Deadline"
              type="date"
              value={taskFormData.deadline}
              onChange={(e) => setTaskFormData({ ...taskFormData, deadline: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description & Scope</label>
            <textarea
              rows={4}
              value={taskFormData.description}
              onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
              placeholder="Provide clear technical instructions and acceptance criteria..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateTaskDrawerOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
            >
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Modal: Đổi trạng thái Job */}
      <BaseModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Change Project Status"
        description={`Update lifecycle state for "${job.job_name}"`}
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-slate-600 font-semibold">Current Status:</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
              {job.status}
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">New Project Status *</label>
            <select
              value={newStatusValue}
              onChange={(e) => setNewStatusValue(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(ALLOWED_TRANSITIONS[job.status] || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {(newStatusValue === 'ON_HOLD' || newStatusValue === 'CANCELLED') && (
            <div className="space-y-1">
              <label className="block font-bold text-rose-700">Reason for status change *</label>
              <textarea
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Explain why this project is put on hold or cancelled..."
                required
                className="w-full bg-rose-50/50 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changeJobStatusMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
            >
              {changeJobStatusMutation.isPending ? 'Updating...' : 'Confirm Status'}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* Modal: Khóa kỳ công mới (Create TimeLock) */}
      <BaseModal
        isOpen={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        title="Lock Timesheet Period"
        description={`Lock employee work log entries for ${job.job_name}`}
      >
        <form onSubmit={handleCreateTimeLockSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Month *</label>
              <select
                value={lockFormData.lock_month}
                onChange={(e) =>
                  setLockFormData({ ...lockFormData, lock_month: Number(e.target.value) })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Month {m < 10 ? `0${m}` : m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Year *</label>
              <select
                value={lockFormData.lock_year}
                onChange={(e) =>
                  setLockFormData({ ...lockFormData, lock_year: Number(e.target.value) })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
            <textarea
              rows={3}
              value={lockFormData.reason}
              onChange={(e) => setLockFormData({ ...lockFormData, reason: e.target.value })}
              placeholder="e.g. Monthly payroll review cutoff."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLockModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTimeLockMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
            >
              {createTimeLockMutation.isPending ? 'Locking...' : 'Lock Period'}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* Modal: Mở khóa kỳ công (Unlock TimeLock) */}
      <BaseModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        title="Unlock Timesheet Period"
        description={`Allow employees to modify work logs for Month ${selectedLockToUnlock?.lock_month}/${selectedLockToUnlock?.lock_year}`}
      >
        <form onSubmit={handleUnlockSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-rose-700 mb-1">
              Reason for unlocking period *
            </label>
            <textarea
              rows={3}
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Explain why this period is unlocked for correction..."
              required
              className="w-full bg-rose-50/50 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUnlockModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={unlockTimeLockMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
            >
              {unlockTimeLockMutation.isPending ? 'Unlocking...' : 'Confirm Unlock'}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* Task Detail Slide-over Drawer */}
      <TaskDetailDrawer />

      {/* Audit Log Diff Viewer Slide-over Drawer */}
      <SideDrawer
        isOpen={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        title="Audit Log Detail & Snapshot Diff"
      >
        <AuditDiffViewer auditLog={selectedAuditLog} />
      </SideDrawer>
    </div>
  );
}