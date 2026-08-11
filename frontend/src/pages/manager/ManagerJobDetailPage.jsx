import React, { useState, useEffect, useCallback } from 'react';
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
  Play,
  CheckSquare,
} from 'lucide-react';
import managerJobService from '../../services/manager/managerJobService';
import managerTaskService from '../../services/manager/managerTaskService';
import managerTimesheetService from '../../services/manager/managerTimesheetService';
import DataTable from '../../components/common/table/DataTable';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import TaskDetailDrawer from './TaskDetailDrawer';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';
import { cn } from '../../utils/cn';

// Danh sách các Tab trong trang Chi tiết Job
const TABS = [
  { id: 'tasks', label: 'Tasks List', icon: CheckSquare },
  { id: 'team', label: 'Team & Workload', icon: Users },
  { id: 'timelocks', label: 'Period Locks', icon: Lock },
  { id: 'audit', label: 'Audit History', icon: History },
];

export default function ManagerJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // State Dữ liệu Job & Task
  const [job, setJob] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timeLocks, setTimeLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');

  // State Drawer & Modals
  const [createTaskDrawerOpen, setCreateTaskDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State tạo Task mới
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    priority: 'MEDIUM',
    deadline: '',
  });

  // 1. Fetch thông tin Chi tiết Job
  const fetchJobDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await managerJobService.getJobDetail(id);
      setJob(data);

      // Fetch danh sách Task con thuộc Job này
      const taskData = await managerTaskService.getTasks({ job_id: id });
      setTasks(Array.isArray(taskData) ? taskData : taskData.results || []);

      // Fetch danh sách TimeLocks thuộc Job này
      const lockData = await managerTimesheetService.getTimeLocks({ job_id: id });
      setTimeLocks(Array.isArray(lockData) ? lockData : lockData.results || []);
    } catch (err) {
      console.error('Failed to fetch job detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJobDetail();
  }, [fetchJobDetail]);

  // 2. Xử lý Đổi trạng thái Job (PLANNING -> ACTIVE -> COMPLETED)
  const handleChangeStatus = async (newStatus) => {
    try {
      await managerJobService.changeJobStatus(id, newStatus);
      fetchJobDetail();
    } catch (err) {
      console.error('Failed to change job status:', err);
    }
  };

  // 3. Xử lý Tạo Task con mới
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) return;

    setSubmitting(true);
    try {
      await managerTaskService.createTask({
        ...taskFormData,
        job_id: id,
      });
      setCreateTaskDrawerOpen(false);
      setTaskFormData({
        title: '',
        description: '',
        assignee_id: '',
        priority: 'MEDIUM',
        deadline: '',
      });
      fetchJobDetail(); // Reload danh sách Task sau khi tạo
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Render Badge Trạng thái
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
      <span className={cn('px-3 py-1 rounded-full text-xs font-semibold border', item.bg)}>
        {item.label}
      </span>
    );
  };

  // Cấu hình Cột Bảng Task con
  const taskColumns = [
    {
      header: 'Task Title',
      accessorKey: 'title',
      cell: (row) => (
        <div>
          <button
            onClick={() => setSelectedTaskId(row.id)}
            className="font-bold text-slate-900 hover:text-blue-600 text-sm text-left transition-colors line-clamp-1"
          >
            {row.title}
          </button>
          <p className="text-xs text-slate-400 line-clamp-1">{row.description || 'No details provided'}</p>
        </div>
      ),
    },
    {
      header: 'Assignee',
      accessorKey: 'assignee',
      cell: (row) => (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-600">
            {row.assignee?.full_name ? row.assignee.full_name.substring(0, 2).toUpperCase() : 'UN'}
          </div>
          <span>{row.assignee?.full_name || 'Unassigned'}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {row.status}
        </span>
      ),
    },
    {
      header: 'Deadline',
      accessorKey: 'deadline',
      cell: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.deadline ? new Date(row.deadline).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      cell: (row) => (
        <button
          onClick={() => setSelectedTaskId(row.id)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="View Task Details"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium animate-pulse">
        Loading Job Details...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Job Not Found</h2>
        <p className="text-xs text-slate-500">The requested job ID does not exist or has been removed.</p>
        <button
          onClick={() => navigate('/manager/jobs')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
        >
          Back to Jobs List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/manager/jobs')}
          className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          title="Back to Jobs List"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            {job.job_code || `JOB-${job.id}`}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{job.job_name}</h1>
        </div>
      </div>

      {/* Master Overview Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            {renderStatusBadge(job.status)}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Client: <strong className="text-slate-700">{job.client_name || 'Internal'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Deadline: <strong className="text-slate-700">{job.deadline ? new Date(job.deadline).toLocaleDateString() : 'N/A'}</strong></span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {job.status === 'PLANNING' && (
              <button
                onClick={() => handleChangeStatus('ACTIVE')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Job</span>
              </button>
            )}
            {job.status === 'ACTIVE' && (
              <button
                onClick={() => handleChangeStatus('COMPLETED')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete Job</span>
              </button>
            )}
            <button
              onClick={() => setCreateTaskDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          {job.description || 'No detailed description provided for this job.'}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3 border-b-2 font-semibold text-xs transition-colors',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Rendering */}
      <div className="space-y-4">
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <DataTable
              columns={taskColumns}
              data={tasks}
              emptyMessage="No tasks created under this job yet."
            />
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Assigned Team Members</h3>
            <p className="text-xs text-slate-500">List of employees assigned to tasks under this job pipeline.</p>
            {/* Component Team List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {tasks.map((t) => t.assignee).filter(Boolean).map((member, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {member.full_name ? member.full_name.substring(0, 2).toUpperCase() : 'EM'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{member.full_name}</p>
                    <p className="text-[10px] text-slate-400">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'timelocks' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Job Period Locks</h3>
                <p className="text-xs text-slate-500">Monthly locked periods preventing timesheet modification.</p>
              </div>
            </div>
            <div className="space-y-2">
              {timeLocks.length > 0 ? (
                timeLocks.map((lock) => (
                  <div key={lock.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-slate-800">Month {lock.lock_month} / {lock.lock_year}</span>
                    </div>
                    <span className="text-slate-400">Locked by Manager #{lock.locked_by}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No periods have been locked for this job yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
            <AuditDiffViewer
              oldValues={{ status: 'PLANNING', priority: 'MEDIUM' }}
              newValues={{ status: job.status, priority: job.priority }}
            />
          </div>
        )}
      </div>

      {/* SideDrawer: Form Tạo Task mới */}
      <SideDrawer
        isOpen={createTaskDrawerOpen}
        onClose={() => setCreateTaskDrawerOpen(false)}
        title="Create New Task"
        subtitle={`Add a new task under job "${job.job_name}"`}
        size="md"
      >
        <form onSubmit={handleCreateTask} className="space-y-5 p-1">
          <InputField
            label="Task Title"
            placeholder="e.g. Design Database Schema"
            value={taskFormData.title}
            onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
            required
          />

          <InputField
            label="Deadline"
            type="date"
            value={taskFormData.deadline}
            onChange={(e) => setTaskFormData({ ...taskFormData, deadline: e.target.value })}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea
              rows={4}
              value={taskFormData.description}
              onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
              placeholder="Task details and deliverables..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateTaskDrawerOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Task Detail SideDrawer khi chọn 1 Task */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          isOpen={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}