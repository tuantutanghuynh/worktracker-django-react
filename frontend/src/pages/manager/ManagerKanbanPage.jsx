import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import TaskDetailDrawer from './TaskDetailDrawer';
import PromptReasonModal from '../../components/common/modal/PromptReasonModal';
import { cn } from '../../utils/cn';

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

// Item Card Task đơn lẻ trong cột Kanban
function KanbanTaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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
      onClick={() => onClick(task.id)}
      className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
          {task.title}
        </h4>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2">{task.description}</p>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">
            {task.assignee?.full_name ? task.assignee.full_name.substring(0, 2).toUpperCase() : 'EM'}
          </div>
          <span className="truncate max-w-[90px]">{task.assignee?.full_name || 'Unassigned'}</span>
        </div>

        {formattedDeadline && (
          <div className="flex items-center gap-1 text-slate-400 font-medium">
            <Calendar className="w-3 h-3" />
            <span>{formattedDeadline}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Cột Container Droppable dùng useDroppable + Cuộn Nội Bộ Cột (Internal Scrollbar UX)
function KanbanColumnDroppable({ column, tasks, onTaskClick }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const taskIds = tasks.map((t) => String(t.id));

  return (
    <div
      ref={setNodeRef}
      id={column.id}
      className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80 max-h-[calc(100vh-230px)] flex flex-col"
    >
      {/* Tiêu đề Cột ghim cố định ở đầu (Sticky Header) */}
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl border font-bold text-xs mb-3 sticky top-0 z-10 shadow-xs', column.color)}>
        <span>{column.title}</span>
        <span className="px-2 py-0.5 rounded-full bg-white text-slate-800 text-[10px] font-extrabold shadow-2xs">
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
            tasks.map((task) => (
              <KanbanTaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
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
  const navigate = useNavigate();

  // State Bộ Lọc & Tìm Kiếm
  const [selectedJobId, setSelectedJobId] = useState(jobId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);

  // State Modal Lý do khi Hủy Task
  const [cancelModalState, setCancelModalState] = useState({
    isOpen: false,
    taskId: null,
    targetStatus: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 🚀 TANSTACK REACT QUERY: Nạp danh sách Jobs cho Filter Dropdown
  const { data: jobResponse } = useManagerJobs();
  const jobs = useMemo(() => {
    if (Array.isArray(jobResponse)) return jobResponse;
    if (jobResponse && Array.isArray(jobResponse.results)) return jobResponse.results;
    return [];
  }, [jobResponse]);

  // Tự chọn Job đầu tiên nếu chưa chọn
  const activeJobId = selectedJobId || (jobs.length > 0 ? String(jobs[0].id) : '');

  // 🚀 TANSTACK REACT QUERY: Nạp danh sách Tasks thuộc Job được chọn
  const { data: taskResponse, isLoading: tasksLoading } = useManagerTasks(
    activeJobId ? { job_id: activeJobId } : {}
  );

  const moveTaskMutation = useMoveTaskLexoRank();
  const changeStatusMutation = useChangeTaskStatus();

  const tasks = useMemo(() => {
    if (Array.isArray(taskResponse)) return taskResponse;
    if (taskResponse && Array.isArray(taskResponse.results)) return taskResponse.results;
    return [];
  }, [taskResponse]);

  // Lọc Tasks theo Tìm kiếm & Độ ưu tiên
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = searchQuery
        ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.task_code && t.task_code.toLowerCase().includes(searchQuery.toLowerCase()))
        : true;
      const matchPriority = selectedPriority ? t.priority === selectedPriority : true;
      return matchSearch && matchPriority;
    });
  }, [tasks, searchQuery, selectedPriority]);

  // Nhóm Tasks theo từng Cột Status
  const getTasksByStatus = (status) => {
    return filteredTasks.filter((t) => t.status === status);
  };

  // KHI BẮT ĐẦU KÉO CARD
  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => String(t.id) === String(active.id));
    if (task) setActiveTask(task);
  };

  // KHI THẢ CARD VÀO CỘT MỚI (XỬ LÝ LUỒNG CHUẨN BACKEND DRF)
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

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

    // 1. Nếu kéo thả sang cột CANCELLED ➔ Mở Modal yêu cầu nhập lý do
    if (destinationStatus === 'CANCELLED' && taskToMove.status !== 'CANCELLED') {
      setCancelModalState({
        isOpen: true,
        taskId: taskToMove.id,
        targetStatus: 'CANCELLED',
      });
      return;
    }

    // 2. Nếu kéo thả sang Cột khác Status ➔ Gọi API Status Transition
    if (destinationStatus !== taskToMove.status) {
      changeStatusMutation.mutate({
        id: taskToMove.id,
        toStatus: destinationStatus,
        reason: `Status changed to ${destinationStatus} via Kanban drag-and-drop`,
      });
      return;
    }

    // 3. Nếu kéo thả thay đổi vị trí trong CÙNG MỘT CỘT ➔ Tính toán prev_task_id & next_task_id cho LexoRank
    if (destinationStatus === taskToMove.status) {
      const columnTasks = getTasksByStatus(destinationStatus);
      const oldIdx = columnTasks.findIndex((t) => String(t.id) === activeId);
      const newIdx = columnTasks.findIndex((t) => String(t.id) === overId);

      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const prevTask = columnTasks[newIdx - 1] || null;
        const nextTask = columnTasks[newIdx + 1] || null;

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

  // Xử lý xác nhận Hủy Task từ Modal nhập lý do (onConfirm)
  const handleConfirmCancelTask = (reason) => {
    if (!cancelModalState.taskId) return;

    changeStatusMutation.mutate(
      {
        id: cancelModalState.taskId,
        toStatus: 'CANCELLED',
        reason,
      },
      {
        onSuccess: () => {
          setCancelModalState({ isOpen: false, taskId: null, targetStatus: null });
        },
      }
    );
  };

  return (
    <div className="space-y-4 text-slate-800 pb-10">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Interactive Kanban Board</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag &amp; drop tasks to update workflow statuses with instant real-time sync.
          </p>
        </div>

        {/* Selected Job Filter Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <select
              value={activeJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {jobs.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_code || `JOB-${j.id}`} - {j.job_name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Field */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks in kanban..."
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

      {/* Kanban Board Layout */}
      {tasksLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-96 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumnDroppable
                key={column.id}
                column={column}
                tasks={getTasksByStatus(column.id)}
                onTaskClick={(id) => setSelectedTaskId(id)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="bg-white p-3.5 rounded-xl border-2 border-blue-500 shadow-xl opacity-95">
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

      {/* Modal Nhập Lý Do Khi Hủy Task (Sửa prop onConfirm) */}
      <PromptReasonModal
        isOpen={cancelModalState.isOpen}
        onClose={() => setCancelModalState({ isOpen: false, taskId: null, targetStatus: null })}
        onConfirm={handleConfirmCancelTask}
        title="Reason Required for Cancelling Task"
        placeholder="Please state why this task is being cancelled..."
        confirmText="Confirm Cancellation"
        variant="danger"
        isLoading={changeStatusMutation.isPending}
      />
    </div>
  );
}