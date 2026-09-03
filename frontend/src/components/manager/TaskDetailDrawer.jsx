import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Briefcase,
  AlertCircle,
  Clock,
  MessageSquare,
  Paperclip,
  Users,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import SideDrawer from '../common/drawer/SideDrawer';
import TaskDrawerHeader from './task-drawer/TaskDrawerHeader';
import TaskOverviewTab from './task-drawer/TaskOverviewTab';
import TaskCommentsTab from './task-drawer/TaskCommentsTab';
import TaskAttachmentsTab from './task-drawer/TaskAttachmentsTab';
import TaskTimesheetsTab from './task-drawer/TaskTimesheetsTab';
import TaskFollowersTab from './task-drawer/TaskFollowersTab';
import {
  TaskRejectModal,
  TaskCancelModal,
  TaskDeleteModal,
} from './task-drawer/TaskWorkflowModals';

import { useUIStore } from '../../stores/useUIStore';
import { cn } from '../../utils/cn';

// Query Hooks & Mutations
import {
  useManagerTaskDetail,
  useUpdateTask,
  useApproveTask,
  useRejectTask,
  useCancelTask,
  useDeleteTask,
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

function formatDateSafe(dateStr) {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function TaskDetailDrawer() {
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

  // State cho Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // State cho Comment input & File ref
  const [commentInput, setCommentInput] = useState('');
  const fileInputRef = useRef(null);

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: task, isLoading: taskLoading } = useManagerTaskDetail(selectedTaskId);
  const { data: logWorksResponse } = useLogWorks({ task_id: selectedTaskId });
  const { data: commentsResponse = [] } = useTaskComments(selectedTaskId);
  const { data: attachmentsResponse = [] } = useTaskAttachments(selectedTaskId);
  const { data: followersResponse = [] } = useTaskFollowers(selectedTaskId);
  const { data: employeesResponse = [] } = useManagerEmployees(task?.job?.id ? { job_id: task.job.id } : {});

  // Mutations
  const updateTaskMutation = useUpdateTask();
  const rejectTaskMutation = useRejectTask();
  const cancelTaskMutation = useCancelTask();
  const deleteTaskMutation = useDeleteTask();
  const changeTaskStatusMutation = useChangeTaskStatus();
  const createCommentMutation = useCreateTaskComment(selectedTaskId);
  const uploadAttachmentMutation = useUploadTaskAttachment(selectedTaskId);
  const followTaskMutation = useFollowTask(selectedTaskId);
  const unfollowTaskMutation = useUnfollowTask(selectedTaskId);

  // Đồng bộ Form khi nạp xong Task
  useEffect(() => {
    if (task) {
      const isManager = task.assignee?.role === 'MANAGER' || (task.job?.manager && task.assignee?.id === task.job.manager.id);
      setEditFormData({
        title: task.title || '',
        description: task.description || '',
        assignee_id: isManager ? '' : (task.assignee?.id ? String(task.assignee.id) : ''),
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
    return list.map((emp) => {
      const swp = emp.smart_workload_pressure;
      const statusLabel =
        swp?.workload_status === 'OVERLOADED'
          ? '🔴 Overloaded'
          : swp?.workload_status === 'BALANCED'
          ? '🟢 Balanced'
          : '⚪ Available';
      const name = emp.full_name || emp.email;
      const email = emp.email || '';
      const dept = emp.department_name || 'Staff';
      return {
        value: String(emp.user_id || emp.id),
        label: `${name} (${dept})`,
        description: email !== name ? `${email} • ${dept}` : dept,
        badge: statusLabel,
      };
    });
  }, [employeesResponse]);

  // Chuẩn hóa danh sách
  const logWorks = useMemo(() => {
    if (Array.isArray(logWorksResponse)) return logWorksResponse;
    if (logWorksResponse && Array.isArray(logWorksResponse.results)) return logWorksResponse.results;
    return [];
  }, [logWorksResponse]);

  const totalLoggedHours = useMemo(() => {
    return logWorks.reduce((sum, item) => sum + (parseFloat(item.hours_spent) || 0), 0);
  }, [logWorks]);

  const comments = useMemo(() => {
    if (Array.isArray(commentsResponse)) return commentsResponse;
    if (commentsResponse && Array.isArray(commentsResponse.results)) return commentsResponse.results;
    return [];
  }, [commentsResponse]);

  const attachments = useMemo(() => {
    if (Array.isArray(attachmentsResponse)) return attachmentsResponse;
    if (attachmentsResponse && Array.isArray(attachmentsResponse.results)) return attachmentsResponse.results;
    return [];
  }, [attachmentsResponse]);

  const followers = useMemo(() => {
    if (Array.isArray(followersResponse)) return followersResponse;
    if (followersResponse && Array.isArray(followersResponse.results)) return followersResponse.results;
    return [];
  }, [followersResponse]);

  const isFollowing = useMemo(() => {
    return followers.some((f) => f.is_current_user || f.email === task?.creator?.email);
  }, [followers, task]);

  // Handlers
  const handleUpdateTask = (e) => {
    e.preventDefault();
    if (!editFormData.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    if (editFormData.deadline && task?.job?.deadline && editFormData.deadline > task.job.deadline) {
      toast.error(`Task deadline cannot exceed project deadline (${formatDateSafe(task.job.deadline)}).`);
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
    }, {
      onSuccess: () => setIsEditing(false),
    });
  };

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

  const handleSendComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    createCommentMutation.mutate(commentInput.trim(), {
      onSuccess: () => {
        setCommentInput('');
      },
    });
  };

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
          {/* Header Banners & Key Attributes Strip */}
          <TaskDrawerHeader
            task={task}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            closeTaskDrawer={closeTaskDrawer}
            onChangeTaskStatus={(payload) => changeTaskStatusMutation.mutate({ id: selectedTaskId, ...payload })}
            isChangingStatus={changeTaskStatusMutation.isPending}
          />

          {/* Navigation Tabs Bar */}
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

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <TaskOverviewTab
              task={task}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              editFormData={editFormData}
              setEditFormData={setEditFormData}
              employeeOptions={employeeOptions}
              totalLoggedHours={totalLoggedHours}
              onUpdateTask={handleUpdateTask}
              isUpdating={updateTaskMutation.isPending}
              onOpenDeleteModal={() => setDeleteModalOpen(true)}
              onOpenCancelModal={() => {
                setCancelReason('');
                setCancelModalOpen(true);
              }}
            />
          )}

          {/* Tab 2: Work Logs */}
          {activeTab === 'worklogs' && (
            <TaskTimesheetsTab
              logWorks={logWorks}
              totalLoggedHours={totalLoggedHours}
            />
          )}

          {/* Tab 3: Comments */}
          {activeTab === 'comments' && (
            <TaskCommentsTab
              comments={comments}
              commentInput={commentInput}
              setCommentInput={setCommentInput}
              onSendComment={handleSendComment}
              isSending={createCommentMutation.isPending}
            />
          )}

          {/* Tab 4: Attachments */}
          {activeTab === 'attachments' && (
            <TaskAttachmentsTab
              attachments={attachments}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
            />
          )}

          {/* Tab 5: Followers */}
          {activeTab === 'followers' && (
            <TaskFollowersTab
              followers={followers}
              isFollowing={isFollowing}
              onFollowToggle={() => (isFollowing ? unfollowTaskMutation.mutate() : followTaskMutation.mutate())}
              isPending={followTaskMutation.isPending || unfollowTaskMutation.isPending}
            />
          )}
        </div>
      )}

      {/* Reject Modal */}
      <TaskRejectModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        taskTitle={task?.title}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        onSubmit={handleRejectSubmit}
        isPending={rejectTaskMutation.isPending}
      />

      {/* Cancel Modal */}
      <TaskCancelModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        taskTitle={task?.title}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        onSubmit={handleCancelSubmit}
        isPending={cancelTaskMutation.isPending}
      />

      {/* Delete Modal */}
      <TaskDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        taskTitle={task?.title}
        isPending={deleteTaskMutation.isPending}
        onConfirm={async () => {
          try {
            await deleteTaskMutation.mutateAsync(task.id);
            setDeleteModalOpen(false);
            closeTaskDrawer();
          } catch (e) {
            // Handled by mutation toast
          }
        }}
      />
    </SideDrawer>
  );
}
