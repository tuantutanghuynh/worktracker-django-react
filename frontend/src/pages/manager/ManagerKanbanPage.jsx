import React, { useState, useEffect, useCallback } from 'react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  MoreVertical,
  Calendar,
  User,
  ArrowLeft,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../../utils/errorMessages';
import managerTaskService from '../../services/manager/managerTaskService';
import managerJobService from '../../services/manager/managerJobService';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import TaskDetailDrawer from './TaskDetailDrawer';
import PromptReasonModal from '../../components/common/modal/PromptReasonModal';
import { cn } from '../../utils/cn';

// 5 Cột Kanban chuẩn theo Spec hệ thống
const KANBAN_COLUMNS = [
  { id: 'TODO', title: 'To Do', color: 'border-slate-300 bg-slate-100/80 text-slate-700' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-300 bg-blue-50/80 text-blue-700' },
  { id: 'REVIEWING', title: 'Reviewing', color: 'border-purple-300 bg-purple-50/80 text-purple-700' },
  { id: 'COMPLETED', title: 'Completed', color: 'border-emerald-300 bg-emerald-50/80 text-emerald-700' },
  { id: 'CANCELLED', title: 'Cancelled', color: 'border-rose-300 bg-rose-50/80 text-rose-700' },
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task.id)}
      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-3"
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

        {task.deadline && (
          <div className="flex items-center gap-1 text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Cột Container Droppable dùng useDroppable để chấp nhận thả card ngay cả khi cột đang trống
function KanbanColumnDroppable({ column, tasks, onTaskClick }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const taskIds = tasks.map((t) => String(t.id));

  return (
    <div
      ref={setNodeRef}
      id={column.id}
      className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80 min-h-[500px] flex flex-col space-y-3"
    >
      {/* Tiêu đề Cột */}
      <div className={cn('flex items-center justify-between px-2 py-1.5 rounded-xl border font-bold text-xs', column.color)}>
        <span>{column.title}</span>
        <span className="px-2 py-0.5 rounded-full bg-white text-slate-800 text-[10px] shadow-2xs">
          {tasks.length}
        </span>
      </div>

      {/* Danh sách Card trong Cột */}
      <SortableContext id={column.id} items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5 flex-1 min-h-[400px]">
          {tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function ManagerKanbanPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(jobId || '');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [cancelModalState, setCancelModalState] = useState({
    isOpen: false,
    taskId: null,
    targetStatus: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 1. Fetch danh sách các Jobs để chọn Filter
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await managerJobService.getJobs();
        const list = Array.isArray(data) ? data : data.results || [];
        setJobs(list);
        if (!selectedJobId && list.length > 0) {
          setSelectedJobId(String(list[0].id));
        }
      } catch (err) {
        console.error('Failed to fetch jobs for kanban filter:', err);
      }
    };
    fetchJobs();
  }, [jobId, selectedJobId]);

  // 2. Fetch danh sách Tasks thuộc Job được chọn
  const fetchTasks = useCallback(async () => {
    if (!selectedJobId) return;
    setLoading(true);
    try {
      const data = await managerTaskService.getTasks({ job_id: selectedJobId });
      const taskList = Array.isArray(data) ? data : data.results || [];
      setTasks(taskList);
    } catch (err) {
      console.error('Failed to fetch tasks for kanban:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Nhóm Tasks theo từng Cột Status
  const getTasksByStatus = (status) => {
    return tasks.filter((t) => t.status === status);
  };

  // Xử lý Bắt đầu Kéo Card
  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => String(t.id) === String(active.id));
    setActiveTask(task);
  };

  // Xử lý Thả Card sang Cột mới
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // X định cột target
    let targetStatus = KANBAN_COLUMNS.find((col) => col.id === overId)?.id;
    if (!targetStatus) {
      const overTask = tasks.find((t) => String(t.id) === overId);
      if (overTask) targetStatus = overTask.status;
    }

    if (!targetStatus) return;

    const currentTask = tasks.find((t) => String(t.id) === activeId);
    if (!currentTask || currentTask.status === targetStatus) return;

    const previousStatus = currentTask.status;

    // Nếu kéo vào CANCELLED -> Mở PromptReasonModal để yêu cầu nhập lý do hủy
    if (targetStatus === 'CANCELLED') {
      setCancelModalState({
        isOpen: true,
        taskId: activeId,
        targetStatus: targetStatus,
      });
      return;
    }

    // Cập nhật State tạm thời phía Client cho mượt
    setTasks((prev) =>
      prev.map((t) => (String(t.id) === activeId ? { ...t, status: targetStatus } : t))
    );

    // Gọi API cập nhật Trạng thái sang Backend Django
    try {
      await managerTaskService.changeTaskStatus(activeId, targetStatus);
      const targetCol = KANBAN_COLUMNS.find((col) => col.id === targetStatus);
      const prevCol = KANBAN_COLUMNS.find((col) => col.id === previousStatus);

      // Chỉ hỗ trợ nút Undo cho các luồng có thể đảo ngược (TODO <-> IN_PROGRESS)
      const isReversible =
        ['TODO', 'IN_PROGRESS'].includes(previousStatus) &&
        ['TODO', 'IN_PROGRESS'].includes(targetStatus);

      if (isReversible) {
        toast.success(`Task moved to "${targetCol?.title || targetStatus}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await managerTaskService.changeTaskStatus(activeId, previousStatus);
                toast.info(`Task restored to "${prevCol?.title || previousStatus}"`);
                fetchTasks();
              } catch (undoErr) {
                toast.error(getErrorMessage(undoErr));
                fetchTasks();
              }
            },
          },
        });
      } else {
        toast.success(`Task moved to "${targetCol?.title || targetStatus}"`);
      }
    } catch (err) {
      console.error('Failed to update task status on backend:', err);
      toast.error(getErrorMessage(err));
      fetchTasks(); // Rollback lại vị trí cũ
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Bộ Lọc Chọn Job */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kanban Board</h1>
          <p className="text-xs text-slate-500">Visual task workflow &amp; drag-and-drop status pipeline</p>
        </div>

        {/* Dropdown Chọn Dự Án */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>Select Job:</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_name} ({j.job_code || `JOB-${j.id}`})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vùng Bảng 5 Cột Kanban Kéo - Thả */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs font-semibold animate-pulse">
          Loading Kanban Board Tasks...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start pb-6 overflow-x-auto">
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
              <div className="bg-white p-3.5 rounded-xl border border-blue-500 shadow-xl space-y-2 opacity-90 scale-105">
                <h4 className="text-xs font-bold text-slate-900">{activeTask.title}</h4>
                <PriorityBadge priority={activeTask.priority} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* SideDrawer Chi tiết Task khi click */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          isOpen={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Modal Yêu cầu Nhập Lý do khi Hủy Task */}
      <PromptReasonModal
        isOpen={cancelModalState.isOpen}
        title="Cancel Task Confirmation"
        description="Please provide a clear reason why this task is being cancelled."
        placeholder="e.g. Client requested feature cancellation..."
        confirmText="Cancel Task"
        variant="danger"
        onClose={() => setCancelModalState({ isOpen: false, taskId: null, targetStatus: null })}
        onConfirm={async (reason) => {
          const { taskId, targetStatus } = cancelModalState;
          setCancelModalState({ isOpen: false, taskId: null, targetStatus: null });

          // Cập nhật State tạm thời phía Client cho mượt
          setTasks((prev) =>
            prev.map((t) => (String(t.id) === String(taskId) ? { ...t, status: targetStatus } : t))
          );

          try {
            await managerTaskService.changeTaskStatus(taskId, targetStatus, reason);
            toast.success('Task has been cancelled successfully');
            fetchTasks();
          } catch (err) {
            console.error('Failed to cancel task:', err);
            toast.error(getErrorMessage(err));
            fetchTasks(); // Rollback lại vị trí cũ
          }
        }}
      />
    </div>
  );
}