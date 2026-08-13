import React, { useMemo } from 'react';
import { Table, LayoutGrid, Kanban } from 'lucide-react';
import { cn } from '../../../utils/cn';

// Từ điển cấu hình mặc định khi truyền mảng string ['table', 'grid', 'kanban']
const MODE_CONFIG = {
  table: {
    label: 'Table',
    icon: Table,
  },
  grid: {
    label: 'Grid',
    icon: LayoutGrid,
  },
  kanban: {
    label: 'Kanban',
    icon: Kanban,
  },
};

/**
 * Hybrid ViewToggle Component
 * 
 * Supports both:
 * 1. Tu's prop structure: views (array of objects), activeView, onChange
 * 2. User's prop structure: modes (array of string keys), currentView, onViewChange
 * 
 * Compatible with both:
 * import { ViewToggle } from '...'
 * import ViewToggle from '...'
 */
export function ViewToggle({
  // Props chuẩn từ nhóm Tú
  views,
  activeView,
  onChange,

  // Props từ nhóm bạn
  modes,
  currentView,
  onViewChange,
  className = '',
}) {
  // Alias tự động cho biến activeView và hàm onChange
  const active = activeView ?? currentView ?? 'table';
  const handleChange = onChange ?? onViewChange;

  // Chuẩn hóa mảng danh sách View để hỗ trợ cả 2 nhóm
  const effectiveViews = useMemo(() => {
    // 1. Nếu Nhóm Tú truyền mảng đối tượng `views`
    if (Array.isArray(views) && views.length > 0) {
      return views.map((v) => ({
        value: v.value ?? v.id ?? v,
        label: v.label ?? String(v.value || v),
        icon: v.icon,
      }));
    }

    // 2. Nếu Bên Bạn truyền mảng string `modes` (ví dụ: ['table', 'grid'])
    const modeList = Array.isArray(modes) && modes.length > 0 ? modes : ['table', 'grid'];
    return modeList.map((modeKey) => {
      const config = MODE_CONFIG[modeKey] || { label: modeKey, icon: Table };
      return {
        value: modeKey,
        label: config.label,
        icon: config.icon,
      };
    });
  }, [views, modes]);

  return (
    <div
      className={cn(
        'inline-flex items-center p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-600',
        className
      )}
    >
      {effectiveViews.map(({ value, label, icon: Icon }) => {
        const isActive = value === active;

        return (
          <button
            key={value}
            type="button"
            onClick={() => handleChange && handleChange(value)}
            title={label}
            className={cn(
              'flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all duration-150 cursor-pointer',
              isActive
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ViewToggle;