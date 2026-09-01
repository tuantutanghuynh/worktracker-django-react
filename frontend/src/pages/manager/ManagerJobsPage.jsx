import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Briefcase,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Edit3,
  Building2,
  Layers,
  Kanban,
  ArrowRightLeft,
  Flame,
  FolderGit2,
  TrendingUp,
  RotateCcw,
  Users,
  PauseCircle,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import FilterToolbar from '../../components/common/table/FilterToolbar';
import DataTable from '../../components/common/table/DataTable';
import PaginationBar from '../../components/common/table/PaginationBar';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import BaseModal from '../../components/common/modal/BaseModal';

import { cn } from '../../utils/cn';
import { useDebounce } from '../../hooks/useDebounce';
import {
  useManagerJobs,
  useCreateJob,
  useUpdateJob,
  useChangeJobStatus,
  useManagerClients,
} from '../../hooks/queries/manager/useManagerJobs';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';

// Định nghĩa danh sách Trạng thái Job
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// Định nghĩa Mức độ Ưu tiên
const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'HIGH', label: 'High Priority' },
  { value: 'MEDIUM', label: 'Medium Priority' },
  { value: 'LOW', label: 'Low Priority' },
];

// Helper format ngày hiển thị an toàn
function formatDateSafe(dateStr) {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

// Helper render Status Badge
function JobStatusBadge({ status }) {
  const configs = {
    PLANNING: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
      dot: 'bg-blue-500',
    },
    ACTIVE: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      dot: 'bg-emerald-500',
    },
    COMPLETED: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200/80',
      dot: 'bg-purple-500',
    },
    ON_HOLD: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
      dot: 'bg-amber-500',
    },
    CANCELLED: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
      dot: 'bg-rose-500',
    },
  };

  const current = configs[status] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase shrink-0',
        current.bg
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', current.dot)} />
      {status || 'UNKNOWN'}
    </span>
  );
}

// Helper render Priority Badge
function JobPriorityBadge({ priority }) {
  const isHigh = priority === 'HIGH';
  const isMedium = priority === 'MEDIUM';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
        isHigh
          ? 'bg-rose-50 text-rose-700 border border-rose-200'
          : isMedium
          ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : 'bg-slate-100 text-slate-600 border border-slate-200'
      )}
    >
      {isHigh && <Flame className="w-3 h-3 text-rose-500" />}
      {priority || 'LOW'}
    </span>
  );
}

