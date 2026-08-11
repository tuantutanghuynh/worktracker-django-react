import React from 'react';
import { Search, RotateCcw, X } from 'lucide-react';
import ViewToggle from './ViewToggle';
import { cn } from '../../../utils/cn';

export default function FilterToolbar({
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm công việc, dự án...',
  statusValue = '',
  onStatusChange,
  statusOptions = [],
  priorityValue = '',
  onPriorityChange,
  priorityOptions = [],
  currentView,
  onViewChange,
  viewModes,
  onClearFilters,
  children,
  className = '',
}) {
  const hasActiveFilters = Boolean(
    searchQuery || statusValue || priorityValue
  );

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs',
        className
      )}
    >
      {/* Left section: Search & Dropdown Filters */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1">
        {/* Search Field */}
        {onSearchChange && (
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Status Dropdown */}
        {onStatusChange && statusOptions.length > 0 && (
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          >
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Priority Dropdown */}
        {onPriorityChange && priorityOptions.length > 0 && (
          <select
            value={priorityValue}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          >
            <option value="">Tất cả độ ưu tiên</option>
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Extra Children Filters */}
        {children}

        {/* Clear Filters Button */}
        {onClearFilters && hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Xóa bộ lọc</span>
          </button>
        )}
      </div>

      {/* Right section: View Switcher */}
      {onViewChange && (
        <div className="flex items-center justify-end shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
          <ViewToggle
            currentView={currentView}
            onViewChange={onViewChange}
            modes={viewModes}
          />
        </div>
      )}
    </div>
  );
}
