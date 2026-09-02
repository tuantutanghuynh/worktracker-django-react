import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { Calendar, ArrowUpToLine } from 'lucide-react';
import PriorityBadge from '../../common/badges/PriorityBadge';
import { cn } from '../../../utils/cn';

export default function KanbanTaskCard({
  task,
  onClick,
  isMutating = false,
  onMoveToTop,
  isFirstInColumn = false,
}) {
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
        isMutating
          ? 'cursor-not-allowed opacity-60 pointer-events-none'
          : 'hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing'
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
        {(() => {
          const isUnassigned = !task.assignee || task.assignee?.role === 'MANAGER';
          if (isUnassigned) {
            return (
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 min-w-0">
                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-extrabold text-[9px] flex items-center justify-center shrink-0">
                  ?
                </div>
                <span className="truncate max-w-[90px] text-[10px] text-amber-700 italic">Unassigned</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1.5 font-medium min-w-0">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                {task.assignee?.full_name ? task.assignee.full_name.substring(0, 2).toUpperCase() : 'EM'}
              </div>
              <span className="truncate max-w-[90px]">{task.assignee?.full_name || 'Staff'}</span>
            </div>
          );
        })()}

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
