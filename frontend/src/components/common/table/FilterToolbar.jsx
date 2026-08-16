import React from 'react';
import { Search, RotateCcw, X } from 'lucide-react';
import ViewToggle from './ViewToggle';
import { cn } from '../../../utils/cn';

/**
 * Hybrid FilterToolbar Component
 * 
 * Supports both:
 * 1. Tu's Pill-style filter tabs: filters, activeFilter, onChange
 * 2. Full Search & Dropdown & ViewToggle bar: searchQuery, statusOptions, viewModes, etc.
 * 
 * Compatible with both:
 * import { FilterToolbar } from '...'
 * import FilterToolbar from '...'
 */
export function FilterToolbar({
  // Props từ nhóm Tú (Pill-style filter tabs)
  filters = [],
  activeFilter,
  onChange,

  // Props từ nhóm bạn (Full toolbar with Search, Selects, Clear, ViewToggle)
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search jobs, tasks...',
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
    searchQuery || statusValue || priorityValue || (activeFilter && activeFilter !== 'ALL')
  );

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs',
        className
      )}
    >
      {/* Left section: Pill Filter Tabs, Search & Dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1">
        {/* 1. Pill-style Filter Buttons (Code Nhóm Tú) */}
        {filters.length > 0 && (
          <div className="flex items-center space-x-1.5 text-xs mr-2">
            {filters.map(({ value, label }) => {
              const isActive = value === activeFilter;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange && onChange(value)}
                  className={
                    isActive
                      ? 'px-3 py-1 rounded-full font-semibold bg-blue-600 text-white shadow-sm cursor-pointer transition'
                      : 'px-3 py-1 rounded-full font-medium text-slate-600 hover:bg-slate-200/60 cursor-pointer transition'
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Search Field */}
        {onSearchChange && (
          <div className="relative min-w-[200px] flex-1 max-w-md">
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
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* 3. Status Dropdown */}
        {onStatusChange && statusOptions.length > 0 && (
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* 4. Priority Dropdown */}
        {onPriorityChange && priorityOptions.length > 0 && (
          <select
            value={priorityValue}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
          >
            <option value="">All Priorities</option>
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Extra slot for custom elements */}
        {children}

        {/* 5. Clear Filters Button */}
        {onClearFilters && hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
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

export default FilterToolbar;