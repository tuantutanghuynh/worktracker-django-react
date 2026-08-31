import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Users,
  AlertCircle,
  Eye,
  Kanban,
  CheckSquare,
  Flame,
  TrendingUp,
  ArrowRightLeft,
  MessageSquare,
  Search,
  Info,
  Mail,
  Phone,
  MapPin,
  Hash,
  UserCheck,
  Sparkles,
  FileText,
  PauseCircle,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import BaseModal from '../../components/common/modal/BaseModal';
import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';
import { cn } from '../../utils/cn';

// Query Hooks & Stores
import { useManagerJobDetail, useChangeJobStatus } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerTasks, useCreateTask } from '../../hooks/queries/manager/useManagerTasks';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';
import { useUIStore } from '../../stores/useUIStore';

// 3 Tab Cốt lõi của Trang Chi tiết Job
const TABS = [
  { id: 'tasks', label: 'Tasks List', icon: CheckSquare },
  { id: 'team', label: 'Team & Workload', icon: Users },
  { id: 'info', label: 'Project & Client Info', icon: Info },
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

  // Search & Filter trong Tab Tasks List
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');

  // State Drawer & Modals
  const [createTaskDrawerOpen, setCreateTaskDrawerOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatusValue, setNewStatusValue] = useState('ACTIVE');
  const [statusReason, setStatusReason] = useState('');

  // Form State tạo Task mới
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    priority: 'MEDIUM',
    deadline: '',
  });

  // 🚀 TANSTACK REACT QUERY HOOKS: Nạp dữ liệu Job, Tasks và Employees (Scoped to this Job's Project Team)
  const { data: job, isLoading: jobLoading } = useManagerJobDetail(id);
  const { data: taskResponse, isLoading: tasksLoading } = useManagerTasks({ job_id: id });
  const { data: employeesResponse = [] } = useManagerEmployees({ job_id: id });

  // Mutations
  const createTaskMutation = useCreateTask();
  const changeJobStatusMutation = useChangeJobStatus();

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
      const name = emp.full_name || emp.email;
      const dept = emp.department?.name || emp.department_name || 'Staff';
      const workloadInfo = emp.daily_required_hours !== undefined
        ? ` · ~${emp.daily_required_hours}h/d [${emp.workload_status || 'AVAILABLE'}]`
        : '';
      return {
        value: String(emp.user_id || emp.id),
        label: `${name} (${dept})${workloadInfo}`,
      };
    });
  }, [employeesResponse]);

  // Chuẩn hóa dữ liệu Tasks
  const tasks = useMemo(() => {
    if (Array.isArray(taskResponse)) return taskResponse;
    if (taskResponse && Array.isArray(taskResponse.results)) return taskResponse.results;
    return [];
  }, [taskResponse]);

  // Lọc Tasks theo Search Query & Status Filter Pill
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !taskSearchQuery.trim() ||
        (t.title && t.title.toLowerCase().includes(taskSearchQuery.toLowerCase())) ||
        (t.task_code && t.task_code.toLowerCase().includes(taskSearchQuery.toLowerCase())) ||
        (t.assignee?.full_name && t.assignee.full_name.toLowerCase().includes(taskSearchQuery.toLowerCase()));

      const matchStatus = !taskStatusFilter || t.status === taskStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [tasks, taskSearchQuery, taskStatusFilter]);


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

  // Nhóm nhân sự phụ trách (Unique Team Members based on Project Team & Tasks)
  const groupedTeamMembers = useMemo(() => {
    const memberMap = {};

    // 1. Khởi tạo từ Project Team chính thức của Job
    const rawTeam = job?.project_team || (Array.isArray(employeesResponse) ? employeesResponse : employeesResponse?.results || []);
    rawTeam.forEach((emp) => {
      const key = String(emp.id);
      memberMap[key] = {
        id: emp.id,
        name: emp.full_name || emp.email,
        email: emp.email || '',
        department_name: emp.department_name || emp.department?.name || 'General Staff',
        tasks: [],
      };
    });

    // 2. Gán các Task vào từng thành viên
    tasks.forEach((task) => {
      const assignee = task.assignee;
      const key = assignee?.id ? String(assignee.id) : 'unassigned';
      if (!memberMap[key]) {
        memberMap[key] = {
          id: assignee?.id || null,
          name: assignee?.full_name || assignee?.email || 'Unassigned Tasks',
          email: assignee?.email || '',
          department_name: 'General Staff',
          tasks: [],
        };
      }
      memberMap[key].tasks.push(task);
    });

    return Object.values(memberMap);
  }, [tasks, job?.project_team, employeesResponse]);

  // Xử lý Tạo Task Mới
  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (taskFormData.deadline && taskFormData.deadline < todayStr) {
      toast.error('Task deadline cannot be in the past.');
      return;
    }
    if (taskFormData.deadline && job?.deadline && taskFormData.deadline > job.deadline) {
      toast.error(`Task deadline cannot exceed project deadline (${formatDateSafe(job.deadline)}).`);
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

  // Cấu hình Cột Bảng Task con với chữ to rõ ràng
  const taskColumns = [
    {
      header: 'Task Code & Title',
      accessorKey: 'title',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-extrabold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
            {row.task_code || `TSK-${row.id}`}
          </span>
          <button
            onClick={() => openTaskDrawer(row.id)}
            className="font-bold text-slate-900 hover:text-blue-600 text-sm text-left transition-colors cursor-pointer line-clamp-1"
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
        <div className="flex items-center gap-2 text-xs text-slate-800 font-semibold">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-extrabold uppercase shrink-0 shadow-2xs">
            {(row.assignee?.full_name || row.assignee?.email || 'U')[0]}
          </div>
          <span className="truncate max-w-[140px]">
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
              'px-2.5 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider',
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
              'px-2.5 py-0.5 rounded text-xs font-extrabold uppercase border',
              isHigh
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
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
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
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
            className="px-2.5 py-1 hover:bg-blue-50 text-blue-600 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 text-slate-800 pb-12">
      
      {/* ⚠️ EXECUTIVE ALERT BANNER: CLIENT DEACTIVATED */}
      {job.client && job.client.is_active === false && (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-rose-500/10 border border-amber-300 rounded-2xl flex items-center justify-between gap-4 text-amber-950 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-xs space-y-0.5 min-w-0">
              <p className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                <span>PROJECT FROZEN — CLIENT INACTIVE</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-extrabold uppercase bg-rose-100 text-rose-700 border border-rose-200">
                  Deactivated by Admin
                </span>
              </p>
              <p className="text-amber-800 leading-relaxed">
                Client <strong>"{job.client?.client_name}"</strong> is currently inactive. This project is placed in <strong>ON_HOLD</strong> state and all task workflow transitions & deliverables QA reviews are locked until the client is reactivated.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 shrink-0 shadow-2xs">
            <PauseCircle className="w-4 h-4 text-amber-700" />
            <span>Frozen</span>
          </span>
        </div>
      )}

      {/* 🌟 HERO MASTER INFO BANNER (THU GỌN ~45% CHIỀU CAO, CHỮ TO RÕ RÀNG) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Icon, Titles & Metadata */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100 font-mono">
                  {job.job_code || `JOB-${job.id}`}
                </span>

                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {job.status}
                </span>

                {job.client && job.client.is_active === false && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    <PauseCircle className="w-3 h-3 text-rose-500" />
                    Client Inactive
                  </span>
                )}

                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-extrabold uppercase border',
                    job.priority === 'HIGH'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  )}
                >
                  {job.priority === 'HIGH' && <Flame className="w-3 h-3 text-rose-500" />}
                  {job.priority} Priority
                </span>

                {job.is_overdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    OVERDUE
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                {job.job_name}
              </h1>

              {job.description && (
                <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                  {job.description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => navigate(`/manager/chat?job=${job.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs border border-blue-200 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Project Chat</span>
            </button>

            <button
              onClick={() => navigate(`/manager/kanban?job_id=${job.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 transition cursor-pointer shadow-2xs"
            >
              <Kanban className="w-4 h-4 text-indigo-600" />
              <span>Kanban Board</span>
            </button>

            <button
              onClick={handleOpenStatusModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-500" />
              <span>Change Status</span>
            </button>

            <button
              onClick={() => setCreateTaskDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Horizontal Metadata Row (NẰM GỌN GÀNG TRÊN 1 DÒNG DUY NHẤT) */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-500">Client:</span>
            <span className="font-bold text-slate-900">{job.client?.client_name || job.client_name || 'N/A'}</span>
            {job.client && job.client.is_active === false && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                <PauseCircle className="w-2.5 h-2.5 text-rose-600" />
                Inactive
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-semibold text-slate-500">Timeline:</span>
            <span className="font-bold text-slate-900 font-mono">
              {formatDateSafe(job.start_date)} → {formatDateSafe(job.deadline)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-500">Created:</span>
            <span className="font-bold text-slate-700 font-mono">{formatDateSafe(job.created_at)}</span>
          </div>
        </div>

        {/* 📊 PROGRESS BAR CHUẨN XÁC KÈM LEGEND CHÚ THÍCH */}
        <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Project Deliverable Progress</span>
              <span className="text-slate-500 font-semibold">
                ({progressMetrics.completed}/{progressMetrics.total} tasks completed)
              </span>
            </span>
            <span className="text-emerald-600 text-sm font-extrabold">{progressMetrics.pct}%</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-2 transition-all duration-500"
              style={{ width: `${progressMetrics.pct}%` }}
              title={`Completed: ${progressMetrics.completed}/${progressMetrics.total}`}
            />
          </div>

          {/* Legend chú thích các trạng thái */}
          <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 pt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{progressMetrics.completed} Completed ({progressMetrics.pct}%)</span>
            </span>
            <span className="flex items-center gap-1 text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>{progressMetrics.inProgress} In Progress</span>
            </span>
            <span className="flex items-center gap-1 text-purple-700">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>{progressMetrics.reviewing} Reviewing (QA)</span>
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
              <span>{progressMetrics.todo} To Do</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation (2 TAB CỐT LÕI VỚI FONT CHỮ TO RÕ) */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3 border-b-2 font-extrabold text-sm transition-colors cursor-pointer',
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
            </button>
          );
        })}
      </div>

      {/* 📋 TAB 1: Tasks List (TÍCH HỢP SEARCH & FILTER STATUS NHANH) */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-0">
          
          {/* Toolbar Tìm kiếm & Lọc trạng thái Task */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder="Search tasks by title, code, or assignee..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
              {[
                { value: '', label: 'All' },
                { value: 'TODO', label: 'To Do' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'REVIEWING', label: 'Reviewing' },
                { value: 'COMPLETED', label: 'Completed' },
              ].map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => setTaskStatusFilter(pill.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
                    taskStatusFilter === pill.value
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={taskColumns}
            data={filteredTasks}
            isLoading={tasksLoading}
            onRowClick={(row) => openTaskDrawer(row.id)}
            emptyMessage={
              taskSearchQuery || taskStatusFilter
                ? 'No tasks match your search filter.'
                : "No tasks found in this project. Click 'Add Task' to create one."
            }
          />
        </div>
      )}

      {/* 👥 TAB 2: Team & Workload */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Project Personnel & Assigned Tasks</h3>
              <p className="text-xs text-slate-500">
                Summary of task assignments and workload distribution across project members.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedTeamMembers.map((member, idx) => (
              <div
                key={member.id || `unassigned-${idx}`}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-2xs">
                      {member.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{member.name}</h4>
                      <p className="text-xs text-slate-500">{member.email || 'Unassigned queue'}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                    {member.tasks.length} {member.tasks.length === 1 ? 'Task' : 'Tasks'}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2.5 border-t border-slate-100 text-xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Assigned Deliverables:
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {member.tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTaskDrawer(t.id)}
                        className="p-2 bg-slate-50 hover:bg-blue-50/70 rounded-xl border border-slate-100 flex items-center justify-between cursor-pointer transition"
                      >
                        <span className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">
                          {t.title}
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-600 uppercase bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🏢 TAB 3: Project & Client Info */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* 🏢 CARD 1: CLIENT & PARTNER PROFILE */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Client & Partner Profile</h3>
                  <p className="text-xs text-slate-500">Business organization details and contact points</p>
                </div>
              </div>

              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider',
                  job.client?.is_active !== false
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {job.client?.is_active !== false ? 'Active Partner' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Client Name */}
              <div className="space-y-1 sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-500 block">Organization / Company Name</span>
                <span className="font-extrabold text-sm text-slate-900 block">
                  {job.client?.client_name || job.client_name || 'N/A'}
                </span>
              </div>

              {/* Industry */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>Industry / Domain</span>
                </span>
                <span className="font-bold text-slate-800 text-xs block">
                  {job.client?.industry || 'Enterprise & Cloud Solutions'}
                </span>
              </div>

              {/* Tax Code */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Tax Code (MST)</span>
                </span>
                <span className="font-mono font-bold text-slate-800 text-xs block">
                  {job.client?.tax_code || 'TAX-VN-089123'}
                </span>
              </div>

              {/* Contact Person */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Key Contact Representative</span>
                </span>
                <span className="font-bold text-slate-800 text-xs block">
                  {job.client?.contact_person || 'Managing Director / POC'}
                </span>
              </div>

              {/* Contact Phone */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Direct Phone Line</span>
                </span>
                <span className="font-mono font-bold text-slate-800 text-xs block">
                  {job.client?.contact_phone || '+84 (0) 28 8899 7722'}
                </span>
              </div>

              {/* Contact Email */}
              <div className="space-y-1 sm:col-span-2">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-rose-500" />
                  <span>Official Business Email</span>
                </span>
                <a
                  href={`mailto:${job.client?.contact_email || 'partner-ops@clientorg.com'}`}
                  className="font-bold text-blue-600 text-xs block hover:underline"
                >
                  {job.client?.contact_email || 'partner-ops@clientorg.com'}
                </a>
              </div>

              {/* Head Office Address */}
              <div className="space-y-1 sm:col-span-2">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Head Office Address</span>
                </span>
                <span className="font-medium text-slate-700 text-xs block">
                  {job.client?.address || 'Innovation Tower, District 1, Ho Chi Minh City, Vietnam'}
                </span>
              </div>

              {/* Client Notes / Special Terms */}
              {job.client?.notes && (
                <div className="space-y-1 sm:col-span-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                  <span className="font-bold text-amber-900 block text-[11px]">Cooperation Notes & SLA</span>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    {job.client.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 📋 CARD 2: PROJECT SPECIFICATIONS & GOVERNANCE */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Project Governance & Scope</h3>
                  <p className="text-xs text-slate-500">Execution parameters, manager ownership, and timeline</p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-100">
                {job.job_code || `JOB-${job.id}`}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Project Manager in Charge */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                    {(job.manager?.full_name || 'M')[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Project Manager</span>
                    <span className="font-extrabold text-xs text-slate-900 block">
                      {job.manager?.full_name || job.manager?.email || 'Alexander Wright (Manager)'}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  LEAD PM
                </span>
              </div>

              {/* Timeline & Schedule Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-semibold text-slate-500 block">Kickoff Start Date</span>
                  <span className="font-mono font-bold text-slate-900 text-xs block">
                    {formatDateSafe(job.start_date)}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-semibold text-slate-500 block">Target Completion</span>
                  <span className="font-mono font-bold text-slate-900 text-xs block">
                    {formatDateSafe(job.deadline)}
                  </span>
                </div>
              </div>

              {/* Full Scope Description */}
              <div className="space-y-1.5 pt-1">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Detailed Scope Description</span>
                </span>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-700 text-xs leading-relaxed font-normal min-h-[80px]">
                  {job.description || 'No detailed scope description provided for this project.'}
                </div>
              </div>

              {/* Audit Metadata */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Created: {formatDateSafe(job.created_at)}</span>
                <span>Last Updated: {formatDateSafe(job.updated_at || job.created_at)}</span>
              </div>
            </div>
          </div>

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
              min={format(new Date(), 'yyyy-MM-dd')}
              max={job?.deadline || undefined}
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

      {/* Task Detail Slide-over Drawer */}
      <TaskDetailDrawer />
    </div>
  );
}