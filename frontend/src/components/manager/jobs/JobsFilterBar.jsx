import React from 'react';
import { AlertCircle, PauseCircle } from 'lucide-react';
import FilterToolbar from '../../common/table/FilterToolbar';
import { cn } from '../../../utils/cn';

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'HIGH', label: 'High Priority' },
  { value: 'MEDIUM', label: 'Medium Priority' },
  { value: 'LOW', label: 'Low Priority' },
];

export default function JobsFilterBar({
  selectedStatus,
  onStatusChange,
  isOverdueOnly,
  onOverdueChange,
  isClientInactiveOnly,
  onClientInactiveChange,
  searchQuery,
  onSearchChange,
  priorityValue,
  onPriorityChange,
  selectedClient,
  onClientChange,
  clientOptions = [],
  onClearFilters,
  viewMode,
  onViewChange,
}) {
  return (
    <div className="space-y-3">
      {/* Quick Filter Status & Zone Tabs (1-Touch Filter Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Nhóm Bên Trái: Các dự án đang vận hành */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {[
            { key: 'ALL', label: 'All Projects', active: !selectedStatus && !isOverdueOnly && !isClientInactiveOnly },
            { key: 'ACTIVE', label: 'Active', status: 'ACTIVE', active: selectedStatus === 'ACTIVE' && !isOverdueOnly && !isClientInactiveOnly },
            { key: 'PLANNING', label: 'Planning', status: 'PLANNING', active: selectedStatus === 'PLANNING' && !isOverdueOnly && !isClientInactiveOnly },
            { key: 'OVERDUE', label: 'Overdue', isOverdue: true, active: isOverdueOnly },
            { key: 'COMPLETED', label: 'Completed', status: 'COMPLETED', active: selectedStatus === 'COMPLETED' && !isOverdueOnly && !isClientInactiveOnly },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.isOverdue) {
                  onOverdueChange(true);
                  onClientInactiveChange(false);
                  onStatusChange('');
                } else {
                  onOverdueChange(false);
                  onClientInactiveChange(false);
                  onStatusChange(tab.status || '');
                }
              }}
              className={cn(
                'px-3.5 py-2 rounded-xl font-bold transition-all duration-150 cursor-pointer flex items-center gap-2 shrink-0 border',
                tab.active
                  ? tab.key === 'OVERDUE'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
              )}
            >
              {tab.isOverdue && <AlertCircle className="w-3.5 h-3.5 text-amber-300" />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Nhóm Bên Phải: Tạm dừng & Đóng băng */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {[
            { key: 'ON_HOLD', label: 'On Hold', status: 'ON_HOLD', active: selectedStatus === 'ON_HOLD' && !isOverdueOnly && !isClientInactiveOnly },
            { key: 'FROZEN', label: 'Frozen (Inactive Client)', isClientInactive: true, active: isClientInactiveOnly },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.isClientInactive) {
                  onClientInactiveChange(true);
                  onOverdueChange(false);
                  onStatusChange('');
                } else {
                  onOverdueChange(false);
                  onClientInactiveChange(false);
                  onStatusChange(tab.status || '');
                }
              }}
              className={cn(
                'px-3.5 py-2 rounded-xl font-bold transition-all duration-150 cursor-pointer flex items-center gap-2 shrink-0 border',
                tab.active
                  ? tab.key === 'FROZEN'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
              )}
            >
              {tab.isClientInactive && <PauseCircle className="w-3.5 h-3.5 text-rose-300" />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Toolbar (Search, Priority, Client & View Toggle) */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search project name, code, client..."
        priorityOptions={PRIORITY_OPTIONS}
        priorityValue={priorityValue}
        onPriorityChange={onPriorityChange}
        onClearFilters={onClearFilters}
        currentView={viewMode}
        onViewChange={onViewChange}
        viewModes={['table', 'grid']}
      >
        {/* Client Selector Filter */}
        {clientOptions.length > 0 && (
          <select
            value={selectedClient}
            onChange={(e) => onClientChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
          >
            <option value="">All Clients</option>
            {clientOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </FilterToolbar>
    </div>
  );
}
