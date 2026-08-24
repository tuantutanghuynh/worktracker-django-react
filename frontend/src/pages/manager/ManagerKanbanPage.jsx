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
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import {
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  MoreVertical,
  Calendar,
  User,
  ArrowLeft,
  Briefcase,
  RotateCcw,
  ArrowUpToLine,
} from 'lucide-react';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import TaskDetailDrawer from '../../components/manager/TaskDetailDrawer';
import PromptReasonModal from '../../components/common/modal/PromptReasonModal';
import { cn } from '../../utils/cn';
import { useDebounce } from '../../hooks/useDebounce';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';

// Query Hooks
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import { useManagerTasks, useMoveTaskLexoRank, useChangeTaskStatus } from '../../hooks/queries/manager/useManagerTasks';

// 5 Cột Kanban chuẩn theo Spec hệ thống
const KANBAN_COLUMNS = [
  { id: 'TODO', title: 'To Do', color: 'border-slate-300 bg-slate-100/90 text-slate-700' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-300 bg-blue-50/90 text-blue-700' },
  { id: 'REVIEWING', title: 'Reviewing', color: 'border-purple-300 bg-purple-50/90 text-purple-700' },
  { id: 'COMPLETED', title: 'Completed', color: 'border-emerald-300 bg-emerald-50/90 text-emerald-700' },
  { id: 'CANCELLED', title: 'Cancelled', color: 'border-rose-300 bg-rose-50/90 text-rose-700' },
];

// Item Card Task đơn lẻ trong cột Kanban (Tích hợp 🔒 Mutate Guard & ⬆️ Move to Top)
function KanbanTaskCard({ task, onClick, isMutating, onMoveToTop, isFirstInColumn }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
    disabled: isMutating,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : isMutating ? 0.6 : 1,
  };

  const formattedDeadline = task.deadline
    ? format(new Date(task.deadline), 'MMM dd')
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isMutating && onClick(task.id)}
      className={cn(
        'bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all space-y-2.5 group/card',
        isMutating ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug flex-1">
          {task.title}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {!isFirstInColumn && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onMoveToTop(task, e);
              }}
              className="p-1 hover:bg-blue-50 hover:text-blue-600 rounded-md text-slate-400 transition-colors cursor-pointer shrink-0 opacity-0 group-hover/card:opacity-100"
              title="Move to Top of Column"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
            </button>
          )}
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      {task.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2">{task.description}</p>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5 font-medium min-w-0">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
            {task.assignee?.full_name ? task.assignee.full_name.substring(0, 2).toUpperCase() : 'EM'}
          </div>
          <span className="truncate max-w-[90px]">{task.assignee?.full_name || 'Unassigned'}</span>
        </div>

        {formattedDeadline && (
          <div className="flex items-center gap-1 text-slate-400 font-medium shrink-0">
            <Calendar className="w-3 h-3" />
            <span>{formattedDeadline}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Cột Container Droppable dùng useDroppable + Cuộn Nội Bộ Cột (Internal Scrollbar UX)
function KanbanColumnDroppable({ column, tasks, onTaskClick, mutatingTaskId, onMoveToTop }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const taskIds = tasks.map((t) => String(t.id));

  return (
    <div
      ref={setNodeRef}
      id={column.id}
      className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80 h-full max-h-[calc(100vh-230px)] flex flex-col"
    >
      {/* Tiêu đề Cột ghim cố định ở đầu (Sticky Header) */}
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl border font-bold text-xs mb-3 sticky top-0 z-10 shadow-xs', column.color)}>
        <span className="truncate">{column.title}</span>
        <span className="px-2 py-0.5 rounded-full bg-white text-slate-800 text-[10px] font-extrabold shadow-2xs shrink-0 ml-1">
          {tasks.length}
        </span>
      </div>

      {/* Danh sách Card trong Cột với Cuộn chuột Nội bộ (Internal Custom Scrollbar) */}
      <SortableContext id={column.id} items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-[350px]">
          {tasks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-normal">
              Drop tasks here
            </div>
          ) : (
            tasks.map((task, index) => (
              <KanbanTaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                isMutating={String(task.id) === String(mutatingTaskId)}
                onMoveToTop={onMoveToTop}
                isFirstInColumn={index === 0}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function ManagerKanbanPage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramJobId = jobId || searchParams.get('job_id') || searchParams.get('jobId') || '';

  // ⚡ REAL-TIME WEBSOCKET: Tự động đồng bộ Bảng Kanban thời gian thực giữa các thành viên
  useWebSocket();

  // 🚀 ZUSTAND STORE: Lịch sử vừa xem
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

  // State Modal Lý do linh hoạt (dùng chung cho Hủy Task & Yêu cầu Làm lại Rework)
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

  // 🛡️ CUSTOM HOOK: Hoãn tìm kiếm 300ms chống giật lag
  const debouncedSearch = useDebounce(searchQuery, 300);

  // 🚀 TANSTACK REACT QUERY: Nạp danh sách Jobs cho Filter Dropdown
  const { data: jobResponse } = useManagerJobs();
  const jobs = useMemo(() => {
    if (Array.isArray(jobResponse)) return jobResponse;
    if (jobResponse && Array.isArray(jobResponse.results)) return jobResponse.results;
    return [];
  }, [jobResponse]);

  // Tự chọn Job đầu tiên nếu chưa chọn
  const activeJobId = selectedJobId || (jobs.length > 0 ? String(jobs[0].id) : '');

  // 🚀 Tự động lưu Job vừa chọn trên Kanban vào Sidebar Recently Viewed Jobs
  useEffect(() => {
    if (activeJobId && jobs.length > 0) {
      const currentJob = jobs.find((j) => String(j.id) === String(activeJobId));
      if (currentJob) {
        addRecentJob(currentJob);
      }
    }
  }, [activeJobId, jobs, addRecentJob]);

  // 🚀 TANSTACK REACT QUERY: Nạp danh sách Tasks thuộc Job được chọn
  const { data: taskResponse, isLoading: tasksLoading } = useManagerTasks(
    activeJobId ? { job_id: activeJobId } : {}
  );

  const moveTaskMutation = useMoveTaskLexoRank();
  const changeStatusMutation = useChangeTaskStatus();

  // 🔒 MUTATE GUARD: Lấy ID của Task đang trong quá trình đồng bộ API với Server
  const mutatingTaskId = useMemo(() => {
    if (changeStatusMutation.isPending) {
      return changeStatusMutation.variables?.id;
    }
    if (moveTaskMutation.isPending) {
      return moveTaskMutation.variables?.id;
    }
    return null;
  }, [changeStatusMutation.isPending, changeStatusMutation.variables, moveTaskMutation.isPending, moveTaskMutation.variables]);

  // 🚀 QUAN TRỌNG: SẮP XẾP DANH SÁCH TASK CHUẨN THEO LEXORANK ORDER_INDEX (PURE ASCII COMPARISON)
  const tasks = useMemo(() => {
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
  }, [taskResponse]);

  // 🔍 LỌC TASKS PHONG PHÚ: TÌM THEO TÊN TASK, MÃ TASK, TÊN NHÂN VIÊN PHỤ TRÁCH, VÀ MÔ TẢ
  const filteredTasks = useMemo(() => {
    const query = (debouncedSearch || '').toLowerCase().trim();

    return tasks.filter((t) => {
      let matchSearch = true;
      if (query) {
        const matchTitle = t.title?.toLowerCase().includes(query);
        const matchCode = t.task_code?.toLowerCase().includes(query) || `tsk-${t.id}`.includes(query);
        const matchAssignee = t.assignee?.full_name?.toLowerCase().includes(query) || t.assignee?.email?.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query);

        matchSearch = matchTitle || matchCode || matchAssignee || matchDesc;
      }

      const matchPriority = selectedPriority ? t.priority === selectedPriority : true;
      return matchSearch && matchPriority;
    });
  }, [tasks, debouncedSearch, selectedPriority]);

  // Nhóm Tasks theo từng Cột Status
  const getTasksByStatus = (status) => {
    return filteredTasks.filter((t) => t.status === status);
  };

  // ⬆️ XỬ LÝ ĐƯA TASK LÊN ĐẦU CỘT (MOVE TO TOP OF COLUMN WITH OPTIMISTIC UI 0MS)
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

  // KHI BẮT ĐẦU KÉO CARD
  const handleDragStart = (event) => {
    const { active } = event;

    if (mutatingTaskId && String(active.id) === String(mutatingTaskId)) {
      return;
    }

    const task = tasks.find((t) => String(t.id) === String(active.id));
    if (task) setActiveTask(task);
  };

  // KHI THẢ CARD VÀO CỘT MỚI
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (mutatingTaskId && activeId === String(mutatingTaskId)) {
      return;
    }

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

    // 🚫 1. CHẶN KÉO TỪ COMPLETED SANG CANCELLED (CHUẨN JIRA WORKFLOW)
    if (taskToMove.status === 'COMPLETED' && destinationStatus === 'CANCELLED') {
      toast.error('Completed tasks cannot be cancelled. Drag to In Progress or To Do to request rework.');
      return;
    }

    // 2. KÉO SANG CANCELLED (từ TODO, IN_PROGRESS, REVIEWING) ➔ MỞ MODAL NHẬP LÝ DO HỦY
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

    // 🔄 3. KÉO TỪ COMPLETED SANG IN_PROGRESS HOẶC TODO ➔ MỞ MODAL NHẬP LÝ DO YÊU CẦU LÀM LẠI (REWORK)
    if (taskToMove.status === 'COMPLETED' && (destinationStatus === 'IN_PROGRESS' || destinationStatus === 'TODO')) {
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

    // 4. Nếu kéo thả sang Cột khác Status ➔ Gọi API Status Transition
    if (destinationStatus !== taskToMove.status) {
      changeStatusMutation.mutate({
        id: taskToMove.id,
        toStatus: destinationStatus,
        reason: `Status changed to ${destinationStatus} via Kanban drag-and-drop`,
      });
      return;
    }

    // 5. Nếu kéo thả thay đổi vị trí trong CÙNG MỘT CỘT ➔ Tính toán chuẩn xác LexoRank
    if (destinationStatus === taskToMove.status) {
      const columnTasks = getTasksByStatus(destinationStatus);
      const oldIdx = columnTasks.findIndex((t) => String(t.id) === activeId);
      const newIdx = columnTasks.findIndex((t) => String(t.id) === overId);

      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        let prevTask = null;
        let nextTask = null;

        if (oldIdx < newIdx) {
          prevTask = columnTasks[newIdx] || null;
          nextTask = columnTasks[newIdx + 1] || null;
        } else {
          prevTask = columnTasks[newIdx - 1] || null;
          nextTask = columnTasks[newIdx] || null;
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
      }
    }
  };

  // Xử lý xác nhận Lý do từ Modal (dùng chung cho Hủy Task & Yêu cầu Làm lại Rework)
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
    <div className="space-y-4 text-slate-800 pb-10 max-w-full overflow-hidden">
      {/* Header Bar - Responsive Flex Layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Interactive Kanban Board</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag &amp; drop tasks to update workflow statuses with instant real-time sync.
          </p>
        </div>

        {/* Selected Job Filter Dropdown - Full Width on Mobile, Truncate Text */}
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs w-full sm:w-auto max-w-full overflow-hidden">
            <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={activeJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full truncate pr-2"
            >
              {jobs.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                jobs.map((j) => (
                  <option key={j.id} value={j.id} title={`${j.job_code || `JOB-${j.id}`} - ${j.job_name}`}>
                    {j.job_code || `JOB-${j.id}`} - {j.job_name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Filters Toolbar - Responsive Flex */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full">
          {/* Search Field */}
          <div className="relative min-w-[200px] flex-1 max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, code, assignee..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
          >
            <option value="">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {(searchQuery || selectedPriority) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedPriority('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Layout - GRID 5 CỘT TỰ CO GIÃN TRÊN DESKTOP, CUỘN NGANG TRÊN MOBILE */}
      {tasksLoading ? (
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
          {/* Responsive Container: Tự vừa vặn 100% màn hình Desktop (lg/xl grid), cuộn trên mobile (< lg) */}
          <div className="flex lg:grid lg:grid-cols-5 overflow-x-auto lg:overflow-visible gap-4 pb-4 custom-scrollbar min-h-[calc(100vh-250px)] items-start">
            {KANBAN_COLUMNS.map((column) => (
              <div key={column.id} className="w-[280px] lg:w-auto min-w-[260px] lg:min-w-0 shrink-0 lg:shrink">
                <KanbanColumnDroppable
                  column={column}
                  tasks={getTasksByStatus(column.id)}
                  onTaskClick={(id) => setSelectedTaskId(id)}
                  mutatingTaskId={mutatingTaskId}
                  onMoveToTop={handleMoveToTop}
                />
              </div>
            ))}
          </div>

          {/* Drag Overlay Tắt Hiệu Ứng Nảy xịch */}
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

      {/* Modal Nhập Lý Do (dùng chung cho Hủy Task & Yêu cầu Làm lại Rework) */}
      <PromptReasonModal
        isOpen={promptModalState.isOpen}
        onClose={() => setPromptModalState({ isOpen: false, taskId: null, targetStatus: null, title: '', placeholder: '', confirmText: '', variant: 'danger' })}
        onConfirm={handleConfirmReasonModal}
        title={promptModalState.title || "Reason Required"}
        placeholder={promptModalState.placeholder || "Please enter details..."}
        confirmText={promptModalState.confirmText || "Confirm"}
        variant={promptModalState.variant || "danger"}
        isLoading={changeStatusMutation.isPending}
      />
    </div>
  );
}