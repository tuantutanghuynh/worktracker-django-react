import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Briefcase,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  MoreVertical,
  Eye,
  Edit3,
  Building2,
  Layers,
} from 'lucide-react';
import FilterToolbar from '../../components/common/table/FilterToolbar';
import DataTable from '../../components/common/table/DataTable';
import PaginationBar from '../../components/common/table/PaginationBar';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { cn } from '../../utils/cn';
import { useManagerJobs, useCreateJob } from '../../hooks/queries/manager/useManagerJobs';

// Định nghĩa danh sách Trạng thái Job (English UI)
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

export default function ManagerJobsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State cho Bộ lọc, Chế độ xem & Phân trang
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // State cho Drawer Tạo Job Mới
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [formData, setFormData] = useState({
    job_name: '',
    description: '',
    client_name: '',
    deadline: '',
    priority: 'MEDIUM',
  });

  // 🚀 TANSTACK REACT QUERY: Nạp danh sách Jobs tự động theo bộ lọc & phân trang
  const queryParams = useMemo(() => ({
    page: currentPage,
    page_size: pageSize,
    search: searchQuery || undefined,
    status: selectedStatus || undefined,
    priority: selectedPriority || undefined,
  }), [currentPage, pageSize, searchQuery, selectedStatus, selectedPriority]);

  const { data: response, isLoading } = useManagerJobs(queryParams);
  const createJobMutation = useCreateJob();

  // Chuẩn hóa dữ liệu trả về từ TanStack Query
  const jobs = useMemo(() => {
    if (response && Array.isArray(response.results)) return response.results;
    if (Array.isArray(response)) return response;
    return [];
  }, [response]);

  const totalItems = useMemo(() => {
    if (response && typeof response.count === 'number') return response.count;
    return jobs.length;
  }, [response, jobs]);

  // 🚀 MUTATION: Tạo Job mới với TanStack Query
  const handleCreateJob = (e) => {
    e.preventDefault();
    if (!formData.job_name.trim()) return;

    createJobMutation.mutate(formData, {
      onSuccess: () => {
        setCreateDrawerOpen(false);
        setFormData({
          job_name: '',
          description: '',
          client_name: '',
          deadline: '',
          priority: 'MEDIUM',
        });
      },
    });
  };

  // Render Màu Badge cho Trạng thái
  const renderStatusBadge = (status) => {
    const config = {
      ACTIVE: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Active' },
      PLANNING: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Planning' },
      COMPLETED: { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Completed' },
      ON_HOLD: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'On Hold' },
      CANCELLED: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Cancelled' },
    };
    const item = config[status] || { bg: 'bg-slate-50 text-slate-700 border-slate-200', label: status };
    return (
      <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', item.bg)}>
        {item.label}
      </span>
    );
  };

  // Render Màu Badge cho Mức độ Ưu tiên
  const renderPriorityBadge = (priority) => {
    const config = {
      HIGH: { bg: 'bg-rose-100 text-rose-800', label: 'High' },
      MEDIUM: { bg: 'bg-amber-100 text-amber-800', label: 'Medium' },
      LOW: { bg: 'bg-slate-100 text-slate-700', label: 'Low' },
    };
    const item = config[priority] || { bg: 'bg-slate-100 text-slate-700', label: priority };
    return (
      <span className={cn('px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider', item.bg)}>
        {item.label}
      </span>
    );
  };

  // Cấu hình Cột Bảng DataTable
  const columns = [
    {
      header: 'Job Code & Name',
      accessorKey: 'job_name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs shrink-0">
            {row.job_code || `JOB-${row.id}`}
          </div>
          <div>
            <button
              onClick={() => navigate(`/manager/jobs/${row.id}`)}
              className="font-bold text-slate-900 hover:text-blue-600 text-sm text-left transition-colors line-clamp-1 cursor-pointer"
            >
              {row.job_name}
            </button>
            <p className="text-xs text-slate-400 line-clamp-1">{row.description || 'No description provided'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Client',
      accessorKey: 'client_name',
      cell: (row) => (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.client_name || row.client?.name || 'Internal Project'}</span>
        </div>
      ),
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (row) => renderPriorityBadge(row.priority),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Deadline',
      accessorKey: 'deadline',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.deadline || 'No deadline'}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => navigate(`/manager/jobs/${row.id}`)}
            title="View Job Details"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 text-slate-800 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project / Job Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage projects, scope, deadlines, and task allocations.
          </p>
        </div>

        <button
          onClick={() => setCreateDrawerOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Job</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search jobs by name or code..."
        statusValue={selectedStatus}
        onStatusChange={(val) => {
          setSelectedStatus(val);
          setCurrentPage(1);
        }}
        statusOptions={STATUS_OPTIONS}
        priorityValue={selectedPriority}
        onPriorityChange={(val) => {
          setSelectedPriority(val);
          setCurrentPage(1);
        }}
        priorityOptions={PRIORITY_OPTIONS}
        currentView={viewMode}
        onViewChange={setViewMode}
        onClearFilters={() => {
          setSearchQuery('');
          setSelectedStatus('');
          setSelectedPriority('');
          setCurrentPage(1);
        }}
      />

      {/* Primary Display: Table or Grid */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={jobs}
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/manager/jobs/${row.id}`)}
          emptyMessage="No projects found matching your search criteria."
        />
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-44 bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse" />
            ))
          ) : jobs.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              No projects found.
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/manager/jobs/${job.id}`)}
                className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-blue-300 transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {job.job_code || `JOB-${job.id}`}
                  </span>
                  {renderStatusBadge(job.status)}
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{job.job_name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {job.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{job.deadline || 'No deadline'}</span>
                  </div>
                  {renderPriorityBadge(job.priority)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <PaginationBar
          page={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={Math.ceil(totalItems / pageSize)}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}

      {/* SideDrawer: Form Tạo Job Mới */}
      <SideDrawer
        isOpen={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        title="Create New Project / Job"
      >
        <form onSubmit={handleCreateJob} className="space-y-4 text-xs">
          <InputField
            label="Job Name *"
            value={formData.job_name}
            onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
            placeholder="e.g. ERP System Redesign 2026"
            required
          />

          <InputField
            label="Client Name"
            value={formData.client_name}
            onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
            placeholder="e.g. VinGroup / Internal"
          />

          <SelectDropdown
            label="Priority"
            value={formData.priority}
            onChange={(val) => setFormData({ ...formData, priority: val })}
            options={[
              { value: 'HIGH', label: 'High Priority' },
              { value: 'MEDIUM', label: 'Medium Priority' },
              { value: 'LOW', label: 'Low Priority' },
            ]}
          />

          <InputField
            label="Deadline Date"
            type="date"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
          />

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the job goals and deliverables..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateDrawerOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={createJobMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}