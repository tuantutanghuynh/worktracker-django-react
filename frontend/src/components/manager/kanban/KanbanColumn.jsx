import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanTaskCard from './KanbanTaskCard';
import { cn } from '../../../utils/cn';

export default function KanbanColumn({
  column,
  tasks = [],
  onTaskClick,
  mutatingTaskId,
  onMoveToTop,
}) {
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
