import React, { useState, useEffect, useCallback } from 'react';
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
import managerJobService from '../../services/manager/managerJobService';
import FilterToolbar from '../../components/common/table/FilterToolbar';
import DataTable from '../../components/common/table/DataTable';
import PaginationBar from '../../components/common/table/PaginationBar';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { cn } from '../../utils/cn';

// Địng nghĩa danh sách Trạng thái Job (English UI)
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
  const [searchParams, setSearchParams] = useSearchParams();

  // State Quản lý Dữ liệu
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // State cho Bộ lọc & Phân trang
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // State cho Drawer Tạo Job Mới
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    job_name: '',
    description: '',
    client_name: '',
    deadline: '',
    priority: 'MEDIUM',
  });

  // 1. Hàm nạp danh sách Jobs từ Backend API
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        search: searchQuery || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
      };
      const response = await managerJobService.getJobs(params);

      // Xử lý dữ liệu trả về theo chuẩn DRF Paginated Response
      if (response && Array.isArray(response.results)) {
        setJobs(response.results);
        setTotalItems(response.count || response.results.length);
      } else if (Array.isArray(response)) {
        setJobs(response);
        setTotalItems(response.length);
      } else {
        setJobs([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, selectedStatus, selectedPriority]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // 2. Xử lý Tạo Job Mới
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!formData.job_name.trim()) return;

    setSubmitting(true);
    try {
      await managerJobService.createJob(formData);
      setCreateDrawerOpen(false);
      setFormData({
        job_name: '',
        description: '',
        client_name: '',
        deadline: '',
        priority: 'MEDIUM',
      });
      fetchJobs(); // Reload danh sách sau khi tạo thành công
    } catch (err) {
      console.error('Failed to create job:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Render Màu Badge cho Trạng thái
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

  // 4. Render Màu Badge cho Mức độ Ưu tiên
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

  // 5. Cấu hình Cột Bảng DataTable
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
              className="font-bold text-slate-900 hover:text-blue-600 text-sm text-left transition-colors line-clamp-1"
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
          <span>{row.deadline ? new Date(row.deadline).toLocaleDateString() : 'N/A'}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => navigate(`/manager/jobs/${row.id}`)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects & Jobs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage master project pipelines, track progress, and assign team workloads.
          </p>
        </div>
        <button
          onClick={() => setCreateDrawerOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Job</span>
        </button>
      </div>

      {/* Filter & Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <FilterToolbar
          searchPlaceholder="Search by Job code, name, client..."
          searchValue={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          currentView={viewMode}
          onViewChange={setViewMode}
          viewModes={['table', 'grid']}
        >
          {/* Status Dropdown Filter */}
          <div className="w-44">
            <SelectDropdown
              options={STATUS_OPTIONS}
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              placeholder="All Statuses"
            />
          </div>

          {/* Priority Dropdown Filter */}
          <div className="w-44">
            <SelectDropdown
              options={PRIORITY_OPTIONS}
              value={selectedPriority}
              onChange={(val) => {
                setSelectedPriority(val);
                setCurrentPage(1);
              }}
              placeholder="All Priorities"
            />
          </div>
        </FilterToolbar>
      </div>

      {/* Main Content Area: Table View or Grid View */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <DataTable
            columns={columns}
            data={jobs}
            isLoading={loading}
            emptyMessage="No jobs found matching your filters."
          />
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => navigate(`/manager/jobs/${job.id}`)}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-slate-100 font-bold text-slate-600 text-xs">
                    {job.job_code || `JOB-${job.id}`}
                  </span>
                  {renderStatusBadge(job.status)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base line-clamp-1 hover:text-blue-600 transition-colors">
                    {job.job_name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {job.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate max-w-[120px]">
                    {job.client_name || 'Internal'}
                  </span>
                </div>
                {renderPriorityBadge(job.priority)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <PaginationBar
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* SideDrawer: Form Tạo Job Mới */}
      <SideDrawer
        isOpen={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        title="Create New Job"
        subtitle="Fill in project details to initialize a master job pipeline."
        size="md"
      >
        <form onSubmit={handleCreateJob} className="space-y-5 p-1">
          <InputField
            label="Job Name"
            placeholder="e.g. ERP System Implementation"
            value={formData.job_name}
            onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
            required
          />

          <InputField
            label="Client Name"
            placeholder="e.g. Acme Corporation"
            value={formData.client_name}
            onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Priority</label>
              <SelectDropdown
                options={PRIORITY_OPTIONS.filter((o) => o.value !== '')}
                value={formData.priority}
                onChange={(val) => setFormData({ ...formData, priority: val })}
              />
            </div>

            <InputField
              label="Deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter detailed project scope and objectives..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateDrawerOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}