import React from 'react';
import { Search, LayoutGrid, List } from 'lucide-react';
import SelectDropdown from '../../common/forms/SelectDropdown';
import { cn } from '../../../utils/cn';

export default function TeamFilterToolbar({
  jobOptions = [],
  selectedJobId,
  onJobChange,
  selectedStatusFilter = 'ALL',
  onStatusFilterChange,
  kpis = { total: 0, overloaded: 0, balanced: 0, available: 0 },
  searchQuery,
  onSearchChange,
  viewMode = 'grid',
  onViewModeChange,
}) {
  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        {/* Bộ lọc Chọn Dự án / Job */}
        <div className="w-full sm:w-56">
          <SelectDropdown
            options={jobOptions}
            value={selectedJobId}
            onChange={onJobChange}
            placeholder="All My Projects / Jobs"
          />
        </div>

        {/* Lọc Status Tải */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 flex-wrap">
          <button
            onClick={() => onStatusFilterChange('ALL')}
            className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'ALL' && 'bg-white text-blue-700 shadow-xs')}
          >
            All ({kpis.total})
          </button>
          <button
            onClick={() => onStatusFilterChange('OVERLOADED')}
            className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'OVERLOADED' && 'bg-white text-rose-700 shadow-xs')}
          >
            Overloaded ({kpis.overloaded})
          </button>
          <button
            onClick={() => onStatusFilterChange('BALANCED')}
            className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'BALANCED' && 'bg-white text-amber-700 shadow-xs')}
          >
            Balanced ({kpis.balanced})
          </button>
          <button
            onClick={() => onStatusFilterChange('AVAILABLE')}
            className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'AVAILABLE' && 'bg-white text-emerald-700 shadow-xs')}
          >
            Available ({kpis.available})
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Ô Tìm kiếm */}
        <div className="relative w-full md:w-56">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search employee..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none transition"
          />
        </div>

        {/* Chuyển đổi View Mode */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => onViewModeChange('grid')}
            className={cn('p-1.5 rounded-lg transition cursor-pointer', viewMode === 'grid' && 'bg-white text-blue-600 shadow-xs')}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={cn('p-1.5 rounded-lg transition cursor-pointer', viewMode === 'table' && 'bg-white text-blue-600 shadow-xs')}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
