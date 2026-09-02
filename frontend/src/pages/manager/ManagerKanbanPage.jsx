import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import KanbanHeader from '../../components/manager/kanban/KanbanHeader';
import KanbanFilterToolbar from '../../components/manager/kanban/KanbanFilterToolbar';
import KanbanColumn from '../../components/manager/kanban/KanbanColumn';
import KanbanFrozenProjectView from '../../components/manager/kanban/KanbanFrozenProjectView';
import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';
import PromptReasonModal from '../../components/common/modal/PromptReasonModal';

import { useDebounce } from '../../hooks/useDebounce';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import {
  useManagerTasks,
  useMoveTaskLexoRank,
  useChangeTaskStatus,
} from '../../hooks/queries/manager/useManagerTasks';

// 5 Cột Kanban chuẩn theo Spec hệ thống
const KANBAN_COLUMNS = [
  { id: 'TODO', title: 'To Do', color: 'border-slate-300 bg-slate-100/90 text-slate-700' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-300 bg-blue-50/90 text-blue-700' },
  { id: 'REVIEWING', title: 'Reviewing', color: 'border-purple-300 bg-purple-50/90 text-purple-700' },
  { id: 'COMPLETED', title: 'Completed', color: 'border-emerald-300 bg-emerald-50/90 text-emerald-700' },
  { id: 'CANCELLED', title: 'Cancelled', color: 'border-rose-300 bg-rose-50/90 text-rose-700' },
];

export default function ManagerKanbanPage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramJobId = jobId || searchParams.get('job_id') || searchParams.get('jobId') || '';

  // ⚡ Realtime WebSocket
  useWebSocket();

  // 🚀 Zustand Store: Lịch sử vừa xem
  const { addRecentJob } = useRecentJobsStore();

  // State Bộ Lọc & Tìm Kiếm
  const [selectedJobId, setSelectedJobId] = useState(paramJobId);

  useEffect(() => {
    if (paramJobId) {
      setSelectedJobId(paramJobId);
    }
  }, [paramJobId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);

  // Modal State Lý do
  const [promptModalState, setPromptModalState] = useState({
    isOpen: false,
    taskId: null,
    targetStatus: null,
    title: '',
    placeholder: '',
    confirmText: '',
    variant: 'danger',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const debouncedSearch = useDebounce(searchQuery, 300);

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: jobResponse } = useManagerJobs();
  const jobs = useMemo(() => {
    if (Array.isArray(jobResponse)) return jobResponse;
    if (jobResponse && Array.isArray(jobResponse.results)) return jobResponse.results;
    return [];
  }, [jobResponse]);

  const availableJobs = useMemo(() => {
    return jobs.filter((j) => !(j.client && j.client.is_active === false));
  }, [jobs]);

  const activeJobId =
    selectedJobId && availableJobs.some((j) => String(j.id) === String(selectedJobId))
      ? selectedJobId
      : availableJobs.length > 0
      ? String(availableJobs[0].id)
      : jobs.length > 0
      ? String(jobs[0].id)
      : '';

  const currentJob = useMemo(() => {
    return jobs.find((j) => String(j.id) === String(activeJobId)) || null;
  }, [jobs, activeJobId]);

  const isJobFrozen = Boolean(currentJob && currentJob.client && currentJob.client.is_active === false);

  useEffect(() => {
    if (activeJobId && jobs.length > 0 && currentJob && !isJobFrozen) {
      addRecentJob(currentJob);
    }
  }, [activeJobId, jobs, currentJob, isJobFrozen, addRecentJob]);

  const { data: taskResponse, isLoading: tasksLoading } = useManagerTasks(
    activeJobId && !isJobFrozen ? { job_id: activeJobId } : {}
  );

  const moveTaskMutation = useMoveTaskLexoRank();
  const changeStatusMutation = useChangeTaskStatus();

  // Mutate Guard
  const mutatingTaskId = useMemo(() => {
    if (changeStatusMutation.isPending) return changeStatusMutation.variables?.id;
    if (moveTaskMutation.isPending) return moveTaskMutation.variables?.id;
    return null;
  }, [
    changeStatusMutation.isPending,
    changeStatusMutation.variables,
    moveTaskMutation.isPending,
    moveTaskMutation.variables,
  ]);

  // Sắp xếp Tasks theo LexoRank order_index
  const tasks = useMemo(() => {
    if (isJobFrozen) return [];
    let list = [];
    if (Array.isArray(taskResponse)) list = taskResponse;
    else if (taskResponse && Array.isArray(taskResponse.results)) list = taskResponse.results;
    return [...list].sort((a, b) => {
      const keyA = a.order_index || '';
      const keyB = b.order_index || '';
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return a.id - b.id;
    });
  }, [taskResponse, isJobFrozen]);

  // Lọc Tasks
  const filteredTasks = useMemo(() => {
    if (isJobFrozen) return [];
    const query = (debouncedSearch || '').toLowerCase().trim();

    return tasks.filter((t) => {
      let matchSearch = true;
      if (query) {
        const matchTitle = t.title?.toLowerCase().includes(query);
        const matchCode = t.task_code?.toLowerCase().includes(query) || `tsk-${t.id}`.includes(query);
        const matchAssignee =
          t.assignee?.full_name?.toLowerCase().includes(query) ||
          t.assignee?.email?.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query);

        matchSearch = matchTitle || matchCode || matchAssignee || matchDesc;
      }

      const matchPriority = selectedPriority ? t.priority === selectedPriority : true;
      return matchSearch && matchPriority;
    });
  }, [tasks, debouncedSearch, selectedPriority, isJobFrozen]);

  const getTasksByStatus = (status) => {
    return filteredTasks.filter((t) => t.status === status);
  };

  // ⬆️ Move to Top of Column
  const handleMoveToTop = (task, event) => {
    if (event) event.stopPropagation();
    if (mutatingTaskId) return;

    const columnTasks = getTasksByStatus(task.status);
    const firstTask = columnTasks[0];
    if (!firstTask || String(firstTask.id) === String(task.id)) return;

    moveTaskMutation.mutate({
      id: task.id,
      moveParams: {
        to_status: task.status,
        prev_task_id: null,
        next_task_id: firstTask.id,
        jobId: activeJobId,
      },
    });
  };

  const handleDragStart = (event) => {
    const { active } = event;
    if (mutatingTaskId && String(active.id) === String(mutatingTaskId)) return;

    const task = tasks.find((t) => String(t.id) === String(active.id));
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (mutatingTaskId && activeId === String(mutatingTaskId)) return;

    const taskToMove = tasks.find((t) => String(t.id) === activeId);
    if (!taskToMove) return;

    let destinationStatus = taskToMove.status;
    const isColumn = KANBAN_COLUMNS.some((col) => col.id === overId);

    if (isColumn) {
      destinationStatus = overId;
    } else {
      const overTask = tasks.find((t) => String(t.id) === overId);
      if (overTask) {
        destinationStatus = overTask.status;
      }
    }

    // 1. Chặn Completed -> Cancelled
    if (taskToMove.status === 'COMPLETED' && destinationStatus === 'CANCELLED') {
      toast.error('Completed tasks cannot be cancelled. Drag to In Progress or To Do to request rework.');
      return;
    }

    // 2. Chặn nhảy cóc từ To Do / In Progress sang Completed
    if (
      destinationStatus === 'COMPLETED' &&
      (taskToMove.status === 'TODO' || taskToMove.status === 'IN_PROGRESS')
    ) {
      toast.warning(
        'Tasks must be submitted for QA review (Reviewing) before marking as Completed. Please use the QA Review Queue.'
      );
      return;
    }

    // 3. Chặn Manager kéo từ In Progress sang Reviewing (Quyền thuộc nhân viên nộp bài)
    if (taskToMove.status === 'IN_PROGRESS' && destinationStatus === 'REVIEWING') {
      toast.info(
        'Employees submit tasks for QA review when uploading their deliverables and timesheet logs.'
      );
      return;
    }

    // 4. Sang Cancelled -> Mở Modal lý do hủy
    if (destinationStatus === 'CANCELLED' && taskToMove.status !== 'CANCELLED') {
      setPromptModalState({
        isOpen: true,
        taskId: taskToMove.id,
        targetStatus: 'CANCELLED',
        title: 'Reason Required for Cancelling Task',
        placeholder: 'Please state why this task is being cancelled...',
        confirmText: 'Confirm Cancellation',
        variant: 'danger',
      });
      return;
    }

    // 5. Completed -> In Progress / To Do -> Mở Modal Rework
    if (
      taskToMove.status === 'COMPLETED' &&
      (destinationStatus === 'IN_PROGRESS' || destinationStatus === 'TODO')
    ) {
      setPromptModalState({
        isOpen: true,
        taskId: taskToMove.id,
        targetStatus: destinationStatus,
        title: 'Reason Required for Requesting Task Rework',
        placeholder: 'Please describe what needs to be revised or fixed by the employee...',
        confirmText: 'Confirm Rework Request',
        variant: 'warning',
      });
      return;
    }

    // 6. Reviewing -> Completed -> Mở Modal QA Acceptance
    if (taskToMove.status === 'REVIEWING' && destinationStatus === 'COMPLETED') {
      setPromptModalState({
        isOpen: true,
        taskId: taskToMove.id,
        targetStatus: 'COMPLETED',
        title: 'Manager QA Deliverables Acceptance',
        placeholder: 'Enter acceptance notes or QA approval comments...',
        confirmText: 'Approve & Complete',
        variant: 'success',
      });
      return;
    }

    // 7. Sắp xếp vị trí (Cùng cột hoặc sang Cột khác hợp lệ)
    const targetColumnTasks = getTasksByStatus(destinationStatus);
    const oldIdx = targetColumnTasks.findIndex((t) => String(t.id) === activeId);
    const newIdx = targetColumnTasks.findIndex((t) => String(t.id) === overId);

    let prevTask = null;
    let nextTask = null;

    if (newIdx !== -1) {
      if (oldIdx !== -1 && oldIdx < newIdx) {
        prevTask = targetColumnTasks[newIdx] || null;
        nextTask = targetColumnTasks[newIdx + 1] || null;
      } else {
        prevTask = targetColumnTasks[newIdx - 1] || null;
        nextTask = targetColumnTasks[newIdx] || null;
      }
    } else if (targetColumnTasks.length > 0) {
      prevTask = targetColumnTasks[targetColumnTasks.length - 1];
    }

    moveTaskMutation.mutate({
      id: taskToMove.id,
      moveParams: {
        to_status: destinationStatus,
        prev_task_id: prevTask ? prevTask.id : null,
        next_task_id: nextTask ? nextTask.id : null,
        jobId: activeJobId,
      },
    });
  };

  const handleConfirmReasonModal = (reason) => {
    if (!promptModalState.taskId || !promptModalState.targetStatus) return;

    changeStatusMutation.mutate(
      {
        id: promptModalState.taskId,
        toStatus: promptModalState.targetStatus,
        reason,
      },
      {
        onSuccess: () => {
          setPromptModalState({
            isOpen: false,
            taskId: null,
            targetStatus: null,
            title: '',
            placeholder: '',
            confirmText: '',
            variant: 'danger',
          });
        },
      }
    );
  };

  return (
    <div className="space-y-4 text-slate-800 pb-10 max-w-full overflow-hidden antialiased">
      {/* 🌟 Header Bar */}
      <KanbanHeader
        activeJobId={activeJobId}
        onJobChange={setSelectedJobId}
        availableJobs={availableJobs}
      />

      {/* 🔍 Quick Filters Toolbar */}
      {!isJobFrozen && (
        <KanbanFilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPriority={selectedPriority}
          onPriorityChange={setSelectedPriority}
          onClear={() => {
            setSearchQuery('');
            setSelectedPriority('');
          }}
        />
      )}

      {/* 📋 Kanban Board Layout: Frozen Project Screen OR 5 Columns Grid */}
      {isJobFrozen ? (
        <KanbanFrozenProjectView
          currentJob={currentJob}
          availableJobs={availableJobs}
          onSwitchActiveProject={() => setSelectedJobId(String(availableJobs[0].id))}
          onReturnToJobs={() => navigate('/manager/jobs')}
        />
      ) : tasksLoading ? (
        <div className="flex lg:grid lg:grid-cols-5 overflow-x-auto lg:overflow-visible gap-4 pb-4 custom-scrollbar">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="w-[280px] lg:w-full h-96 bg-slate-100 rounded-2xl animate-pulse shrink-0" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex lg:grid lg:grid-cols-5 overflow-x-auto lg:overflow-visible gap-4 pb-4 custom-scrollbar min-h-[calc(100vh-250px)] items-start">
            {KANBAN_COLUMNS.map((column) => (
              <div key={column.id} className="w-[280px] lg:w-auto min-w-[260px] lg:min-w-0 shrink-0 lg:shrink">
                <KanbanColumn
                  column={column}
                  tasks={getTasksByStatus(column.id)}
                  onTaskClick={(id) => setSelectedTaskId(id)}
                  mutatingTaskId={mutatingTaskId}
                  onMoveToTop={handleMoveToTop}
                />
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div className="bg-white p-3.5 rounded-xl border-2 border-blue-500 shadow-xl opacity-95 w-[280px]">
                <h4 className="text-xs font-bold text-slate-900">{activeTask.title}</h4>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Task Detail Slide-over Drawer */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          isOpen={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Modal Nhập Lý Do (Hủy Task & Rework) */}
      <PromptReasonModal
        isOpen={promptModalState.isOpen}
        onClose={() =>
          setPromptModalState({
            isOpen: false,
            taskId: null,
            targetStatus: null,
            title: '',
            placeholder: '',
            confirmText: '',
            variant: 'danger',
          })
        }
        onConfirm={handleConfirmReasonModal}
        title={promptModalState.title || 'Reason Required'}
        placeholder={promptModalState.placeholder || 'Please enter details...'}
        confirmText={promptModalState.confirmText || 'Confirm'}
        variant={promptModalState.variant || 'danger'}
        isLoading={changeStatusMutation.isPending}
      />
    </div>
  );
}