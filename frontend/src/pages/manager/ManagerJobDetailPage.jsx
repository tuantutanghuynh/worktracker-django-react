import React, { useState, useMemo } from 'react';
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
import DataTable from '../../components/common/table/DataTable';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import TaskDetailDrawer from './TaskDetailDrawer';
import ActivityFeedTimeline from '../../components/common/feeds/ActivityFeedTimeline';
import AuditDiffViewer from '../../components/common/drawer/AuditDiffViewer';
import { cn } from '../../utils/cn';

// Query Hooks
import { useManagerJobDetail, useChangeJobStatus } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerTasks, useCreateTask } from '../../hooks/queries/manager/useManagerTasks';
import { useTimeLocks } from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerAuditLogs } from '../../hooks/queries/manager/useManagerAuditLogs';

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

  const [activeTab, setActiveTab] = useState('tasks');

  // State Drawer & Modals
  const [createTaskDrawerOpen, setCreateTaskDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

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

  // 🚀 TANSTACK REACT QUERY HOOKS: Nạp dữ liệu đồng thời với caching & revalidation
  const { data: job, isLoading: jobLoading } = useManagerJobDetail(id);
  const { data: taskResponse, isLoading: tasksLoading } = useManagerTasks({ job_id: id });
  const { data: lockResponse } = useTimeLocks({ job_id: id });
  const { data: auditResponse } = useManagerAuditLogs({ job_id: id });

  const createTaskMutation = useCreateTask();
  const changeJobStatusMutation = useChangeJobStatus();

  // Chuẩn hóa dữ liệu trả về từ Query Hooks
  const tasks = useMemo(() => {
    if (Array.isArray(taskResponse)) return taskResponse;
    if (taskResponse && Array.isArray(taskResponse.results)) return taskResponse.results;
    return [];
  }, [taskResponse]);

  const timeLocks = useMemo(() => {
    if (Array.isArray(lockResponse)) return lockResponse;
    if (lockResponse && Array.isArray(lockResponse.results)) return lockResponse.results;
    return [];
  }, [lockResponse]);

  const auditLogs = useMemo(() => {
    const rawLogs = Array.isArray(auditResponse)
      ? auditResponse
      : auditResponse?.results || [];

    return rawLogs.map((log) => ({
      id: log.id,
      eventType: log.action || 'TASK_STATUS_CHANGED',
      title: `${log.action || 'UPDATE_RECORD'} by ${log.user?.full_name || log.user?.email || 'User'}`,
      description: log.summary || `Modified record #${log.record_id || log.id} in ${log.table_name || 'database'}`,
      timestamp: log.timestamp || log.created_at || new Date().toISOString(),
      user: log.user || { full_name: 'Manager System' },
      originalLog: log,
    }));
  }, [auditResponse]);

  // Xử lý Tạo Task Mới thuộc Job này
  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) return;

    createTaskMutation.mutate(
      {
        ...taskFormData,
        job_id: Number(id),
      },
      {
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
      }
    );
  };

  // Xử lý Đổi trạng thái Job (State Machine)
  const handleChangeStatus = (newStatus) => {
    changeJobStatusMutation.mutate({
      id,
      newStatus,
      reason: `Status changed to ${newStatus} by Manager`,
    });
  };

  // Xử lý mở Audit Diff Viewer khi bấm vào 1 sự kiện trên Timeline
  const handleSelectAuditLog = (timelineEvent) => {
    if (timelineEvent?.originalLog) {
      setSelectedAuditLog(timelineEvent.originalLog);
      setAuditDrawerOpen(true);
    }
  };

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-900">Project Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">The requested project ID #{id} does not exist or was deleted.</p>
        <button
          onClick={() => navigate('/manager/jobs')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
        >
          Back to Jobs List
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
          <span className="font-bold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0">
            {row.task_code || `TSK-${row.id}`}
          </span>
          <button
            onClick={() => setSelectedTaskId(row.id)}
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
          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase">
            {(row.assignee?.full_name || row.assignee?.email || 'U')[0]}
          </div>
          <span>{row.assignee?.full_name || row.assignee?.email || 'Unassigned'}</span>
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
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase', config[row.status] || 'bg-slate-100')}>
            {row.status}
          </span>
        );
      },
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (row) => (
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', row.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700')}>
          {row.priority}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      className: 'text-right',
      cell: (row) => (
        <button
          onClick={() => setSelectedTaskId(row.id)}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 cursor-pointer"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-slate-800 pb-12">
      {/* Header & Breadcrumb */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/manager/jobs')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Jobs List</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {job.job_code || `JOB-${job.id}`}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {job.status}
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">{job.job_name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{job.description || 'No description provided.'}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {job.status === 'PLANNING' && (
              <button
                onClick={() => handleChangeStatus('ACTIVE')}
                disabled={changeJobStatusMutation.isPending}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Start Project (Active)
              </button>
            )}

            {job.status === 'ACTIVE' && (
              <button
                onClick={() => handleChangeStatus('COMPLETED')}
                disabled={changeJobStatusMutation.isPending}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Mark as Completed
              </button>
            )}

            <button
              onClick={() => setCreateTaskDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3 border-b-2 font-bold text-xs transition-colors cursor-pointer',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'tasks' && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-100 text-slate-600">
                  {tasks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Tasks List */}
      {activeTab === 'tasks' && (
        <DataTable
          columns={taskColumns}
          data={tasks}
          isLoading={tasksLoading}
          onRowClick={(row) => setSelectedTaskId(row.id)}
          emptyMessage="No tasks found in this project. Click 'Add Task' to create one."
        />
      )}

      {/* TAB 2: Team & Workload */}
      {activeTab === 'team' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Assigned Team Members</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div key={task.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    {(task.assignee?.full_name || 'U')[0]}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-900">{task.assignee?.full_name || 'Unassigned'}</p>
                    <p className="text-[10px] text-slate-500">{task.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Period Locks */}
      {activeTab === 'timelocks' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Locked Work Periods</h3>
          {timeLocks.length === 0 ? (
            <p className="text-xs text-slate-500">No periods have been locked for this job.</p>
          ) : (
            <div className="space-y-2">
              {timeLocks.map((lock) => (
                <div key={lock.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">Period: {lock.lock_month}/{lock.lock_year}</span>
                    <p className="text-slate-500 text-[11px]">{lock.reason || 'Timesheet period locked'}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 font-bold rounded border border-rose-200">Locked</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Audit History */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
          <ActivityFeedTimeline
            events={auditLogs}
            onSelectEvent={handleSelectAuditLog}
          />
        </div>
      )}

      {/* Drawer: Form Tạo Task Mới */}
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

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={taskFormData.description}
              onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
              placeholder="Task details and instructions..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateTaskDrawerOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Task Detail Slide-over Drawer */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          isOpen={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

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