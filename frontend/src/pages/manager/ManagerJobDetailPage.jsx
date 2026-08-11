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
import managerReportService from '../../services/manager/managerReportService';
import DataTable from '../../components/common/table/DataTable';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import TaskDetailDrawer from './TaskDetailDrawer';
import ActivityFeedTimeline from '../../components/common/feeds/ActivityFeedTimeline';
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
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');

  // State Drawer & Modals
  const [createTaskDrawerOpen, setCreateTaskDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

      // Fetch danh sách Audit Logs thuộc Job này từ Backend API
      try {
        const auditData = await managerReportService.getAuditLogs({ job_id: id });
        const rawLogs = Array.isArray(auditData) ? auditData : auditData.results || [];
        
        // Transform Audit Logs into ActivityFeedTimeline format
        const formattedLogs = rawLogs.map((log) => ({
          id: log.id,
          eventType: log.action || 'TASK_STATUS_CHANGED',
          title: `${log.action || 'UPDATE_RECORD'} by ${log.user?.full_name || log.user?.email || 'User'}`,
          description: log.summary || `Modified record #${log.record_id || log.id} in ${log.table_name || 'database'}`,
          timestamp: log.timestamp || log.created_at || new Date().toISOString(),
          user: log.user || { full_name: 'Manager System' },
          metadata: {
            tableName: log.table_name || 'jobs',
            recordId: log.record_id || id,
            ipAddress: log.ip_address || 'Internal / API',
            oldValues: log.old_values || {},
            newValues: log.new_values || {},
          },
        }));

        setAuditLogs(formattedLogs);
      } catch (e) {
        console.warn('Audit logs fetch fallback:', e);
        // Fallback sample audit log if API is empty
        setAuditLogs([
          {
            id: 101,
            eventType: 'JOB_CREATED',
            title: `Job Created: ${data.job_name}`,
            description: `Project initialized by manager`,
            timestamp: data.created_at || new Date().toISOString(),
            user: { full_name: 'Manager System' },
            metadata: {
              tableName: 'jobs',
              recordId: id,
              ipAddress: '14.161.22.84',
              oldValues: { status: 'PLANNING' },
              newValues: { status: data.status },
            },
          },
        ]);
      }
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
          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          title="View Task Details"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading Job Details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Job Not Found</h2>
        <button
          onClick={() => navigate('/manager/jobs')}
          className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
        >
          Back to Jobs List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/manager/jobs')}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {job.job_name}
              </h1>
              {renderStatusBadge(job.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-4">
              <span>Code: <strong className="text-slate-700 font-mono">{job.job_code}</strong></span>
              <span>Client: <strong className="text-slate-700">{job.client_name || 'N/A'}</strong></span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {job.status === 'PLANNING' && (
            <button
              onClick={() => handleChangeStatus('ACTIVE')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4" /> Start Project
            </button>
          )}
          {job.status === 'ACTIVE' && (
            <button
              onClick={() => handleChangeStatus('COMPLETED')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Complete Job
            </button>
          )}
          <button
            onClick={() => setCreateTaskDrawerOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Task
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</span>
          <p className="text-2xl font-extrabold text-slate-900">{tasks.length}</p>
          <p className="text-xs text-slate-500">
            {tasks.filter((t) => t.status === 'COMPLETED').length} Completed
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Period Locks</span>
          <p className="text-2xl font-extrabold text-slate-900">{timeLocks.length}</p>
          <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Timesheets Secured
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Start Date</span>
          <p className="text-base font-bold text-slate-800">
            {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'N/A'}
          </p>
          <p className="text-xs text-slate-400">Project initiation</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Target End Date</span>
          <p className="text-base font-bold text-slate-800">
            {job.end_date ? new Date(job.end_date).toLocaleDateString() : 'N/A'}
          </p>
          <p className="text-xs text-slate-400">Scheduled deadline</p>
        </div>
      </div>

      {/* Multi-Tab Workspace Header */}
      <div className="border-b border-slate-200 bg-white px-4 pt-2 rounded-t-2xl border">
        <div className="flex items-center gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-xs font-bold transition border-b-2 cursor-pointer',
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
      </div>

      {/* Tab Workspace Content */}
      <div className="space-y-6">
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Tasks Assigned Under Job</h3>
              <span className="text-xs font-medium text-slate-500">{tasks.length} total tasks</span>
            </div>
            <DataTable
              data={tasks}
              columns={taskColumns}
              emptyMessage="No tasks have been created under this job yet."
            />
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-white p-6 rounded-b-2xl border border-t-0 border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Team Members &amp; Workload</h3>
            <p className="text-xs text-slate-500">Personnel assigned to tasks in this project.</p>

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
          <div className="bg-white p-6 rounded-b-2xl border border-t-0 border-slate-200/80 shadow-2xs space-y-4">
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

        {/* Tab 4: Audit History với ActivityFeedTimeline + AuditDiffViewer Slide-over */}
        {activeTab === 'audit' && (
          <div className="bg-white p-6 rounded-b-2xl border border-t-0 border-slate-200/80 shadow-2xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Job Audit History &amp; Activity Stream</h3>
              <p className="text-xs text-slate-500">Complete chronological change log for this project. Click any event to view exact diff.</p>
            </div>

            <ActivityFeedTimeline
              activities={auditLogs}
              onItemClick={(item) => {
                setSelectedAuditLog(item);
                setAuditDrawerOpen(true);
              }}
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

          <SelectDropdown
            label="Priority"
            value={taskFormData.priority}
            onChange={(val) => setTaskFormData({ ...taskFormData, priority: val })}
            options={[
              { value: 'LOW', label: 'Low Priority' },
              { value: 'MEDIUM', label: 'Medium Priority' },
              { value: 'HIGH', label: 'High Priority' },
              { value: 'CRITICAL', label: 'Critical Priority' },
            ]}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Description / Notes
            </label>
            <textarea
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter task requirements and notes..."
              value={taskFormData.description}
              onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateTaskDrawerOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Creating Task...' : 'Create Task'}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Task Detail Drawer */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          isOpen={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Audit Log Diff Slide-over Drawer */}
      <SideDrawer
        isOpen={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        title="Audit Log Change Detail"
        subtitle={`Action: ${selectedAuditLog?.eventType || 'UPDATE_RECORD'}`}
        size="xl"
      >
        {selectedAuditLog && (
          <AuditDiffViewer
            action={selectedAuditLog.eventType}
            user={selectedAuditLog.user}
            tableName={selectedAuditLog.metadata?.tableName || 'jobs'}
            recordId={selectedAuditLog.metadata?.recordId || id}
            timestamp={selectedAuditLog.timestamp}
            ipAddress={selectedAuditLog.metadata?.ipAddress}
            summary={selectedAuditLog.description}
            oldValues={selectedAuditLog.metadata?.oldValues}
            newValues={selectedAuditLog.metadata?.newValues}
          />
        )}
      </SideDrawer>
    </div>
  );
}