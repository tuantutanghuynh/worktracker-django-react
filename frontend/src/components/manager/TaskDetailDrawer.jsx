import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  MessageSquare,
  Paperclip,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Send,
  Upload,
  Download,
  Flame,
  UserCheck,
  UserMinus,
  Save,
  Briefcase,
  Layers,
  ArrowRight,
  RotateCcw,
  Edit3,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import SideDrawer from '../common/drawer/SideDrawer';
import InputField from '../common/forms/InputField';
import SelectDropdown from '../common/forms/SelectDropdown';
import BaseModal from '../common/modal/BaseModal';
import UserAvatar from '../common/avatar/UserAvatar';
import { cn } from '../../utils/cn';

// Query Hooks & Stores
import { useUIStore } from '../../stores/useUIStore';
import {
  useManagerTaskDetail,
  useUpdateTask,
  useApproveTask,
  useRejectTask,
  useCancelTask,
  useChangeTaskStatus,
  useTaskComments,
  useCreateTaskComment,
  useTaskAttachments,
  useUploadTaskAttachment,
  useTaskFollowers,
  useFollowTask,
  useUnfollowTask,
} from '../../hooks/queries/manager/useManagerTasks';
import { useLogWorks } from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';

// Helper format ngày
function formatDateSafe(dateStr, pattern = 'dd/MM/yyyy') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

