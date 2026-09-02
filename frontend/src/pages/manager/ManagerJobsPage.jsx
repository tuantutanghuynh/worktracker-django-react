import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

import JobsHeader from '../../components/manager/jobs/JobsHeader';
import JobsFilterBar from '../../components/manager/jobs/JobsFilterBar';
import JobsTableView from '../../components/manager/jobs/JobsTableView';
import JobsGridView from '../../components/manager/jobs/JobsGridView';
import JobFormDrawer from '../../components/manager/jobs/JobFormDrawer';
import JobStatusModal from '../../components/manager/jobs/JobStatusModal';

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

export default function ManagerJobsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addRecentJob = useRecentJobsStore((state) => state.addRecentJob);

  // State cho Bộ lọc, Chế độ xem & Phân trang
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'ACTIVE');
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
    setSelectedStatus('ACTIVE');
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
    if (job?.client && job.client.is_active === false) {
      toast.error(
        `Cannot edit project "${job.job_name}" because client "${job.client?.client_name}" is deactivated by Admin. The project is frozen.`
      );
      return;
    }
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
      client_is_active: job.client ? job.client.is_active : true,
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
  const handleDrawerFormSubmit = (data) => {
    if (drawerMode === 'edit' && formData.client_is_active === false) {
      toast.error('Cannot edit project because client is deactivated by Admin. The project is frozen.');
      return;
    }

    if (drawerMode === 'create') {
      const payload = {
        job_name: data.job_name.trim(),
        job_code: data.job_code?.trim() || undefined,
        client_id: parseInt(data.client_id, 10),
        priority: data.priority,
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        deadline: data.deadline,
        description: data.description?.trim() || undefined,
        initial_team_member_ids: data.initial_team_member_ids || [],
      };

      createJobMutation.mutate(payload, {
        onSuccess: () => {
          setIsDrawerOpen(false);
        },
      });
    } else {
      // Edit Mode
      const payload = {
        job_name: data.job_name.trim(),
        priority: data.priority,
        deadline: data.deadline || undefined,
        description: data.description?.trim() || '',
        team_member_ids: data.initial_team_member_ids || [],
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

  // Mở Modal Đổi Trạng thái
  const handleOpenStatusModal = (job, e) => {
    if (e) e.stopPropagation();
    if (job?.client && job.client.is_active === false) {
      toast.error(
        `Cannot change status because client "${job.client?.client_name}" is deactivated by Admin. The project is frozen.`
      );
      return;
    }
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

  return (
    <div className="space-y-5 text-slate-800 pb-12">
      {/* Header Bar */}
      <JobsHeader onCreateClick={handleOpenCreateDrawer} />

      {/* Filter Tabs & Toolbar */}
      <JobsFilterBar
        selectedStatus={selectedStatus}
        onStatusChange={(val) => {
          setSelectedStatus(val);
          setCurrentPage(1);
        }}
        isOverdueOnly={isOverdueOnly}
        onOverdueChange={setIsOverdueOnly}
        isClientInactiveOnly={isClientInactiveOnly}
        onClientInactiveChange={setIsClientInactiveOnly}
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        priorityValue={selectedPriority}
        onPriorityChange={(val) => {
          setSelectedPriority(val);
          setCurrentPage(1);
        }}
        selectedClient={selectedClient}
        onClientChange={(val) => {
          setSelectedClient(val);
          setCurrentPage(1);
        }}
        clientOptions={clientOptions}
        onClearFilters={handleResetFilters}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />

      {/* Main Content: Table or Grid View */}
      {viewMode === 'table' ? (
        <JobsTableView
          jobs={jobs}
          isLoading={isLoading}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          onJobClick={handleJobClick}
          onOpenKanban={handleOpenKanban}
          onOpenEditDrawer={handleOpenEditDrawer}
          onOpenStatusModal={handleOpenStatusModal}
        />
      ) : (
        <JobsGridView
          jobs={jobs}
          isLoading={isLoading}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          onJobClick={handleJobClick}
          onOpenKanban={handleOpenKanban}
          onOpenEditDrawer={handleOpenEditDrawer}
          onOpenStatusModal={handleOpenStatusModal}
          onMessage={(userId) => navigate(`/manager/chat?user_id=${userId}`)}
          onResetFilters={handleResetFilters}
        />
      )}

      {/* SideDrawer: Create & Edit Job Form */}
      <JobFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        drawerMode={drawerMode}
        formData={formData}
        setFormData={setFormData}
        clientOptions={clientOptions}
        myTeamEmployees={myTeamEmployees}
        onSubmit={handleDrawerFormSubmit}
        isPending={createJobMutation.isPending || updateJobMutation.isPending}
      />

      {/* Modal: Change Job Status */}
      <JobStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        targetJob={statusTargetJob}
        newStatusValue={newStatusValue}
        setNewStatusValue={setNewStatusValue}
        statusReason={statusReason}
        setStatusReason={setStatusReason}
        onSubmit={handleStatusSubmit}
        isPending={changeJobStatusMutation.isPending}
      />
    </div>
  );
}