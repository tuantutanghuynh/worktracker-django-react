import React from 'react';
import { Table, LayoutGrid, Kanban } from 'lucide-react';
import { cn } from '../../../utils/cn';

const MODE_CONFIG = {
  table: {
    label: 'Danh sách',
    icon: Table,
  },
  grid: {
    label: 'Thẻ (Grid)',
    icon: LayoutGrid,
  },
  kanban: {
    label: 'Kanban',
    icon: Kanban,
  },
};

export default function ViewToggle({
  currentView = 'table',
  onViewChange,
  modes = ['table', 'grid'],
  className = '',
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600',
        className
      )}
    >
      {modes.map((modeKey) => {
        const config = MODE_CONFIG[modeKey] || {
          label: modeKey,
          icon: Table,
        };
        const Icon = config.icon;
        const isActive = currentView === modeKey;

        return (
          <button
            key={modeKey}
            onClick={() => onViewChange && onViewChange(modeKey)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-150',
              isActive
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