// Helper format dung lượng file
function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function TaskDetailDrawer() {
  const navigate = useNavigate();
  const { taskDrawerOpen, closeTaskDrawer, selectedTaskId } = useUIStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);

  // Reset isEditing when selectedTaskId changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedTaskId]);

  // Form State cho Overview
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    priority: 'MEDIUM',
    deadline: '',
  });

  // State cho Reject Task Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // State cho Cancel Task Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // State cho Comment input
  const [commentInput, setCommentInput] = useState('');

  // Ref cho file upload
  const fileInputRef = useRef(null);

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: task, isLoading: taskLoading } = useManagerTaskDetail(selectedTaskId);
  const { data: logWorksResponse } = useLogWorks({ task_id: selectedTaskId });
  const { data: commentsResponse = [] } = useTaskComments(selectedTaskId);
  const { data: attachmentsResponse = [] } = useTaskAttachments(selectedTaskId);
  const { data: followersResponse = [] } = useTaskFollowers(selectedTaskId);
  const { data: employeesResponse = [] } = useManagerEmployees();

  // Mutations
  const updateTaskMutation = useUpdateTask();
  const approveTaskMutation = useApproveTask();
  const rejectTaskMutation = useRejectTask();
  const cancelTaskMutation = useCancelTask();
  const changeTaskStatusMutation = useChangeTaskStatus();
  const createCommentMutation = useCreateTaskComment(selectedTaskId);
  const uploadAttachmentMutation = useUploadTaskAttachment(selectedTaskId);
  const followTaskMutation = useFollowTask(selectedTaskId);
  const unfollowTaskMutation = useUnfollowTask(selectedTaskId);

  // Đồng bộ Form khi nạp xong Task
  useEffect(() => {
    if (task) {
      setEditFormData({
        title: task.title || '',
        description: task.description || '',
        assignee_id: task.assignee?.id ? String(task.assignee.id) : '',
        priority: task.priority || 'MEDIUM',
        deadline: task.deadline || '',
      });
    }
  }, [task]);

  // Danh sách Employee cho Assignee Select
  const employeeOptions = useMemo(() => {
    const list = Array.isArray(employeesResponse)
      ? employeesResponse
      : employeesResponse.results || [];
    return list.map((emp) => ({
      value: String(emp.user_id || emp.id),
      label: `${emp.full_name || emp.email} (${emp.department_name || 'Staff'})`,
    }));
  }, [employeesResponse]);

  // Chuẩn hóa LogWorks
  const logWorks = useMemo(() => {
    if (Array.isArray(logWorksResponse)) return logWorksResponse;
    if (logWorksResponse && Array.isArray(logWorksResponse.results)) return logWorksResponse.results;
    return [];
  }, [logWorksResponse]);

  // Tính tổng giờ làm đã log vào task này
  const totalLoggedHours = useMemo(() => {
    return logWorks.reduce((sum, item) => sum + (parseFloat(item.hours_spent) || 0), 0);
  }, [logWorks]);

  // Chuẩn hóa Comments
  const comments = useMemo(() => {
    if (Array.isArray(commentsResponse)) return commentsResponse;
    if (commentsResponse && Array.isArray(commentsResponse.results)) return commentsResponse.results;
    return [];
  }, [commentsResponse]);

  // Chuẩn hóa Attachments
  const attachments = useMemo(() => {
    if (Array.isArray(attachmentsResponse)) return attachmentsResponse;
    if (attachmentsResponse && Array.isArray(attachmentsResponse.results)) return attachmentsResponse.results;
    return [];
  }, [attachmentsResponse]);

  // Chuẩn hóa Followers
  const followers = useMemo(() => {
    if (Array.isArray(followersResponse)) return followersResponse;
    if (followersResponse && Array.isArray(followersResponse.results)) return followersResponse.results;
    return [];
  }, [followersResponse]);

  // Check xem Manager hiện tại có đang Follow task này không
  const isFollowing = useMemo(() => {
    return followers.some((f) => f.is_current_user || f.email === task?.creator?.email);
  }, [followers, task]);

  // Xử lý Cập nhật Task
  const handleUpdateTask = (e) => {
    e.preventDefault();
    if (!editFormData.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    const payload = {
      title: editFormData.title.trim(),
      description: editFormData.description.trim() || '',
      assignee_id: editFormData.assignee_id ? Number(editFormData.assignee_id) : null,
      priority: editFormData.priority,
      deadline: editFormData.deadline || null,
    };

    updateTaskMutation.mutate({
      id: selectedTaskId,
      data: payload,
    });
  };

  // Xử lý Duyệt Task
  const handleApprove = () => {
    approveTaskMutation.mutate(selectedTaskId);
  };

  // Xử lý Từ chối Task
  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejecting this task.');
      return;
    }

    rejectTaskMutation.mutate(
      {
        id: selectedTaskId,
        reason: rejectionReason.trim(),
      },
      {
        onSuccess: () => {
          setRejectModalOpen(false);
          setRejectionReason('');
        },
      }
    );
  };

  // Xử lý Hủy Task
  const handleCancelSubmit = (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancelling this task.');
      return;
    }

    cancelTaskMutation.mutate(
      {
        id: selectedTaskId,
        reason: cancelReason.trim(),
      },
      {
        onSuccess: () => {
          setCancelModalOpen(false);
          setCancelReason('');
        },
      }
    );
  };

  // Xử lý Gửi Comment
  const handleSendComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    createCommentMutation.mutate(commentInput.trim(), {
      onSuccess: () => {
        setCommentInput('');
      },
    });
  };

  // Xử lý Upload File
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds 20MB limit.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    uploadAttachmentMutation.mutate(formData, {
      onSuccess: () => {
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  if (!taskDrawerOpen) return null;

  return (
    <SideDrawer
      isOpen={taskDrawerOpen}
      onClose={closeTaskDrawer}
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-xs text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
            {task?.task_code || `TSK-${selectedTaskId}`}
          </span>
          <span className="font-bold text-slate-900 text-sm truncate max-w-[260px]">
            {task?.title || 'Task Details'}
          </span>
        </div>
      }
      subtitle={
        task?.job ? (
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <span>{task.job.job_code || `JOB-${task.job.id}`}: {task.job.job_name}</span>
          </span>
        ) : (
          'Task Details & Deliverable Management'
        )
      }
      size="xl"
    >
      {taskLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-xs text-slate-400 font-medium">Loading task data...</p>
        </div>
      ) : !task ? (
        <div className="p-8 text-center text-xs text-slate-500">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p>Task #{selectedTaskId} not found or access denied.</p>
        </div>
      ) : (
        <div className="space-y-4 text-xs text-slate-700">
          
          {/* 🌟 1. BANNER TRẠNG THÁI GỌN GÀNG (NẾU REVIEWING / COMPLETED / CANCELLED) */}
          {task.status === 'REVIEWING' && (
            <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-purple-950 text-xs truncate">Task Deliverable in QA Review Queue</p>
                  <p className="text-[11px] text-purple-700 truncate">
                    Assignee <strong>{task.assignee?.full_name || 'Employee'}</strong> has submitted work for inspection.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeTaskDrawer();
                  navigate('/manager/tasks/review');
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
              >
                <span>Go to QA Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {task.status === 'COMPLETED' && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-emerald-950 text-xs">Task Completed & QA Verified</p>
                  <p className="text-[11px] text-emerald-700 font-mono">
                    Completed at {formatDateSafe(task.completed_at || task.updated_at, 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  changeTaskStatusMutation.mutate({
                    id: selectedTaskId,
                    toStatus: 'IN_PROGRESS',
                    reason: 'Reopened for additional rework by Manager',
                  })
                }
                disabled={changeTaskStatusMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg border border-slate-200 text-xs shadow-2xs transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                <span>Reopen for Rework</span>
              </button>
            </div>
          )}

          {task.status === 'CANCELLED' && (
            <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-rose-950 text-xs">Task is Cancelled</p>
                  <p className="text-[11px] text-rose-700">This deliverable is currently cancelled.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  changeTaskStatusMutation.mutate({
                    id: selectedTaskId,
                    toStatus: 'TODO',
                    reason: 'Task reactivated to To Do by Manager',
                  })
                }
                disabled={changeTaskStatusMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore to TODO</span>
              </button>
            </div>
          )}

          {/* 📋 2. THANH THUỘC TÍNH CỐT LÕI (4-COLUMN CLEAN STRIP) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
            <div>
              <span className="text-slate-400 font-semibold text-[11px] block">Status</span>
              <span
                className={cn(
                  'inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider',
                  task.status === 'TODO' && 'bg-blue-50 text-blue-700 border-blue-200',
                  task.status === 'IN_PROGRESS' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  task.status === 'REVIEWING' && 'bg-purple-50 text-purple-700 border-purple-200',
                  task.status === 'COMPLETED' && 'bg-orange-50 text-orange-700 border-orange-200',
                  task.status === 'CANCELLED' && 'bg-rose-50 text-rose-700 border-rose-200'
                )}
              >
                {task.status}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-semibold text-[11px] block">Priority</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-extrabold uppercase border',
                  task.priority === 'HIGH'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                )}
              >
                {task.priority === 'HIGH' && <Flame className="w-3 h-3 text-rose-500" />}
                {task.priority || 'MEDIUM'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-semibold text-[11px] block">Assignee</span>
              <div className="flex items-center gap-1.5 mt-1">
                {task.assignee && <UserAvatar user={task.assignee} size="xs" />}
                <span className="font-bold text-slate-900 text-xs truncate max-w-[120px]">
                  {task.assignee?.full_name || task.assignee?.email || 'Unassigned'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-semibold text-[11px] block">Deadline</span>
              <div className="flex items-center gap-1.5 mt-1 text-slate-800 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono font-bold text-xs">{formatDateSafe(task.deadline)}</span>
              </div>
            </div>
          </div>

          {/* 🗂️ 3. NAVIGATION TABS BAR */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto custom-scrollbar">
            {[
              { id: 'overview', label: 'Overview', icon: FileText },
              { id: 'worklogs', label: 'Work Logs', icon: Clock, count: logWorks.length },
              { id: 'comments', label: 'Comments', icon: MessageSquare, count: comments.length },
              { id: 'attachments', label: 'Attachments', icon: Paperclip, count: attachments.length },
              { id: 'followers', label: 'Followers', icon: Users, count: followers.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer shrink-0',
                    isActive
                      ? 'bg-blue-50 text-blue-600 border border-blue-200/80 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200/80 text-slate-700 font-bold">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 📌 TAB 1: OVERVIEW (VIEW MODE & EDIT MODE TÁCH BẠCH) */}
          {activeTab === 'overview' && (
            !isEditing ? (
              <div className="space-y-4 text-xs">
                
                {/* Header Row: Title & Edit CTA */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Task Scope & Description
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit Task</span>
                  </button>
                </div>

                {/* Task Description Body */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-slate-800 leading-relaxed text-xs sm:text-sm min-h-[100px] font-normal">
                  {task.description || (
                    <span className="italic text-slate-400">No detailed description provided for this deliverable.</span>
                  )}
                </div>

                {/* Audit & Effort Metadata Card */}
                <div className="p-4 bg-slate-50/60 border border-slate-200/80 rounded-2xl space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Total Logged Effort:</span>
                    <span className="font-extrabold text-blue-700 text-xs bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                      {totalLoggedHours.toFixed(1)} hrs
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="font-medium text-slate-500">Created By:</span>
                    <span className="font-bold text-slate-800">
                      {task.creator?.full_name || task.creator?.email || 'Alexander Wright (Manager)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Created At:</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {formatDateSafe(task.created_at, 'HH:mm - dd/MM/yyyy')}
                    </span>
                  </div>

                  {task.completed_at && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Completed At:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatDateSafe(task.completed_at, 'HH:mm - dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Cancel Task Link */}
                {task.status !== 'CANCELLED' && task.status !== 'COMPLETED' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setCancelReason('');
                        setCancelModalOpen(true);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-700 font-bold transition hover:underline cursor-pointer"
                    >
                      Cancel this task
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleUpdateTask} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Editing Task Details</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-bold hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <InputField
                  label="Task Title *"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="Task title..."
                  required
                />

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign to Employee</label>
                  <select
                    value={editFormData.assignee_id}
                    onChange={(e) => setEditFormData({ ...editFormData, assignee_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={editFormData.priority}
                    onChange={(val) => setEditFormData({ ...editFormData, priority: val })}
                    options={[
                      { value: 'HIGH', label: 'High Priority' },
                      { value: 'MEDIUM', label: 'Medium Priority' },
                      { value: 'LOW', label: 'Low Priority' },
                    ]}
                  />

                  <InputField
                    label="Deadline"
                    type="date"
                    value={editFormData.deadline}
                    onChange={(e) => setEditFormData({ ...editFormData, deadline: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description & Acceptance Criteria</label>
                  <textarea
                    rows={5}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="Detailed task instructions..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateTaskMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition text-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{updateTaskMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            )
          )}

          {/* ⏱️ TAB 2: WORK LOGS */}
          {activeTab === 'worklogs' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-blue-900 text-xs">Accumulated Work Hours</h4>
                  <p className="text-[11px] text-blue-700">Total verified hours logged on this deliverable</p>
                </div>
                <span className="text-base font-extrabold text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-2xs">
                  {totalLoggedHours.toFixed(1)} hrs
                </span>
              </div>

              {logWorks.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-600">No work logs recorded yet.</p>
                  <p className="text-[11px]">When team members submit timesheets for this task, entries will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                  {logWorks.map((lw) => (
                    <div
                      key={lw.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserAvatar user={lw.user || { full_name: lw.employee_name }} size="xs" />
                          <div>
                            <span className="font-bold text-slate-900 text-xs">
                              {lw.employee_name || lw.user?.email || 'Employee'}
                            </span>
                            <span className="text-slate-400 text-[10px] ml-2">
                              {formatDateSafe(lw.work_date)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                            {lw.hours_spent}h
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase',
                              lw.review_status === 'APPROVED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                              lw.review_status === 'PENDING' && 'bg-amber-50 text-amber-700 border-amber-200',
                              lw.review_status === 'REJECTED' && 'bg-rose-50 text-rose-700 border-rose-200'
                            )}
                          >
                            {lw.review_status}
                          </span>
                        </div>
                      </div>

                      {lw.description && (
                        <p className="text-slate-600 text-[11px] leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {lw.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 💬 TAB 3: COMMENTS */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                {comments.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">
                    No comments yet. Start the conversation below!
                  </p>
                ) : (
                  comments.map((cm) => {
                    const isRejection = cm.comment_type === 'REJECTION_NOTE';
                    return (
                      <div
                        key={cm.id}
                        className={cn(
                          'p-3.5 rounded-xl border space-y-1.5 shadow-2xs',
                          isRejection
                            ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                            : 'bg-white border-slate-200 text-slate-800'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserAvatar user={cm.user} size="xs" />
                            <span className="font-bold text-xs">
                              {cm.user?.full_name || cm.user?.email || 'User'}
                            </span>
                            {isRejection && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-200 text-rose-800">
                                Rejection Note
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {formatDateSafe(cm.created_at, 'HH:mm • dd/MM')}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed pl-8 whitespace-pre-wrap">{cm.content}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Form Gửi Comment */}
              <form onSubmit={handleSendComment} className="pt-2 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Write a comment or note..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || createCommentMutation.isPending}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* 📎 TAB 4: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl text-center space-y-1.5 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition"
              >
                <Upload className="w-6 h-6 text-blue-500 mx-auto" />
                <p className="font-bold text-slate-800 text-xs">Click to upload attachment</p>
                <p className="text-[10px] text-slate-400">Supports PDF, PNG, JPG, ZIP (Max 20MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Attachments List */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {attachments.length === 0 ? (
                  <p className="text-center text-slate-400 py-6">No attachments uploaded yet.</p>
                ) : (
                  attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate max-w-[240px]">
                            {att.file_name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatBytes(att.file_size)} • {formatDateSafe(att.uploaded_at)}
                          </p>
                        </div>
                      </div>

                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 👥 TAB 5: FOLLOWERS */}
          {activeTab === 'followers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Task Subscriptions</h4>
                  <p className="text-[10px] text-slate-500">Receive notifications on updates and comments</p>
                </div>

                <button
                  onClick={() => (isFollowing ? unfollowTaskMutation.mutate() : followTaskMutation.mutate())}
                  disabled={followTaskMutation.isPending || unfollowTaskMutation.isPending}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition cursor-pointer',
                    isFollowing
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Follow Updates</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                {followers.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        {(f.full_name || f.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-900">{f.full_name}</p>
                        <p className="text-[10px] text-slate-400">{f.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Joined {formatDateSafe(f.joined_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Từ chối nghiệm thu Task (Reject Task) */}
      <BaseModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Deliverable Review"
        description={`Send task "${task?.title}" back to In Progress for revision.`}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-rose-700 mb-1">
              Rejection Reason & Required Fixes *
            </label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain clearly what needs to be fixed before this task can be approved..."
              required
              className="w-full bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rejectTaskMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
            >
              {rejectTaskMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* Modal: Hủy Task (Cancel Task) */}
      <BaseModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Task"
        description={`Mark task "${task?.title}" as cancelled.`}
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-rose-700 mb-1">
              Cancellation Reason *
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Explain why this task is no longer required..."
              required
              className="w-full bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={cancelTaskMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
            >
              {cancelTaskMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </form>
      </BaseModal>
    </SideDrawer>
  );
}