export default function ManagerJobsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addRecentJob = useRecentJobsStore((state) => state.addRecentJob);

  // State cho Bộ lọc, Chế độ xem & Phân trang
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [isClientInactiveOnly, setIsClientInactiveOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // State cho Drawer Tạo / Chỉnh sửa Job
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create'); // 'create' | 'edit'
  const [editingJobId, setEditingJobId] = useState(null);
  const [formData, setFormData] = useState({
    job_name: '',
    job_code: '',
    client_id: '',
    start_date: '',
    deadline: '',
    priority: 'MEDIUM',
    description: '',
  });

  // State cho Modal Đổi trạng thái Job (State Machine)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTargetJob, setStatusTargetJob] = useState(null);
  const [newStatusValue, setNewStatusValue] = useState('ACTIVE');
  const [statusReason, setStatusReason] = useState('');

  // 🛡️ Hoãn tìm kiếm 400ms chống spam API
  const debouncedSearch = useDebounce(searchQuery, 400);

  // 🚀 TANSTACK REACT QUERY: Nạp danh sách Khách hàng cho Dropdown
  const { data: clientsData = [] } = useManagerClients();
  const clientOptions = useMemo(() => {
    const list = Array.isArray(clientsData) ? clientsData : clientsData.results || [];
    return list.map((c) => ({
      value: String(c.id),
      label: c.client_name,
    }));
  }, [clientsData]);

  // 🚀 TANSTACK REACT QUERY: Nạp danh sách Jobs
  const queryParams = useMemo(
    () => ({
      page: currentPage,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      status: selectedStatus || undefined,
      priority: selectedPriority || undefined,
      client_id: selectedClient || undefined,
      client_is_active: isClientInactiveOnly ? 'false' : undefined,
      is_overdue: isOverdueOnly ? 'true' : undefined,
    }),
    [currentPage, pageSize, debouncedSearch, selectedStatus, selectedPriority, selectedClient, isClientInactiveOnly, isOverdueOnly]
  );

  const { data: response, isLoading } = useManagerJobs(queryParams);
  const { data: teamResponse } = useManagerEmployees();
  const createJobMutation = useCreateJob();
  const updateJobMutation = useUpdateJob();
  const changeJobStatusMutation = useChangeJobStatus();

  // Danh sách nhân viên trong Team do Manager quản lý
  const myTeamEmployees = useMemo(() => {
    if (Array.isArray(teamResponse)) return teamResponse;
    if (teamResponse?.results && Array.isArray(teamResponse.results)) return teamResponse.results;
    return [];
  }, [teamResponse]);

  // Chuẩn hóa dữ liệu Jobs
  const jobs = useMemo(() => {
    if (response && Array.isArray(response.results)) return response.results;
    if (Array.isArray(response)) return response;
    return [];
  }, [response]);

  const totalCount = useMemo(() => {
    if (response && typeof response.count === 'number') return response.count;
    return jobs.length;
  }, [response, jobs]);

  // Điều hướng và lưu vào Store Recent Jobs
  const handleJobClick = useCallback(
    (job) => {
      addRecentJob(job);
      navigate(`/manager/jobs/${job.id}`);
    },
    [addRecentJob, navigate]
  );

  const handleOpenKanban = useCallback(
    (job, e) => {
      if (e) e.stopPropagation();
      addRecentJob(job);
      navigate(`/manager/kanban?job_id=${job.id}`);
    },
    [addRecentJob, navigate]
  );

  // Reset bộ lọc
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setSelectedPriority('');
    setSelectedClient('');
    setIsOverdueOnly(false);
    setIsClientInactiveOnly(false);
    setCurrentPage(1);
  };

  // Mở Drawer Tạo Job Mới
  const handleOpenCreateDrawer = () => {
    setDrawerMode('create');
    setEditingJobId(null);
    setFormData({
      job_name: '',
      job_code: '',
      client_id: clientOptions.length > 0 ? clientOptions[0].value : '',
      start_date: new Date().toISOString().split('T')[0],
      deadline: '',
      priority: 'MEDIUM',
      description: '',
      initial_team_member_ids: myTeamEmployees.map((e) => e.id),
    });
    setIsDrawerOpen(true);
  };

  // Mở Drawer Sửa Job
  const handleOpenEditDrawer = (job, e) => {
    if (e) e.stopPropagation();
    setDrawerMode('edit');
    setEditingJobId(job.id);

    // Lấy danh sách ID thành viên đang tham gia dự án
    const existingTeam = Array.isArray(job.project_team) ? job.project_team : [];
    const existingMemberIds = existingTeam.map((m) => m.id);

    setFormData({
      job_name: job.job_name || '',
      job_code: job.job_code || '',
      client_name: job.client?.client_name || 'No Client',
      client_id: job.client?.id ? String(job.client.id) : '',
      start_date: job.start_date || '',
      deadline: job.deadline || '',
      priority: job.priority || 'MEDIUM',
      description: job.description || '',
      initial_team_member_ids: existingMemberIds,
      project_team: existingTeam,
    });
    setIsDrawerOpen(true);
  };

  // Xử lý gửi Form Create / Update Job
  const handleDrawerFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.job_name.trim()) {
      toast.error('Please enter a project name.');
      return;
    }

    if (drawerMode === 'create') {
      if (!formData.client_id) {
        toast.error('Please select a client.');
        return;
      }
      if (!formData.deadline) {
        toast.error('Please set a deadline.');
        return;
      }
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (formData.deadline && formData.deadline < todayStr) {
        toast.error('Deadline cannot be in the past.');
        return;
      }
      if (formData.start_date && formData.deadline && formData.deadline < formData.start_date) {
        toast.error('Deadline cannot be earlier than start date.');
        return;
      }

      const payload = {
        job_name: formData.job_name.trim(),
        job_code: formData.job_code.trim() || undefined,
        client_id: parseInt(formData.client_id, 10),
        priority: formData.priority,
        start_date: formData.start_date || new Date().toISOString().split('T')[0],
        deadline: formData.deadline,
        description: formData.description.trim() || undefined,
        initial_team_member_ids: formData.initial_team_member_ids || [],
      };

      createJobMutation.mutate(payload, {
        onSuccess: () => {
          setIsDrawerOpen(false);
        },
      });
    } else {
      // Edit Mode
      if (formData.deadline && formData.start_date && formData.deadline < formData.start_date) {
        toast.error('Deadline cannot be earlier than start date.');
        return;
      }

      const payload = {
        job_name: formData.job_name.trim(),
        priority: formData.priority,
        deadline: formData.deadline || undefined,
        description: formData.description.trim() || '',
        team_member_ids: formData.initial_team_member_ids || [],
      };

      updateJobMutation.mutate(
        { id: editingJobId, data: payload },
        {
          onSuccess: () => {
            setIsDrawerOpen(false);
          },
        }
      );
    }
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

  // Mở Modal Đổi Trạng thái
  const handleOpenStatusModal = (job, e) => {
    if (e) e.stopPropagation();
    const currentStatus = job?.status || 'ACTIVE';
    const validTransitions = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (validTransitions.length === 0) {
      toast.info(`Project is in ${currentStatus} state and cannot be changed further.`);
      return;
    }
    setStatusTargetJob(job);
    setNewStatusValue(validTransitions[0].value);
    setStatusReason('');
    setIsStatusModalOpen(true);
  };

  // Submit Đổi Trạng thái
  const handleStatusSubmit = (e) => {
    e.preventDefault();
    if (!statusTargetJob) return;

    if ((newStatusValue === 'ON_HOLD' || newStatusValue === 'CANCELLED') && !statusReason.trim()) {
      toast.error('Reason is required when placing a project on hold or cancelling.');
      return;
    }

    changeJobStatusMutation.mutate(
      {
        id: statusTargetJob.id,
        newStatus: newStatusValue,
        reason: statusReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setIsStatusModalOpen(false);
          setStatusTargetJob(null);
        },
      }
    );
  };

  // Cấu hình Cột cho Bảng DataTable
  const columns = [
    {
      header: 'Project & Client',
      accessorKey: 'job_name',
      cell: (row) => {
        const isOverdue = row.is_overdue;
        const isClientInactive = row.client && row.client.is_active === false;
        const clientName = row.client?.client_name || row.client_name || 'Internal';

        return (
          <div className="py-0.5 space-y-1 min-w-[220px] max-w-[340px]">
            {/* Dòng 1: Code + Tên Project + Overdue */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/80 shrink-0">
                {row.job_code || `JOB-${row.id}`}
              </span>
              <span
                className="font-bold text-slate-900 text-xs hover:text-blue-600 transition-colors cursor-pointer truncate"
                onClick={() => handleJobClick(row)}
                title={row.job_name}
              >
                {row.job_name}
              </span>
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                  <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                  OVERDUE
                </span>
              )}
            </div>

            {/* Dòng 2: Client + Status Inactive nếu có */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium truncate">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate max-w-[160px]" title={clientName}>
                {clientName}
              </span>
              {isClientInactive && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 shrink-0">
                  <PauseCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                  Inactive
                </span>
              )}
              {row.description && (
                <>
                  <span className="text-slate-300 shrink-0">•</span>
                  <span className="text-slate-400 line-clamp-1 truncate" title={row.description}>
                    {row.description}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => {
        const isClientInactive = row.client && row.client.is_active === false;
        if (isClientInactive) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
              <PauseCircle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Frozen (On Hold)</span>
            </span>
          );
        }
        return <JobStatusBadge status={row.status} />;
      },
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (row) => <JobPriorityBadge priority={row.priority} />,
    },
    {
      header: 'Team',
      accessorKey: 'team_size',
      cell: (row) => (
        <span
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
          title={`${row.team_size || 0} assigned project team members`}
        >
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.team_size || 0}</span>
        </span>
      ),
    },
    {
      header: 'Progress',
      accessorKey: 'task_counts',
      cell: (row) => {
        const counts = row.task_counts || {};
        const total = counts.total_tasks || 0;
        const completed = counts.completed_count || 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
          <div className="w-28 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
              <span>
                {completed}/{total} Tasks
              </span>
              <span className={cn("font-bold text-[10px]", pct === 100 ? "text-emerald-600" : "text-blue-600")}>
                {pct}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  pct === 100 ? "bg-emerald-500" : "bg-blue-600"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Deadline',
      accessorKey: 'deadline',
      cell: (row) => {
        const isOverdue = row.is_overdue;
        return (
          <div className="space-y-0.5 text-xs">
            <div className={cn("flex items-center gap-1 font-semibold", isOverdue ? "text-rose-600" : "text-slate-700")}>
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatDateSafe(row.deadline)}</span>
            </div>
            {row.start_date && (
              <div className="text-[10px] text-slate-400">
                Start: {formatDateSafe(row.start_date)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleJobClick(row)}
            className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleOpenKanban(row, e)}
            className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Open Kanban Board"
          >
            <Kanban className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleOpenEditDrawer(row, e)}
            className="p-1.5 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Edit Project"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleOpenStatusModal(row, e)}
            className="p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Change Status"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 text-slate-800 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                My Managed Projects
              </h1>
              <p className="text-xs text-slate-500">
                Track deliverables, monitor milestones, and coordinate teams across active jobs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenCreateDrawer}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Job</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar with Extended Dropdowns */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search project name, code, client..."
        statusOptions={STATUS_OPTIONS}
        statusValue={selectedStatus}
        onStatusChange={(val) => {
          setSelectedStatus(val);
          setCurrentPage(1);
        }}
        priorityOptions={PRIORITY_OPTIONS}
        priorityValue={selectedPriority}
        onPriorityChange={(val) => {
          setSelectedPriority(val);
          setCurrentPage(1);
        }}
        onClearFilters={handleResetFilters}
        currentView={viewMode}
        onViewChange={setViewMode}
        viewModes={['table', 'grid']}
      >
        {/* Client Selector Filter */}
        {clientOptions.length > 0 && (
          <select
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
          >
            <option value="">All Clients</option>
            {clientOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}

        {/* Overdue Quick Filter Button */}
        <button
          type="button"
          onClick={() => {
            setIsOverdueOnly(!isOverdueOnly);
            setCurrentPage(1);
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer',
            isOverdueOnly
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
          )}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Overdue Only</span>
        </button>

        {/* Client Inactive Quick Filter Button */}
        <button
          type="button"
          onClick={() => {
            setIsClientInactiveOnly(!isClientInactiveOnly);
            setCurrentPage(1);
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer',
            isClientInactiveOnly
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
          )}
          title="Filter projects whose client is deactivated"
        >
          <PauseCircle className="w-3.5 h-3.5" />
          <span>Client Inactive Only</span>
        </button>
      </FilterToolbar>

      {/* Main Content: Table or Grid View */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <DataTable
            columns={columns}
            data={jobs}
            isLoading={isLoading}
            onRowClick={handleJobClick}
            emptyMessage="No projects found matching your filter criteria."
          />
          <PaginationBar
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / pageSize) || 1}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      ) : (
        /* Grid Cards View */
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-56 bg-slate-100 rounded-2xl animate-pulse border border-slate-200/60"
                />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Projects Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No projects matched your active filters or search criteria. Try resetting filters or create a new job.
              </p>
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => {
                const counts = job.task_counts || {};
                const total = counts.total_tasks || 0;
                const completed = counts.completed_count || 0;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const isOverdue = job.is_overdue;

                return (
                  <div
                    key={job.id}
                    onClick={() => handleJobClick(job)}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 relative group"
                  >
                    {/* Top Row: Code, Priority, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {job.job_code || `JOB-${job.id}`}
                        </span>
                        <JobPriorityBadge priority={job.priority} />
                        {isOverdue && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            OVERDUE
                          </span>
                        )}
                        {job.client && job.client.is_active === false && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="Client is deactivated by admin">
                            <PauseCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                            Client Inactive
                          </span>
                        )}
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>

                    {/* Middle: Title & Description */}
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {job.job_name}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {job.description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span className="flex items-center gap-1 text-[11px]">
                          <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                          Progress ({completed}/{total} Tasks)
                        </span>
                        <span className="text-blue-600 font-bold text-xs">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Bottom Metadata & Quick Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1 font-medium truncate max-w-[130px]">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {job.client?.client_name || job.client_name || 'No Client'}
                          {job.client && job.client.is_active === false ? ' (Inactive)' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleOpenKanban(job, e)}
                          className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition cursor-pointer"
                          title="Open Kanban Board"
                        >
                          <Kanban className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenEditDrawer(job, e)}
                          className="p-1.5 hover:bg-slate-100 hover:text-slate-800 rounded-lg text-slate-400 transition cursor-pointer"
                          title="Edit Project"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenStatusModal(job, e)}
                          className="p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg text-slate-400 transition cursor-pointer"
                          title="Change Status"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <PaginationBar
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / pageSize) || 1}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {/* SideDrawer: Create & Edit Job Form */}
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={drawerMode === 'create' ? 'Create New Project (Job)' : 'Edit Project Details'}
      >
        <form onSubmit={handleDrawerFormSubmit} className="space-y-4 text-xs">
          <InputField
            label="Project Name"
            value={formData.job_name}
            onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
            placeholder="e.g. ERP Implementation Phase 1"
            required
          />

          {drawerMode === 'edit' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Client</label>
              <div className="flex items-center gap-2.5 p-2.5 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-medium text-slate-800">
                <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="font-semibold text-slate-900">{formData.client_name || 'Associated Client'}</span>
                <span className="ml-auto text-[10px] font-normal px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md">
                  Read-only
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Project Code"
              value={formData.job_code}
              onChange={(e) => setFormData({ ...formData, job_code: e.target.value })}
              placeholder="e.g. JOB-ERP-01"
              disabled={drawerMode === 'edit'}
              helperText={drawerMode === 'edit' ? 'Unique project identifier.' : undefined}
            />

            <SelectDropdown
              label="Priority Level"
              required
              theme="light"
              value={formData.priority}
              onChange={(val) => setFormData({ ...formData, priority: val })}
              options={[
                { value: 'HIGH', label: 'High Priority' },
                { value: 'MEDIUM', label: 'Medium Priority' },
                { value: 'LOW', label: 'Low Priority' },
              ]}
            />
          </div>

          {drawerMode === 'create' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">
                Select Client <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Client --</option>
                {clientOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              disabled={drawerMode === 'edit'}
              helperText={drawerMode === 'edit' ? 'Start date is fixed.' : undefined}
            />

            <InputField
              label="Deadline Date"
              type="date"
              min={drawerMode === 'create' ? format(new Date(), 'yyyy-MM-dd') : undefined}
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-xs">Project Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter deliverables, scope, and objectives..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>

          {myTeamEmployees.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="block font-bold text-slate-700 text-xs">
                  {drawerMode === 'create' ? 'Assign Team Members' : 'Manage Project Team'} ({formData.initial_team_member_ids?.length || 0}/{myTeamEmployees.length})
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, initial_team_member_ids: myTeamEmployees.map((e) => e.id) })}
                    className="text-blue-600 hover:underline cursor-pointer font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      // Chỉ giữ lại những nhân viên đang bị khóa do có task dang dở
                      const lockedIds = (formData.project_team || [])
                        .filter((m) => (m.active_tasks_count || 0) > 0)
                        .map((m) => m.id);
                      setFormData({ ...formData, initial_team_member_ids: lockedIds });
                    }}
                    className="text-slate-500 hover:underline cursor-pointer font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {myTeamEmployees.map((emp) => {
                  const memberInfo = formData.project_team?.find((m) => m.id === emp.id);
                  const activeTasksCount = memberInfo?.active_tasks_count || 0;
                  const isLocked = drawerMode === 'edit' && activeTasksCount > 0;
                  const isChecked = isLocked || formData.initial_team_member_ids?.includes(emp.id);

                  return (
                    <label
                      key={emp.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg transition text-xs",
                        isLocked
                          ? "bg-slate-100/90 border border-slate-200/80 cursor-not-allowed select-none"
                          : "hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLocked}
                          onChange={(e) => {
                            if (isLocked) return;
                            const current = formData.initial_team_member_ids || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, initial_team_member_ids: [...current, emp.id] });
                            } else {
                              setFormData({ ...formData, initial_team_member_ids: current.filter((id) => id !== emp.id) });
                            }
                          }}
                          className={cn(
                            "rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5",
                            isLocked && "opacity-60 cursor-not-allowed"
                          )}
                        />
                        <span className={cn("font-medium truncate", isLocked ? "text-slate-700" : "text-slate-800")}>
                          {emp.full_name || emp.profile?.full_name || emp.email}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLocked ? (
                          <span
                            title="Reassign or cancel open tasks before removing this employee from the project"
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"
                          >
                            🔒 {activeTasksCount} active task{activeTasksCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 font-medium">
                            {emp.department_name || emp.profile?.department_name || 'Member'}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createJobMutation.isPending || updateJobMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
            >
              {createJobMutation.isPending || updateJobMutation.isPending
                ? 'Saving...'
                : drawerMode === 'create'
                ? 'Create Project'
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Modal: Change Job Status */}
      <BaseModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Change Project Status"
        description={`Update lifecycle status for "${statusTargetJob?.job_name}"`}
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-slate-600 font-semibold">Current Status:</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
              {statusTargetJob?.status}
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">New Project Status *</label>
            <select
              value={newStatusValue}
              onChange={(e) => setNewStatusValue(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(ALLOWED_TRANSITIONS[statusTargetJob?.status] || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {(newStatusValue === 'ON_HOLD' || newStatusValue === 'CANCELLED') && (
            <div className="space-y-1">
              <label className="block font-bold text-rose-700">
                Reason for status change *
              </label>
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
              {changeJobStatusMutation.isPending ? 'Updating...' : 'Confirm Status Change'}
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}