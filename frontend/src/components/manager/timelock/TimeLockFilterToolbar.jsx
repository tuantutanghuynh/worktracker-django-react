import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function TimeLockFilterToolbar({
  selectedStatus = 'ALL',
  onStatusChange,
  totalCount = 0,
  lockedCount = 0,
  unlockedCount = 0,
  searchQuery,
  onSearchChange,
}) {
  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        {/* Lọc Status */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
          <button
            onClick={() => onStatusChange('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition cursor-pointer',
              selectedStatus === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'hover:text-slate-900'
            )}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => onStatusChange('LOCKED')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition cursor-pointer',
              selectedStatus === 'LOCKED'
                ? 'bg-white text-rose-700 shadow-2xs font-extrabold'
                : 'hover:text-rose-700'
            )}
          >
            Locked ({lockedCount})
          </button>
          <button
            onClick={() => onStatusChange('UNLOCKED')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition cursor-pointer',
              selectedStatus === 'UNLOCKED'
                ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                : 'hover:text-emerald-700'
            )}
          >
            Unlocked ({unlockedCount})
          </button>
        </div>
      </div>

      {/* Ô Tìm Kiếm */}
      <div className="relative w-full md:w-72">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by job code, name, reason..."
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>
    </div>
  );
}
